"""Nexora Analytics API entrypoint."""

import logging
import threading
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError, OperationalError

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

logger = logging.getLogger("nexora")
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)


# ---------------------------------------------------------------------------
# Rate limiting (in-memory, per client). Simple and dependency-free.
# ---------------------------------------------------------------------------
class _RateLimiter:
    """Sliding-window limiter that also forgets idle clients.

    The previous implementation kept a list for every IP ever seen, so memory
    grew without bound under a scan. Idle buckets are now swept periodically.
    """

    def __init__(self) -> None:
        self._buckets: dict[str, list[float]] = {}
        self._lock = threading.Lock()
        self._last_sweep = time.monotonic()

    def _sweep(self, now: float, window: int) -> None:
        if now - self._last_sweep < window:
            return
        self._last_sweep = now
        for key in [k for k, v in self._buckets.items() if not v or now - v[-1] >= window]:
            self._buckets.pop(key, None)

    def check(self, client: str) -> bool:
        """Return True when the request is allowed."""
        now = time.monotonic()
        window = settings.RATE_LIMIT_WINDOW_SECONDS
        with self._lock:
            self._sweep(now, window)
            bucket = [t for t in self._buckets.get(client, []) if now - t < window]
            if len(bucket) >= settings.RATE_LIMIT_REQUESTS:
                self._buckets[client] = bucket
                return False
            bucket.append(now)
            self._buckets[client] = bucket
            return True


rate_limiter = _RateLimiter()


def client_ip(request: Request) -> str:
    """Best-effort client address.

    Behind the nginx container every request arrives from the proxy's IP, so
    without honouring X-Forwarded-For all users would share one rate-limit
    bucket. The header is only trusted when TRUST_PROXY_HEADERS is enabled.
    """
    if settings.TRUST_PROXY_HEADERS:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip.strip()
    return request.client.host if request.client else "unknown"


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.APP_ENV == "production" and settings.SECRET_KEY in ("change-me-in-production", "change-me-to-a-long-random-string", "dev-only-secret-change-me"):
        logger.warning("SECRET_KEY is set to a well-known default while APP_ENV=production. Set a strong random SECRET_KEY.")
    init_db()
    from app.services.bootstrap import sync_roles_and_permissions

    with SessionLocal() as db:
        sync_roles_and_permissions(db)
    logger.info("Nexora API ready (env=%s)", settings.APP_ENV)
    yield


app = FastAPI(
    title="Nexora Analytics API",
    description="Multi-tenant business analytics platform API.",
    version="1.1.0",
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
async def request_middleware(request: Request, call_next):
    """Rate limiting, request ids, timing logs and security headers."""
    request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
    started = time.perf_counter()

    if settings.RATE_LIMIT_ENABLED and not rate_limiter.check(client_ip(request)):
        response = JSONResponse(status_code=429, content={"detail": "Too many requests, please slow down"})
        response.headers["Retry-After"] = str(settings.RATE_LIMIT_WINDOW_SECONDS)
    else:
        try:
            response = await call_next(request)
        except Exception:  # pragma: no cover - defensive: never leak a stack trace
            logger.exception("Unhandled error [%s] %s %s", request_id, request.method, request.url.path)
            response = JSONResponse(status_code=500, content={"detail": "Internal server error", "request_id": request_id})

    elapsed_ms = (time.perf_counter() - started) * 1000
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if request.url.path.startswith("/api/") and request.url.path != "/api/health":
        logger.info("%s %s -> %s (%.1f ms) [%s]", request.method, request.url.path, response.status_code, elapsed_ms, request_id)
    return response


@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    logger.warning("Integrity error on %s %s: %s", request.method, request.url.path, str(exc.orig)[:200])
    return JSONResponse(status_code=409, content={"detail": "This operation conflicts with existing data"})


@app.exception_handler(OperationalError)
async def operational_error_handler(request: Request, exc: OperationalError):
    logger.error("Database unavailable on %s %s: %s", request.method, request.url.path, str(exc.orig)[:200])
    return JSONResponse(status_code=503, content={"detail": "Database temporarily unavailable, please retry"})


@app.get("/api/health", tags=["system"])
def health() -> dict:
    """Liveness + readiness: also verifies the database answers."""
    from sqlalchemy import text

    db_ok = True
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
    except Exception:  # pragma: no cover
        db_ok = False
    body = {"status": "ok" if db_ok else "degraded", "app": settings.APP_NAME, "env": settings.APP_ENV, "database": "ok" if db_ok else "unavailable", "version": app.version}
    return body


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
