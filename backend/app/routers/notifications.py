"""Notifications, SMS Sender ID Settings, Automatic Recalls & Preventive Care Engine Router."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.audit.service import log_audit_event
from app.database import get_db
from app.models.care_log import CareAndSystemLog
from app.models.user import User
from app.security.dependencies import require_roles, verify_patient_access
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["Patient Care, Recalls & Notifications"])


class NotificationSettingsUpdate(BaseModel):
    sms_sender_id: str | None = Field(default=None, min_length=3, max_length=11)
    sms_provider: str | None = Field(default=None, pattern="^(sandbox|twilio|msg91)$")
    email_enabled: bool | None = None
    whatsapp_number: str | None = None
    instagram_url: str | None = None
    facebook_url: str | None = None
    youtube_url: str | None = None
    recall_defaults: dict[str, int] | None = None


class NotificationSendRequest(BaseModel):
    patient_id: int | None = None
    channel: str = Field(default="sms", pattern="^(sms|email)$")
    category: str = "custom_alert"
    title: str = Field(default="PGI Dental Alert", min_length=1, max_length=255)
    message_body: str = Field(min_length=1)
    language: str = Field(default="en", pattern="^(en|hi|pa)$")
    recipient: str | None = None


class RecallGenerateRequest(BaseModel):
    patient_id: int | None = None


class RecallDispatchRequest(BaseModel):
    include_upcoming: bool = False


class PreventiveCareSendRequest(BaseModel):
    patient_id: int
    language: str | None = Field(default=None, pattern="^(en|hi|pa)$")
    channel: str = Field(default="sms", pattern="^(sms|email|whatsapp)$")
    custom_message: str | None = None


def _serialize_care_log(entry: CareAndSystemLog) -> dict[str, Any]:
    p = entry.payload_json or {}
    return {
        "id": entry.id,
        "event_type": entry.event_type,
        "patient_id": entry.patient_id,
        "patient_name": entry.patient.full_name if entry.patient else None,
        "cr_number": entry.patient.cr_number if entry.patient else None,
        "assigned_doctor_id": entry.assigned_doctor_id,
        "assigned_student_id": entry.assigned_student_id,
        "status": entry.status,
        "scheduled_date": entry.scheduled_date.isoformat() if entry.scheduled_date else None,
        "channel": entry.channel,
        "language": entry.language,
        "title": entry.title,
        "sender_id": p.get("sender_id") or p.get("sms_sender_id"),
        "recipient": p.get("recipient"),
        "category": p.get("category") or p.get("recall_type"),
        "recall_type": p.get("recall_type") or p.get("category"),
        "message_body": p.get("message_body"),
        "payload_json": p,
        "created_at": entry.created_at.isoformat() if entry.created_at else None,
    }


@router.get("/settings")
def get_notification_settings(
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """Get clinic SMS Sender ID, provider, and social/recall configuration."""
    return NotificationService.get_clinic_settings(db)


@router.put("/settings")
def update_notification_settings(
    request: Request,
    payload: NotificationSettingsUpdate,
    current_user: User = Depends(require_roles("admin", "doctor")),
    db: Session = Depends(get_db),
):
    """Doctor/Admin: Configure custom SMS Sender ID (default PGIDNT), email, and social URLs."""
    updates = payload.model_dump(exclude_unset=True)
    if updates.get("sms_sender_id"):
        updates["sms_sender_id"] = updates["sms_sender_id"].strip().upper()
    cfg = NotificationService.update_clinic_settings(db, updates, current_user=current_user)
    log_audit_event(
        db=db,
        action="NOTIFICATION_SETTINGS_UPDATE",
        user=current_user,
        entity_name="ClinicConfig",
        entity_id="clinic_config",
        details={"sms_sender_id": cfg.get("sms_sender_id"), "sms_provider": cfg.get("sms_provider")},
        request=request,
    )
    return cfg


@router.get("/logs")
def list_notification_logs(
    patient_id: int | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """List SMS & Email notification delivery logs (sandbox & live)."""
    rows = NotificationService.list_logs(
        db,
        current_user=current_user,
        event_type="notification",
        patient_id=patient_id,
        status_filter=status_filter,
    )
    return [_serialize_care_log(r) for r in rows]


@router.post("/send", status_code=status.HTTP_201_CREATED)
def send_notification(
    request: Request,
    payload: NotificationSendRequest,
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """Dispatch an SMS or Email notification in sandbox mode with configured SMS_SENDER_ID."""
    if payload.patient_id is not None:
        patient = verify_patient_access(db, current_user, payload.patient_id, require_write=True)
        lang = payload.language or patient.preferred_language or "en"
    else:
        if current_user.role == "student":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "FORBIDDEN", "message": "Students can only send notifications to assigned patients."},
            )
        lang = payload.language

    entry = NotificationService.dispatch_notification(
        db,
        patient_id=payload.patient_id,
        channel=payload.channel,
        category=payload.category,
        title=payload.title,
        message_body=payload.message_body,
        language=lang,
        recipient=payload.recipient,
        actor_user=current_user,
    )
    log_audit_event(
        db=db,
        action="NOTIFICATION_SEND",
        user=current_user,
        entity_name="Notification",
        entity_id=str(entry.id),
        patient_id=payload.patient_id,
        details={"channel": payload.channel, "category": payload.category},
        request=request,
    )
    return _serialize_care_log(entry)


@router.get("/recalls")
def list_recalls(
    patient_id: int | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """List scheduled regular check-up and treatment-specific recalls."""
    rows = NotificationService.list_logs(
        db,
        current_user=current_user,
        event_type="recall",
        patient_id=patient_id,
        status_filter=status_filter,
    )
    return [_serialize_care_log(r) for r in rows]


@router.post("/recalls/generate")
def generate_automatic_recalls(
    request: Request,
    payload: RecallGenerateRequest | None = Body(default=None),
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """Auto-schedule 6-month check-ups + treatment-specific recalls (7d suture, 14d crown, 30d RCT, 90d perio)."""
    pid = payload.patient_id if payload else None
    created = NotificationService.generate_recalls(db, current_user=current_user, patient_id=pid)
    log_audit_event(
        db=db,
        action="RECALLS_GENERATED",
        user=current_user,
        entity_name="Recall",
        entity_id="batch",
        patient_id=pid,
        details={"generated_count": len(created)},
        request=request,
    )
    return {
        "generated_count": len(created),
        "recalls": [_serialize_care_log(r) for r in created],
    }


@router.post("/recalls/dispatch-due")
def dispatch_due_recalls(
    request: Request,
    payload: RecallDispatchRequest | None = Body(default=None),
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """Dispatch localized SMS/Email reminders for all due recalls."""
    inc = payload.include_upcoming if payload else False
    res = NotificationService.dispatch_due_recalls(db, current_user=current_user, include_upcoming=inc)
    log_audit_event(
        db=db,
        action="RECALLS_DISPATCHED",
        user=current_user,
        entity_name="Recall",
        entity_id="dispatch",
        details=res,
        request=request,
    )
    return res


@router.get("/preventive-care/preview/{patient_id}")
def preview_preventive_care(
    patient_id: int,
    language: str | None = Query(default=None, pattern="^(en|hi|pa)$"),
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """Evaluate age, medical conditions, dental categories, and habits to generate preventive care messages."""
    patient = verify_patient_access(db, current_user, patient_id)
    return NotificationService.evaluate_preventive_care(patient, language=language)


@router.post("/preventive-care/send", status_code=status.HTTP_201_CREATED)
def send_preventive_care(
    request: Request,
    payload: PreventiveCareSendRequest,
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """Send localized preventive care advice to a patient based on clinical/demographic rules."""
    patient = verify_patient_access(db, current_user, payload.patient_id, require_write=True)
    res = NotificationService.send_preventive_care(
        db,
        patient,
        language=payload.language,
        channel=payload.channel,
        custom_message=payload.custom_message,
        actor_user=current_user,
    )
    log_audit_event(
        db=db,
        action="PREVENTIVE_CARE_SENT",
        user=current_user,
        entity_name="Patient",
        entity_id=str(patient.id),
        patient_id=patient.id,
        details={"language": res["language"], "rules": [r["rule_key"] for r in res["matched_rules"]]},
        request=request,
    )
    return res
