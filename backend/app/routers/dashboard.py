from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.dashboard import (
    AdminDashboardResponse,
    DashboardAnalyticsResponse,
    DashboardSummaryResponse,
    DoctorDashboardResponse,
    StudentDashboardResponse,
)
from app.security.dependencies import require_roles
from app.services.dashboard_service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["Clinic Dashboard & Analytics"])


@router.get("/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary(
    period: str = Query("30d", pattern="^(today|7d|30d)$"),
    current_user: User = Depends(require_roles("admin", "doctor", "student", "receptionist")),
    db: Session = Depends(get_db),
):
    """Retrieve database-aggregated clinic KPIs and metrics (scoped for students)."""
    return DashboardService.get_summary(db, period=period, current_user=current_user)


@router.get("/analytics", response_model=DashboardAnalyticsResponse)
def get_dashboard_analytics(
    days: int = Query(30, ge=7, le=90),
    current_user: User = Depends(require_roles("admin", "doctor", "student", "receptionist")),
    db: Session = Depends(get_db),
):
    """Retrieve chart trend data for appointments, procedures, and patient registrations."""
    return DashboardService.get_analytics(db, days=days, current_user=current_user)


@router.get("/admin", response_model=AdminDashboardResponse)
def get_admin_dashboard(
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """Admin-only: Retrieve clinic-wide doctors, students, patients, and activity metrics."""
    return DashboardService.get_admin_dashboard(db)


@router.get("/doctor", response_model=DoctorDashboardResponse)
def get_doctor_dashboard(
    current_user: User = Depends(require_roles("admin", "doctor")),
    db: Session = Depends(get_db),
):
    """Doctor dashboard: branch-wide patients, student pool, missed appointments, and high-severity triage."""
    return DashboardService.get_doctor_dashboard(db, current_user=current_user)


@router.get("/student", response_model=StudentDashboardResponse)
def get_student_dashboard(
    current_user: User = Depends(require_roles("admin", "student")),
    db: Session = Depends(get_db),
):
    """Student dashboard: strictly isolated to assigned patients, pending records, and sessions."""
    return DashboardService.get_student_dashboard(db, current_user=current_user)
