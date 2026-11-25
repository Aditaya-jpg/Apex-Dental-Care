import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

# Register all 8 consolidated SQLAlchemy models with Base
import app.models  # noqa: F401
from app.config import settings
from app.database import Base, engine
from app.middleware.audit_middleware import RequestCorrelationMiddleware
from app.middleware.error_handler import (
    http_exception_handler,
    unhandled_exception_handler,
    validation_exception_handler,
)
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.routers import (
    appointments,
    attendance,
    audit,
    auth,
    dashboard,
    dental_chart,
    doctors,
    documents,
    followups,
    health,
    integrations,
    notifications,
    patient_portal,
    patients,
    prescriptions,
    students,
    tracker,
    treatments,
    users,
    visits,
    xrays,
)

logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("dental_app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.APP_NAME} in {settings.ENVIRONMENT} mode...")
    Base.metadata.create_all(bind=engine)
    try:
        from migrate_db import run_migration

        run_migration()
    except Exception as e:
        logger.warning(f"Migration check: {e}")
    logger.info("Database schemas verified (8 tables).")
    yield
    logger.info("Application shutting down...")


app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "PGI Dental Management System — Oral Health Sciences Centre (PGIMER Chandigarh).\n"
        "8-table clinical EMR architecture with FDI restorative & periodontal charting, "
        "AES-256-GCM encrypted imaging/CBCT vault, instant RBAC revocation, smart scheduling, "
        "patient attendance desk, and privacy-isolated patient portal."
    ),
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# 1. Custom Error Handlers
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

# 2. Middlewares
app.add_middleware(RequestCorrelationMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-Response-Time", "Content-Disposition"],
)

# 3. Mount Routers under API prefix (zero billing/payment/report routes)
api_prefix = settings.API_PREFIX  # /api/v1
app.include_router(auth.router, prefix=api_prefix)
app.include_router(users.router, prefix=api_prefix)
app.include_router(doctors.router, prefix=api_prefix)
app.include_router(students.router, prefix=api_prefix)
app.include_router(patients.router, prefix=api_prefix)
app.include_router(attendance.router, prefix=api_prefix)
app.include_router(patient_portal.router, prefix=api_prefix)
app.include_router(appointments.router, prefix=api_prefix)
app.include_router(visits.router, prefix=api_prefix)
app.include_router(dental_chart.router, prefix=api_prefix)
app.include_router(treatments.router, prefix=api_prefix)
app.include_router(prescriptions.router, prefix=api_prefix)
app.include_router(documents.router, prefix=api_prefix)
app.include_router(xrays.router, prefix=api_prefix)
app.include_router(followups.router, prefix=api_prefix)
app.include_router(tracker.router, prefix=api_prefix)
app.include_router(notifications.router, prefix=api_prefix)
app.include_router(integrations.router, prefix=api_prefix)
app.include_router(dashboard.router, prefix=api_prefix)
app.include_router(audit.router, prefix=api_prefix)

# Health routes accessible at root and api_prefix
app.include_router(health.router)
app.include_router(health.router, prefix=api_prefix)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
