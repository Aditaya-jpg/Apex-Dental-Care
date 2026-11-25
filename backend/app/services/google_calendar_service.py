"""Google Calendar URL, RFC 5545 .ics export, and optional OAuth v3 sync service."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlencode

import httpx

from app.config import settings

logger = logging.getLogger("dental_app.google_calendar")


def _escape_ics(value: str) -> str:
    return (
        value.replace("\\", "\\\\")
        .replace("\r\n", "\\n")
        .replace("\n", "\\n")
        .replace(",", "\\,")
        .replace(";", "\\;")
    )


def build_google_calendar_url(appt: Any, patient: Any = None, doctor: Any = None) -> str:
    """Build an Add-to-Google-Calendar deep link for an appointment."""
    start_dt = datetime.combine(appt.appointment_date, appt.start_time)
    end_dt = datetime.combine(appt.appointment_date, appt.end_time)
    dates_param = f"{start_dt.strftime('%Y%m%dT%H%M%S')}/{end_dt.strftime('%Y%m%dT%H%M%S')}"

    doc_obj = doctor or getattr(appt, "doctor", None)
    pat_obj = patient or getattr(appt, "patient", None)
    doc_name = doc_obj.full_name if doc_obj else "PGI Dental Specialist"
    pat_ref = (pat_obj.cr_number or pat_obj.patient_code) if pat_obj else f"Patient #{appt.patient_id}"

    params = {
        "action": "TEMPLATE",
        "text": f"PGI Dental Appointment - {appt.appointment_type}",
        "dates": dates_param,
        "details": f"Attending Doctor: {doc_name}\nCR No: {pat_ref}",
        "location": f"{settings.CLINIC_NAME} ({appt.operatory})",
    }
    return f"https://calendar.google.com/calendar/render?{urlencode(params)}"


def generate_ics_payload(appt: Any, patient: Any = None, doctor: Any = None) -> str:
    """Generate a valid RFC 5545 text/calendar (.ics) invite for an appointment."""
    start_dt = datetime.combine(appt.appointment_date, appt.start_time)
    end_dt = datetime.combine(appt.appointment_date, appt.end_time)
    now_utc = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")

    doc_obj = doctor or getattr(appt, "doctor", None)
    pat_obj = patient or getattr(appt, "patient", None)
    doc_name = doc_obj.full_name if doc_obj else "PGI Dental Specialist"
    pat_ref = (pat_obj.cr_number or pat_obj.patient_code) if pat_obj else f"Patient #{appt.patient_id}"

    status_map = {
        "cancelled": "CANCELLED",
        "no_show": "CANCELLED",
        "confirmed": "CONFIRMED",
        "checked_in": "CONFIRMED",
        "completed": "CONFIRMED",
    }
    ics_status = status_map.get(getattr(appt, "status", "scheduled"), "CONFIRMED")

    summary = _escape_ics(f"PGI Dental: {appt.appointment_type} ({doc_name})")
    description = _escape_ics(
        f"PGI Dental Branch Appointment\n"
        f"Attending Doctor: {doc_name}\n"
        f"Operatory: {appt.operatory}\n"
        f"CR / Patient Code: {pat_ref}\n"
        f"Please carry your PGI CR Card & previous radiographs."
    )
    location = _escape_ics(f"{settings.CLINIC_NAME}, {appt.operatory}, {settings.CLINIC_ADDRESS}")

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//PGI Dental Management System//PGIMER Chandigarh//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        f"UID:pgi-dental-appt-{appt.id}@pgimer.edu.in",
        f"DTSTAMP:{now_utc}",
        f"DTSTART:{start_dt.strftime('%Y%m%dT%H%M%S')}",
        f"DTEND:{end_dt.strftime('%Y%m%dT%H%M%S')}",
        f"SUMMARY:{summary}",
        f"DESCRIPTION:{description}",
        f"LOCATION:{location}",
        f"STATUS:{ics_status}",
        "END:VEVENT",
        "END:VCALENDAR",
        "",
    ]
    return "\r\n".join(lines)


def sync_appointment_to_google_calendar(appt: Any, patient: Any = None, doctor: Any = None) -> dict[str, Any]:
    """
    Optional live Google Calendar v3 sync hook when OAuth credentials and doctor tokens exist.
    Falls back cleanly to ready_for_sync with Google Calendar URL and .ics link for viva demo.
    """
    gcal_url = build_google_calendar_url(appt, patient, doctor)
    doc_obj = doctor or getattr(appt, "doctor", None)
    tokens = getattr(doc_obj, "google_oauth_tokens", None) if doc_obj else None

    if settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET and isinstance(tokens, dict) and tokens.get("access_token"):
        cal_id = doc_obj.google_calendar_id or "primary"
        start_dt = datetime.combine(appt.appointment_date, appt.start_time)
        end_dt = datetime.combine(appt.appointment_date, appt.end_time)
        body = {
            "summary": f"PGI Dental: {appt.appointment_type}",
            "location": f"{settings.CLINIC_NAME} ({appt.operatory})",
            "description": f"Patient CR: {patient.cr_number if patient else appt.patient_id}",
            "start": {"dateTime": start_dt.isoformat(), "timeZone": "Asia/Kolkata"},
            "end": {"dateTime": end_dt.isoformat(), "timeZone": "Asia/Kolkata"},
        }
        try:
            with httpx.Client(timeout=5.0) as client:
                resp = client.post(
                    f"https://www.googleapis.com/calendar/v3/calendars/{cal_id}/events",
                    headers={"Authorization": f"Bearer {tokens['access_token']}"},
                    json=body,
                )
                if resp.status_code in (200, 201):
                    event_id = resp.json().get("id")
                    return {
                        "synced": True,
                        "status": "synced",
                        "google_event_id": event_id,
                        "google_calendar_url": gcal_url,
                    }
        except Exception as exc:
            logger.warning(f"Google Calendar v3 sync skipped: {exc}")

    return {
        "synced": False,
        "status": "ready_for_sync",
        "google_event_id": getattr(appt, "google_event_id", None),
        "google_calendar_url": gcal_url,
    }
