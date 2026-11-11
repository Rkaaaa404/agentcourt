"""AgentCourt FastAPI Application entrypoint."""

import sys
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path

_BACKEND_DIR = str(Path(__file__).resolve().parent.parent.parent)
_ROOT_DIR = str(Path(__file__).resolve().parent.parent.parent.parent)
for _p in (_BACKEND_DIR, _ROOT_DIR):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from agentcourt.api.cases import router as cases_router
from agentcourt.api.purchases import router as purchases_router
from agentcourt.api.webhooks import router as webhooks_router
from agentcourt.config import settings
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

WEB_DIST_DIR = Path(__file__).resolve().parent.parent.parent.parent / "web" / "dist"


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
            "frontend_built": (WEB_DIST_DIR / "index.html").exists(),
        }
    )


if (WEB_DIST_DIR / "assets").is_dir():
    app.mount("/assets", StaticFiles(directory=str(WEB_DIST_DIR / "assets")), name="frontend-assets")


@app.get("/", include_in_schema=False)
async def serve_frontend_root() -> FileResponse:
    """Serve the built React/Vite SPA entrypoint."""
    index_file = WEB_DIST_DIR / "index.html"
    if not index_file.exists():
        raise HTTPException(
            status_code=404,
            detail="Frontend bundle not built. Run 'cd web && npm run build' or access Vite dev server.",
        )
    return FileResponse(index_file)


@app.get("/{full_path:path}", include_in_schema=False)
async def serve_frontend_spa(full_path: str) -> FileResponse:
    """SPA fallback for client-side routes without intercepting /api or /healthz."""
    if full_path.startswith("api/") or full_path == "api" or full_path == "healthz":
        raise HTTPException(status_code=404, detail="Not found")

    candidate = (WEB_DIST_DIR / full_path).resolve()
    if WEB_DIST_DIR.exists() and str(candidate).startswith(str(WEB_DIST_DIR.resolve())) and candidate.is_file():
        return FileResponse(candidate)

    index_file = WEB_DIST_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    raise HTTPException(status_code=404, detail="Not found")
