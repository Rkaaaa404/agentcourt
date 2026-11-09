"""Shopping Agent orchestrating intent parsing, catalog search, candidate tracing, and PayPal order creation."""

import logging
from typing import Optional

from pydantic import BaseModel

from agentcourt.agent.catalog import CatalogItem, get_all_catalog_items
from agentcourt.agent.llm import BaseLLMClient, get_llm_client
from agentcourt.agent.scoring import (
    CandidateTrace,
    SelectionPolicy,
    evaluate_catalog_and_select,
)
from agentcourt.config import settings
from agentcourt.ledger import LedgerEventType, default_ledger
from agentcourt.mandate.crypto import compute_order_binding, generate_keypair
from agentcourt.mandate.models import (
    CartItem,
    CartMandate,
    IntentMandate,
    SignedMandatePack,
)
from agentcourt.payments.models import OrderCreateRequest, OrderResponse
from agentcourt.payments.port import PaymentsPort

logger = logging.getLogger("agentcourt.agent.shopper")


class PurchaseResult(BaseModel):
    """Output bundle from an autonomous shopping purchase session."""

    intent: IntentMandate
    cart: CartMandate
    mandate_pack: SignedMandatePack
    candidate_trace: CandidateTrace
    order: OrderResponse
    order_binding: str
    llm_used: bool


class ShoppingAgent:
    """Autonomous shopping agent enforcing AP2-inspired mandate signing and transparent trace recording."""

    def __init__(
        self,
        payments: PaymentsPort,
        llm_client: Optional[BaseLLMClient] = None,
        default_policy: SelectionPolicy = SelectionPolicy.OPTIMAL,
    ):
        self.payments = payments
        self.llm_client = llm_client or get_llm_client()
        self.default_policy = default_policy

    async def execute_purchase(
        self,
        user_request: str,
        policy: Optional[SelectionPolicy] = None,
        buyer_private_key: Optional[str] = None,
        agent_private_key: Optional[str] = None,
        catalog_items: Optional[list[CatalogItem]] = None,
    ) -> PurchaseResult:
        """Execute full purchasing lifecycle:

        1. Parse natural-language intent into UserConstraints.
        2. Create and sign IntentMandate.
        3. Search catalog and score offers with candidate trace.
        4. Select offer (optimal or first-acceptable).
        5. Create and sign CartMandate tied to Intent hash.
        6. Create PayPal Sandbox Order with custom_id binding.
        7. Record append-only ledger entries.
        """
        active_policy = policy or self.default_policy

        # Step 1: Parse intent
        constraints, llm_used = await self.llm_client.extract_intent(user_request)

        # Step 2: Keys and IntentMandate
        if not buyer_private_key:
            buyer_priv, buyer_pub = generate_keypair()
        else:
            buyer_priv = buyer_private_key
            from cryptography.hazmat.primitives.asymmetric import ed25519

            buyer_pub = (
                ed25519.Ed25519PrivateKey.from_private_bytes(bytes.fromhex(buyer_priv))
                .public_key()
                .public_bytes_raw()
                .hex()
            )

        intent = IntentMandate(
            user_request=user_request,
            constraints=constraints,
            spend_cap=constraints.max_spend,
            allowed_merchants=constraints.allowed_merchants,
            public_key=buyer_pub,
        )
        intent.sign(buyer_priv)

        # Step 3 & 4: Evaluate catalog and select
        items = catalog_items if catalog_items is not None else get_all_catalog_items()
        chosen_item, trace = evaluate_catalog_and_select(
            items=items,
            constraints=constraints,
            policy=active_policy,
            regret_threshold=float(settings.REGRET_THRESHOLD),
        )

        if not chosen_item:
            raise ValueError(
                f"No catalog offers satisfied the constraints (min {constraints.min_ports} ports, max ${constraints.max_spend:.2f})"
            )

        # Step 5: Create and sign CartMandate
        if not agent_private_key:
            agent_priv, agent_pub = generate_keypair()
        else:
            agent_priv = agent_private_key
            from cryptography.hazmat.primitives.asymmetric import ed25519

            agent_pub = (
                ed25519.Ed25519PrivateKey.from_private_bytes(bytes.fromhex(agent_priv))
                .public_key()
                .public_bytes_raw()
                .hex()
            )

        cart_item = CartItem(
            item_id=chosen_item.id,
            title=chosen_item.title,
            price=chosen_item.price,
            currency=chosen_item.currency,
            attributes=chosen_item.to_spec_dict(),
        )

        cart = CartMandate(
            intent_hash=intent.hash(),
            merchant_id=chosen_item.merchant_id,
            items=[cart_item],
            total_amount=chosen_item.price,
            currency=chosen_item.currency,
            public_key=agent_pub,
        )
        cart.sign(agent_priv)

        pack = SignedMandatePack(intent=intent, cart=cart)

        # Step 6: Log mandate creation in ledger
        default_ledger.append(
            event_type=LedgerEventType.INTENT_MANDATE_CREATED,
            payload={
                "intent_id": intent.id,
                "intent_hash": intent.hash(),
                "spend_cap": f"{intent.spend_cap:.2f}",
                "allowed_merchants": intent.allowed_merchants,
            },
        )
        default_ledger.append(
            event_type=LedgerEventType.CART_MANDATE_CREATED,
            payload={
                "cart_id": cart.id,
                "cart_hash": cart.hash(),
                "intent_hash": cart.intent_hash,
                "merchant_id": cart.merchant_id,
                "total_amount": f"{cart.total_amount:.2f}",
            },
        )

        if trace.is_regret_flagged:
            default_ledger.append(
                event_type=LedgerEventType.AGENT_REGRET_RECORDED,
                payload={
                    "regret_score": trace.regret_score,
                    "chosen_candidate": trace.chosen_candidate.title if trace.chosen_candidate else "",
                    "best_candidate": trace.best_candidate.title if trace.best_candidate else "",
                    "policy_applied": trace.policy_applied.value,
                },
            )

        # Step 7: Create PayPal Order
        # Generate provisional binding with intent.nonce
        provisional_binding = compute_order_binding(intent.hash(), cart.hash(), intent.nonce)

        order_req = OrderCreateRequest(
            amount=cart.total_amount,
            currency=cart.currency,
            item_name=chosen_item.title,
            custom_id=provisional_binding,
        )
        order = await self.payments.create_order(order_req)

        # Calculate definitive binding containing the PayPal assigned order_id
        definitive_binding = pack.compute_order_binding(order.id)

        # Patch order custom_id with definitive binding on PayPal
        patched = await self.payments.patch_order_custom_id(order.id, definitive_binding)
        active_binding = definitive_binding if patched else provisional_binding
        order.custom_id = active_binding

        default_ledger.append(
            event_type=LedgerEventType.ORDER_CREATED,
            payload={
                "order_id": order.id,
                "status": order.status,
                "custom_id": active_binding,
                "definitive_binding": definitive_binding,
                "approval_url": order.approval_url,
            },
        )

        return PurchaseResult(
            intent=intent,
            cart=cart,
            mandate_pack=pack,
            candidate_trace=trace,
            order=order,
            order_binding=active_binding,
            llm_used=llm_used,
        )
