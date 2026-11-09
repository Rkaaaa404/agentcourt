"""AgentCourt FastAPI Application entrypoint."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from agentcourt.api.cases import router as cases_router
from agentcourt.api.purchases import router as purchases_router
from agentcourt.api.webhooks import router as webhooks_router
from agentcourt.config import settings
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifecycle hooks."""
    # Safety assertion on startup
    if settings.PAYPAL_ENV != "sandbox" or settings.PAYPAL_BASE_URL != "https://api-m.sandbox.paypal.com":
        raise RuntimeError("FATAL SAFETY CHECK FAILED: Sandbox only allowed.")
    yield


app = FastAPI(
    title="AgentCourt API",
    description="Post-Payment Liability Layer for Autonomous Agent Commerce",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(cases_router)
app.include_router(purchases_router)
app.include_router(webhooks_router)


@app.get("/healthz")
async def health_check() -> JSONResponse:
    """Service health check endpoint."""
    return JSONResponse(
        content={
            "status": "healthy",
            "service": "agentcourt",
            "environment": settings.PAYPAL_ENV,
            "paypal_base_url": settings.PAYPAL_BASE_URL,
        }
    )
