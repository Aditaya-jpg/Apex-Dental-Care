"""Social Media Integration, Webhook Lead Capture & WhatsApp Localized Care Links."""

from __future__ import annotations

from datetime import date
from urllib.parse import quote

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.audit.service import log_audit_event
from app.database import get_db
from app.i18n.translations import PRE_APPOINTMENT_INSTRUCTIONS, normalize_language
from app.models.appointment import Appointment
from app.models.care_log import CareAndSystemLog
from app.models.clinical_record import ClinicalRecord
from app.models.user import User
from app.security.dependencies import (
    get_current_user,
    require_roles,
    security_scheme,
    verify_patient_access,
)
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/integrations", tags=["Social Media & Calendar Integrations"])


class SocialSettingsUpdate(BaseModel):
    whatsapp_number: str | None = None
    instagram_url: str | None = None
    facebook_url: str | None = None
    youtube_url: str | None = None
    webhook_token: str | None = None


class SocialLeadPayload(BaseModel):
    caller_name: str = Field(min_length=1, max_length=200)
    phone: str = Field(min_length=5, max_length=50)
    source_channel: str = Field(default="whatsapp", pattern="^(whatsapp|instagram|facebook|youtube|phone_enquiry)$")
    chief_complaint: str | None = None
    message: str | None = None
    preferred_language: str = Field(default="en", pattern="^(en|hi|pa)$")
    notes: str | None = None
    webhook_token: str | None = None


def _clean_whatsapp_digits(phone: str) -> str:
    digits = "".join(ch for ch in (phone or "") if ch.isdigit())
    if len(digits) == 10:
        return f"91{digits}"
    return digits


def _optional_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security_scheme),
    db: Session = Depends(get_db),
) -> User | None:
    if not credentials and not request.cookies.get("access_token"):
        return None
    token = credentials.credentials if credentials else request.cookies.get("access_token")
    return get_current_user(request=request, token=token, db=db)


@router.get("/social-settings")
def get_social_settings(
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """Retrieve clinic WhatsApp, Instagram, Facebook, and YouTube integration settings."""
    cfg = NotificationService.get_clinic_settings(db)
    return {
        "whatsapp_number": cfg.get("whatsapp_number", ""),
        "instagram_url": cfg.get("instagram_url", ""),
        "facebook_url": cfg.get("facebook_url", ""),
        "youtube_url": cfg.get("youtube_url", ""),
        "webhook_token": cfg.get("webhook_token", "pgi-social-webhook"),
    }


@router.put("/social-settings")
def update_social_settings(
    request: Request,
    payload: SocialSettingsUpdate,
    current_user: User = Depends(require_roles("admin", "doctor")),
    db: Session = Depends(get_db),
):
    """Doctor/Admin: Update clinic social media channel URLs and WhatsApp contact."""
    updates = payload.model_dump(exclude_unset=True)
    cfg = NotificationService.update_clinic_settings(db, updates, current_user=current_user)
    log_audit_event(
        db=db,
        action="SOCIAL_SETTINGS_UPDATE",
        user=current_user,
        entity_name="ClinicConfig",
        entity_id="social_settings",
        details={"whatsapp_number": cfg.get("whatsapp_number")},
        request=request,
    )
    return {
        "whatsapp_number": cfg.get("whatsapp_number", ""),
        "instagram_url": cfg.get("instagram_url", ""),
        "facebook_url": cfg.get("facebook_url", ""),
        "youtube_url": cfg.get("youtube_url", ""),
        "webhook_token": cfg.get("webhook_token", "pgi-social-webhook"),
    }


@router.post("/social-lead", status_code=status.HTTP_201_CREATED)
def capture_social_lead(
    request: Request,
    payload: SocialLeadPayload,
    x_webhook_token: str | None = Header(default=None),
    current_user: User | None = Depends(_optional_user),
    db: Session = Depends(get_db),
):
    """
    Capture an incoming WhatsApp / Instagram / Facebook enquiry directly into Patient Tracker.
    Authorizes either authenticated staff (admin/doctor/student) OR valid webhook token.
    """
    cfg = NotificationService.get_clinic_settings(db)
    expected_token = cfg.get("webhook_token", "pgi-social-webhook")
    provided_token = x_webhook_token or payload.webhook_token

    if current_user is not None:
        if current_user.role in ("receptionist", "patient"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "FORBIDDEN", "message": "Role not permitted to capture social leads."},
            )
    else:
        if not provided_token or provided_token != expected_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "UNAUTHORIZED", "message": "Provide staff Bearer token or valid X-Webhook-Token."},
            )

    enq = CareAndSystemLog(
        event_type="enquiry",
        patient_id=None,
        actor_user_id=current_user.id if current_user else None,
        status="open",
        scheduled_date=date.today(),
        channel=payload.source_channel,
        language=normalize_language(payload.preferred_language),
        title=f"{payload.source_channel.title()} Lead — {payload.caller_name}",
        payload_json={
            "caller_name": payload.caller_name.strip(),
            "phone": payload.phone.strip(),
            "source_channel": payload.source_channel,
            "chief_complaint": payload.chief_complaint or payload.message,
            "notes": payload.notes or payload.message or f"Captured from {payload.source_channel} integration",
            "stage": "enquiry",
        },
    )
    db.add(enq)
    db.commit()
    db.refresh(enq)

    log_audit_event(
        db=db,
        action="SOCIAL_LEAD_CAPTURED",
        user=current_user,
        entity_name="Enquiry",
        entity_id=str(enq.id),
        details={"source_channel": payload.source_channel, "caller_name": payload.caller_name},
        request=request,
    )

    return {
        "id": enq.id,
        "status": enq.status,
        "channel": enq.channel,
        "caller_name": payload.caller_name,
        "phone": payload.phone,
        "source_channel": payload.source_channel,
        "language": enq.language,
        "message": "Social lead captured into Patient Tracker.",
        "enquiry": {
            "id": enq.id,
            "caller_name": payload.caller_name.strip(),
            "phone": payload.phone.strip(),
            "source_channel": payload.source_channel,
            "preferred_language": enq.language,
            "chief_complaint": payload.chief_complaint or payload.message,
            "notes": payload.notes or payload.message,
            "stage": "enquiry",
            "status": enq.status,
            "created_at": enq.created_at.isoformat() if enq.created_at else None,
        },
    }


@router.get("/whatsapp-link/{patient_id}")
def get_whatsapp_share_link(
    patient_id: int,
    kind: str = Query(default="appointment", pattern="^(appointment|prescription|preventive)$"),
    language: str | None = Query(default=None, pattern="^(en|hi|pa)$"),
    current_user: User = Depends(require_roles("admin", "doctor", "student")),
    db: Session = Depends(get_db),
):
    """Generate a pre-filled localized WhatsApp message link (https://wa.me/...) for patient care."""
    patient = verify_patient_access(db, current_user, patient_id)
    lang = normalize_language(language or patient.preferred_language)
    message = ""

    if kind == "appointment":
        appt = (
            db.query(Appointment)
            .filter(Appointment.patient_id == patient.id, Appointment.status.notin_(["cancelled"]))
            .order_by(Appointment.appointment_date.desc(), Appointment.start_time.desc())
            .first()
        )
        if appt:
            doc_name = appt.doctor.full_name if appt.doctor else "PGI Dental Specialist"
            pre_tip = PRE_APPOINTMENT_INSTRUCTIONS[3]["text"][lang]
            templates = {
                "en": f"Hello {patient.full_name}, PGI Dental reminder: Appointment on {appt.appointment_date.isoformat()} at {str(appt.start_time)[:5]} with {doc_name} ({appt.operatory}). {pre_tip}",
                "hi": f"नमस्ते {patient.full_name}, पीजीआई डेंटल सूचना: {doc_name} के साथ आपकी अपॉइंटमेंट {appt.appointment_date.isoformat()} को {str(appt.start_time)[:5]} बजे ({appt.operatory}) है। {pre_tip}",
                "pa": f"ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ {patient.full_name}, ਪੀਜੀਆਈ ਡੈਂਟਲ ਯਾਦ-ਪੱਤਰ: {doc_name} ਨਾਲ ਤੁਹਾਡੀ ਮੁਲਾਕਾਤ {appt.appointment_date.isoformat()} ਨੂੰ {str(appt.start_time)[:5]} ਵਜੇ ({appt.operatory}) ਹੈ। {pre_tip}",
            }
            message = templates[lang]
        else:
            message = PRE_APPOINTMENT_INSTRUCTIONS[3]["text"][lang]

    elif kind == "prescription":
        rx = (
            db.query(ClinicalRecord)
            .filter(ClinicalRecord.patient_id == patient.id, ClinicalRecord.record_type == "prescription")
            .order_by(desc(ClinicalRecord.created_at), desc(ClinicalRecord.id))
            .first()
        )
        if rx:
            p = rx.payload_json or {}
            meds = ", ".join(m.get("medicine_name", "") for m in p.get("medications", []))
            instr = p.get("treatment_instructions") or p.get("general_instructions") or ""
            templates = {
                "en": f"Hello {patient.full_name}, PGI Dental Prescription ({p.get('prescription_number', rx.id)}): {meds}. {instr}",
                "hi": f"नमस्ते {patient.full_name}, पीजीआई डेंटल पर्चा ({p.get('prescription_number', rx.id)}): {meds}। {instr}",
                "pa": f"ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ {patient.full_name}, ਪੀਜੀਆਈ ਡੈਂਟਲ ਪਰਚਾ ({p.get('prescription_number', rx.id)}): {meds}। {instr}",
            }
            message = templates[lang].strip()
        else:
            message = f"Hello {patient.full_name}, please check your PGI Dental Portal for your care instructions."

    else:  # preventive
        prev = NotificationService.evaluate_preventive_care(patient, language=lang)
        message = f"PGI Dental Care ({patient.full_name}): {prev['combined_message']}"

    digits = _clean_whatsapp_digits(patient.phone)
    wa_url = f"https://wa.me/{digits}?text={quote(message)}"
    return {
        "patient_id": patient.id,
        "patient_name": patient.full_name,
        "phone": patient.phone,
        "kind": kind,
        "language": lang,
        "message": message,
        "whatsapp_url": wa_url,
    }
