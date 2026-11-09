"""Human-in-the-loop action executor executing planned dispute actions via PaymentsPort."""

import logging
from typing import Any

from agentcourt.executor.planner import PlannedActionType, PlannedPayPalAction
from agentcourt.ledger import LedgerEventType, default_ledger
from agentcourt.payments.models import AcceptClaimType
from agentcourt.payments.port import PaymentsPort

logger = logging.getLogger("agentcourt.executor")


class ExecutionError(Exception):
    """Raised when executing a planned action fails."""

    pass


class ActionExecutor:
    """Executes planned actions against PayPal and the immutable ledger upon human approval."""

    def __init__(self, payments: PaymentsPort):
        self.payments = payments

    async def execute(
        self,
        planned_action: PlannedPayPalAction,
        approver: str = "human_operator",
    ) -> dict[str, Any]:
        """Execute the planned PayPal action after explicit approval by a human operator."""
        if planned_action.executed:
            raise ExecutionError(f"Action for case '{planned_action.case_id}' has already been executed.")

        if planned_action.action_type == PlannedActionType.NONE:
            raise ExecutionError("Cannot execute action of type NONE. Case requires human investigation.")

        logger.info(
            "Executing action %s for case %s (dispute %s) approved by '%s'",
            planned_action.action_type.value,
            planned_action.case_id,
            planned_action.dispute_id,
            approver,
        )

        result: dict[str, Any] = {}
        dispute_id = planned_action.dispute_id

        if planned_action.action_type == PlannedActionType.ACCEPT_CLAIM:
            claim_type = AcceptClaimType.REFUND
            note = planned_action.request_payload.get("note", "")
            result = await self.payments.accept_dispute_claim(
                dispute_id=dispute_id,
                claim_type=claim_type,
                note=note,
            )

        elif planned_action.action_type == PlannedActionType.PROVIDE_EVIDENCE:
            evs = planned_action.request_payload.get("evidences", [{}])
            ev_type = evs[0].get("evidence_type", "OTHER")
            notes = evs[0].get("notes", "")
            result = await self.payments.provide_dispute_evidence(
                dispute_id=dispute_id,
                evidence_type=ev_type,
                notes=notes,
            )

        elif planned_action.action_type == PlannedActionType.MAKE_OFFER:
            from decimal import Decimal

            from agentcourt.payments.models import OfferType

            amt = Decimal(str(planned_action.request_payload.get("offer_amount", {}).get("value", "0.00")))
            note = planned_action.request_payload.get("note", "")
            result = await self.payments.make_dispute_offer(
                dispute_id=dispute_id,
                amount=amt,
                offer_type=OfferType.REFUND,
                note=note,
            )

        # Mark planned action as executed
        planned_action.executed = True
        planned_action.execution_result = result

        # 1. Record ACTION_EXECUTED in ledger
        default_ledger.append(
            event_type=LedgerEventType.ACTION_EXECUTED,
            payload={
                "action_type": planned_action.action_type.value,
                "api_path": planned_action.api_path,
                "approver": approver,
                "result": result,
            },
            case_id=planned_action.case_id,
        )

        # 2. Record off-PayPal consequence in ledger if present
        if planned_action.off_paypal_ledger_entry:
            off_event = planned_action.off_paypal_ledger_entry.get("event")
            if off_event == "OPERATOR_LIABILITY_RECORDED":
                default_ledger.append(
                    event_type=LedgerEventType.OPERATOR_LIABILITY_RECORDED,
                    payload=planned_action.off_paypal_ledger_entry,
                    case_id=planned_action.case_id,
                )
            elif off_event == "AGENT_REGRET_RECORDED":
                default_ledger.append(
                    event_type=LedgerEventType.AGENT_REGRET_RECORDED,
                    payload=planned_action.off_paypal_ledger_entry,
                    case_id=planned_action.case_id,
                )

        return result
