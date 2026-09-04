"""Nexora Analytics API entrypoint."""

import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from app.api.routes import (
    analytics,
    audit,
    auth,
    customers,
    dashboard,
    goals,
    notifications,
    orders,
    products,
    reports,
    search,
    settings as settings_routes,
    team,
)
from app.config import settings
from app.database.db import SessionLocal, init_db

# In-memory rate limiter (per client IP). Simple and dependency-free.
_requests: dict[str, list[float]] = {}


def _rate_limit(request: Request) -> None:
    if not settings.RATE_LIMIT_ENABLED:
        return
    client = request.client.host if request.client else "unknown"
    now = time.monotonic()
    window = settings.RATE_LIMIT_WINDOW_SECONDS
    bucket = [t for t in _requests.get(client, []) if now - t < window]
    if len(bucket) >= settings.RATE_LIMIT_REQUESTS:
        raise PermissionError("rate_limit")
    bucket.append(now)
    _requests[client] = bucket


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    from app.services.bootstrap import sync_roles_and_permissions

    with SessionLocal() as db:
        sync_roles_and_permissions(db)
    yield


app = FastAPI(
    title="Nexora Analytics API",
    description="Multi-tenant business analytics platform API.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    try:
        _rate_limit(request)
    except PermissionError:
        return JSONResponse(status_code=429, content={"detail": "Too many requests, please slow down"})
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    return response


@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    return JSONResponse(status_code=409, content={"detail": "This operation conflicts with existing data"})


@app.get("/api/health", tags=["system"])
def health() -> dict:
    return {"status": "ok", "app": settings.APP_NAME, "env": settings.APP_ENV}


API_PREFIX = settings.API_V1_PREFIX
app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(dashboard.router, prefix=API_PREFIX)
app.include_router(analytics.router, prefix=API_PREFIX)
app.include_router(products.router, prefix=API_PREFIX)
app.include_router(products.categories_router, prefix=API_PREFIX)
app.include_router(customers.router, prefix=API_PREFIX)
app.include_router(orders.router, prefix=API_PREFIX)
app.include_router(reports.router, prefix=API_PREFIX)
app.include_router(goals.router, prefix=API_PREFIX)
app.include_router(team.router, prefix=API_PREFIX)
app.include_router(notifications.router, prefix=API_PREFIX)
app.include_router(search.router, prefix=API_PREFIX)
app.include_router(settings_routes.router, prefix=API_PREFIX)
app.include_router(audit.router, prefix=API_PREFIX)