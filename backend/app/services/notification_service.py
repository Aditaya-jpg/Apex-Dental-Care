"""Patient Care Notification Engine, SMS Sender ID Config, Automatic Recalls & Preventive Care."""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, UTC
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.config import settings
from app.i18n.translations import (
    PREVENTIVE_CARE_TEMPLATES,
    lookup_instruction,
    normalize_language,
    render_appointment_message,
)
from app.models.care_log import CareAndSystemLog
from app.models.clinical_record import ClinicalRecord
from app.models.patient import Patient
from app.models.user import User
from app.security.dependencies import resolve_student_for_user, verify_patient_access

logger = logging.getLogger("dental_app.notifications")

DEFAULT_CLINIC_SETTINGS: dict[str, Any] = {
    "clinic_name": settings.CLINIC_NAME,
    "sms_sender_id": settings.SMS_SENDER_ID or "PGIDNT",
    "sms_provider": settings.SMS_PROVIDER or "sandbox",
    "email_enabled": True,
    "whatsapp_number": "+911722756831",
    "instagram_url": "https://instagram.com/pgimer_dental",
    "facebook_url": "https://facebook.com/pgimer.oralhealth",
    "youtube_url": "",
    "webhook_token": "pgi-social-webhook",
    "recall_defaults": {
        "routine_checkup_days": 180,
        "suture_removal_days": 7,
        "crown_check_days": 14,
        "rct_followup_days": 30,
        "perio_maintenance_days": 90,
    },
}


class NotificationService:
    @staticmethod
    def _get_or_create_config_row(db: Session) -> CareAndSystemLog:
        row = (
            db.query(CareAndSystemLog)
            .filter(CareAndSystemLog.event_type == "clinic_config")
            .order_by(CareAndSystemLog.id.asc())
            .first()
        )
        if not row:
            row = CareAndSystemLog(
                event_type="clinic_config",
                status="active",
                channel="system",
                language="en",
                title="PGI Dental Branch System Configuration",
                payload_json=dict(DEFAULT_CLINIC_SETTINGS),
            )
            db.add(row)
            db.commit()
            db.refresh(row)
        return row

    @classmethod
    def get_clinic_settings(cls, db: Session) -> dict[str, Any]:
        row = cls._get_or_create_config_row(db)
        merged = dict(DEFAULT_CLINIC_SETTINGS)
        merged.update(row.payload_json or {})
        return merged

    @classmethod
    def update_clinic_settings(
        cls,
        db: Session,
        updates: dict[str, Any],
        current_user: User | None = None,
    ) -> dict[str, Any]:
        row = cls._get_or_create_config_row(db)
        merged = dict(DEFAULT_CLINIC_SETTINGS)
        merged.update(row.payload_json or {})
        for k, v in updates.items():
            if v is not None:
                merged[k] = v
        row.payload_json = merged
        if current_user:
            row.actor_user_id = current_user.id
        db.commit()
        db.refresh(row)
        return merged

    @classmethod
    def dispatch_notification(
        cls,
        db: Session,
        *,
        patient_id: int | None,
        channel: str,
        category: str,
        title: str,
        message_body: str,
        language: str = "en",
        recipient: str | None = None,
        actor_user: User | None = None,
        doctor_id: int | None = None,
        student_id: int | None = None,
        scheduled_date: date | None = None,
        extra_payload: dict[str, Any] | None = None,
    ) -> CareAndSystemLog:
        cfg = cls.get_clinic_settings(db)
        lang = normalize_language(language)
        chan = (channel or "sms").strip().lower()
        sender_id = cfg.get("sms_sender_id", "PGIDNT")
        provider = cfg.get("sms_provider", "sandbox")

        patient: Patient | None = None
        if patient_id is not None:
            patient = db.query(Patient).filter(Patient.id == patient_id).first()

        resolved_recipient = recipient
        if not resolved_recipient and patient:
            resolved_recipient = patient.email if chan == "email" else patient.phone

        payload: dict[str, Any] = {
            "sender_id": sender_id if chan == "sms" else settings.EMAIL_FROM,
            "sms_sender_id": sender_id,
            "provider": provider,
            "recipient": resolved_recipient or "N/A",
            "category": category,
            "message_body": message_body,
        }
        if extra_payload:
            payload.update(extra_payload)

        entry = CareAndSystemLog(
            event_type="notification",
            patient_id=patient_id,
            actor_user_id=actor_user.id if actor_user else None,
            assigned_doctor_id=doctor_id or (patient.doctor_id if patient else None),
            assigned_student_id=student_id or (patient.student_id if patient else None),
            status="sent_sandbox",
            scheduled_date=scheduled_date or date.today(),
            channel=chan,
            language=lang,
            title=title,
            payload_json=payload,
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)
        return entry

    @classmethod
    def send_appointment_lifecycle_alert(
        cls,
        db: Session,
        appt: Any,
        event_kind: str,
        actor_user: User | None = None,
    ) -> list[CareAndSystemLog]:
        """Dispatch localized SMS + Email alerts on booking, reschedule, cancellation, or missed recall."""
        patient = appt.patient or db.query(Patient).filter(Patient.id == appt.patient_id).first()
        if not patient:
            return []

        lang = normalize_language(patient.preferred_language)
        doc_name = appt.doctor.full_name if getattr(appt, "doctor", None) else "PGI Dental Doctor"
        reason = getattr(appt, "cancellation_reason", None) or getattr(appt, "missed_reason", None) or getattr(appt, "reason", None)

        title, body = render_appointment_message(
            event_kind,
            lang,
            patient_name=patient.full_name,
            doctor_name=doc_name,
            appointment_date=appt.appointment_date.isoformat(),
            start_time=str(appt.start_time)[:5],
            operatory=appt.operatory,
            reason=reason,
        )

        # Include pre-appointment surgical prep if booking a surgical appointment
        if event_kind == "confirmed" and any(
            kw in (appt.appointment_type or "").lower() for kw in ("surg", "extract", "implant", "flap")
        ):
            prep = lookup_instruction("surgical_extraction_prep", lang)
            if prep:
                body = f"{body} | {prep[2]}"

        logs: list[CareAndSystemLog] = []
        logs.append(
            cls.dispatch_notification(
                db,
                patient_id=patient.id,
                channel="sms",
                category=f"appointment_{event_kind}",
                title=title,
                message_body=body,
                language=lang,
                recipient=patient.phone,
                actor_user=actor_user,
                doctor_id=appt.doctor_id,
                student_id=appt.student_id,
                scheduled_date=appt.appointment_date,
                extra_payload={"appointment_id": appt.id},
            )
        )

        cfg = cls.get_clinic_settings(db)
        if cfg.get("email_enabled", True) and patient.email:
            logs.append(
                cls.dispatch_notification(
                    db,
                    patient_id=patient.id,
                    channel="email",
                    category=f"appointment_{event_kind}",
                    title=title,
                    message_body=body,
                    language=lang,
                    recipient=patient.email,
                    actor_user=actor_user,
                    doctor_id=appt.doctor_id,
                    student_id=appt.student_id,
                    scheduled_date=appt.appointment_date,
                    extra_payload={"appointment_id": appt.id},
                )
            )
        return logs

    @classmethod
    def send_post_treatment_instruction(
        cls,
        db: Session,
        patient: Patient,
        procedure_name: str,
        custom_instructions: str | None = None,
        actor_user: User | None = None,
    ) -> CareAndSystemLog:
        """Dispatch localized post-treatment instruction alert after treatment completion or surgical log."""
        lang = normalize_language(patient.preferred_language)
        proc_lower = (procedure_name or "").lower()

        if any(k in proc_lower for k in ("flap", "disimpaction", "suture", "surgery", "surgical")):
            key = "post_oral_surgery"
        elif "extract" in proc_lower:
            key = "post_extraction"
        elif any(k in proc_lower for k in ("rct", "root canal", "pulpectomy", "endodont")):
            key = "post_rct"
        else:
            key = "post_scaling"

        looked = lookup_instruction(key, lang)
        title = looked[1] if looked else "Post-Treatment Care Instructions"
        body = looked[2] if looked else ""
        if custom_instructions:
            body = f"{body} {custom_instructions}".strip()

        return cls.dispatch_notification(
            db,
            patient_id=patient.id,
            channel="sms",
            category="post_treatment",
            title=title,
            message_body=body,
            language=lang,
            recipient=patient.phone,
            actor_user=actor_user,
            extra_payload={"procedure_name": procedure_name, "instruction_key": key},
        )

    @staticmethod
    def _existing_pending_recall(db: Session, patient_id: int, recall_type: str) -> bool:
        rows = (
            db.query(CareAndSystemLog)
            .filter(
                CareAndSystemLog.event_type == "recall",
                CareAndSystemLog.patient_id == patient_id,
                CareAndSystemLog.status == "pending",
            )
            .all()
        )
        return any((r.payload_json or {}).get("recall_type") == recall_type for r in rows)

    @classmethod
    def generate_recalls(
        cls,
        db: Session,
        current_user: User,
        patient_id: int | None = None,
    ) -> list[CareAndSystemLog]:
        """
        Auto-schedule regular 6-month check-ups and treatment-specific recalls:
        - Suture removal: 7 days
        - Crown check: 14 days
        - RCT follow-up: 30 days
        - Perio maintenance: 90 days
        - Routine check-up: 180 days
        """
        cfg = cls.get_clinic_settings(db)
        defaults = cfg.get("recall_defaults") or DEFAULT_CLINIC_SETTINGS["recall_defaults"]
        today = date.today()

        p_query = db.query(Patient).filter(Patient.is_deleted == False)
        if patient_id is not None:
            patient = verify_patient_access(db, current_user, patient_id)
            patients = [patient]
        elif current_user.role == "student":
            stu = resolve_student_for_user(db, current_user)
            if not stu:
                return []
            patients = p_query.filter(Patient.student_id == stu.id).all()
        else:
            patients = p_query.all()

        created_recalls: list[CareAndSystemLog] = []
        for pat in patients:
            lang = normalize_language(pat.preferred_language)
            records = db.query(ClinicalRecord).filter(ClinicalRecord.patient_id == pat.id).all()

            # 1. Surgical Logs -> Suture removal (7d)
            for rec in records:
                if rec.record_type == "surgical_log":
                    pjson = rec.payload_json or {}
                    suture_dt = None
                    if pjson.get("suture_removal_date"):
                        try:
                            suture_dt = date.fromisoformat(str(pjson["suture_removal_date"]))
                        except ValueError:
                            suture_dt = None
                    target_dt = suture_dt or (rec.record_date + timedelta(days=int(defaults.get("suture_removal_days", 7))))
                    if not cls._existing_pending_recall(db, pat.id, "suture_removal"):
                        r = CareAndSystemLog(
                            event_type="recall",
                            patient_id=pat.id,
                            actor_user_id=current_user.id,
                            assigned_doctor_id=pat.doctor_id,
                            assigned_student_id=pat.student_id,
                            status="pending",
                            scheduled_date=target_dt,
                            channel="sms",
                            language=lang,
                            title=f"Suture Removal Recall ({pjson.get('procedure_name', 'Oral Surgery')})",
                            payload_json={
                                "recall_type": "suture_removal",
                                "interval_days": int(defaults.get("suture_removal_days", 7)),
                                "source_record_id": rec.id,
                            },
                        )
                        db.add(r)
                        created_recalls.append(r)

                # 2. Treatment plans -> Crown check (14d) / RCT follow-up (30d)
                elif rec.record_type == "treatment_plan":
                    items = (rec.payload_json or {}).get("items", [])
                    for item in items:
                        pname = (item.get("procedure_name") or "").lower()
                        if "crown" in pname and not cls._existing_pending_recall(db, pat.id, "crown_check"):
                            days = int(defaults.get("crown_check_days", 14))
                            r = CareAndSystemLog(
                                event_type="recall",
                                patient_id=pat.id,
                                actor_user_id=current_user.id,
                                assigned_doctor_id=pat.doctor_id,
                                assigned_student_id=pat.student_id,
                                status="pending",
                                scheduled_date=today + timedelta(days=days),
                                channel="sms",
                                language=lang,
                                title="14-Day Crown & Occlusion Check Recall",
                                payload_json={"recall_type": "crown_check", "interval_days": days},
                            )
                            db.add(r)
                            created_recalls.append(r)
                        if any(k in pname for k in ("root canal", "rct", "pulpectomy")) and not cls._existing_pending_recall(
                            db, pat.id, "rct_followup"
                        ):
                            days = int(defaults.get("rct_followup_days", 30))
                            r = CareAndSystemLog(
                                event_type="recall",
                                patient_id=pat.id,
                                actor_user_id=current_user.id,
                                assigned_doctor_id=pat.doctor_id,
                                assigned_student_id=pat.student_id,
                                status="pending",
                                scheduled_date=today + timedelta(days=days),
                                channel="sms",
                                language=lang,
                                title="30-Day Root Canal Radiographic Follow-up Recall",
                                payload_json={"recall_type": "rct_followup", "interval_days": days},
                            )
                            db.add(r)
                            created_recalls.append(r)

            # 3. Periodontal Maintenance (90d)
            cats_lower = " ".join(str(c).lower() for c in (pat.disease_categories or []))
            has_perio = ("periodont" in cats_lower) or bool((pat.perio_chart_json or {}).get("teeth"))
            if has_perio and not cls._existing_pending_recall(db, pat.id, "perio_maintenance"):
                days = int(defaults.get("perio_maintenance_days", 90))
                r = CareAndSystemLog(
                    event_type="recall",
                    patient_id=pat.id,
                    actor_user_id=current_user.id,
                    assigned_doctor_id=pat.doctor_id,
                    assigned_student_id=pat.student_id,
                    status="pending",
                    scheduled_date=today + timedelta(days=days),
                    channel="sms",
                    language=lang,
                    title="90-Day Periodontal Maintenance Recall",
                    payload_json={"recall_type": "perio_maintenance", "interval_days": days},
                )
                db.add(r)
                created_recalls.append(r)

            # 4. Regular 6-month check-up (180d)
            if not cls._existing_pending_recall(db, pat.id, "routine_checkup"):
                days = int(defaults.get("routine_checkup_days", 180))
                r = CareAndSystemLog(
                    event_type="recall",
                    patient_id=pat.id,
                    actor_user_id=current_user.id,
                    assigned_doctor_id=pat.doctor_id,
                    assigned_student_id=pat.student_id,
                    status="pending",
                    scheduled_date=today + timedelta(days=days),
                    channel="sms",
                    language=lang,
                    title="6-Month Routine Dental Check-up Recall",
                    payload_json={"recall_type": "routine_checkup", "interval_days": days},
                )
                db.add(r)
                created_recalls.append(r)

        db.commit()
        for r in created_recalls:
            db.refresh(r)
        return created_recalls

    @classmethod
    def dispatch_due_recalls(
        cls,
        db: Session,
        current_user: User,
        *,
        include_upcoming: bool = False,
    ) -> dict[str, Any]:
        today = date.today()
        query = db.query(CareAndSystemLog).filter(
            CareAndSystemLog.event_type == "recall",
            CareAndSystemLog.status == "pending",
        )
        if not include_upcoming:
            query = query.filter(CareAndSystemLog.scheduled_date <= today)

        if current_user.role == "student":
            stu = resolve_student_for_user(db, current_user)
            if not stu:
                return {"dispatched_count": 0, "notification_ids": []}
            assigned_ids = [
                r[0]
                for r in db.query(Patient.id).filter(Patient.student_id == stu.id, Patient.is_deleted == False).all()
            ]
            if not assigned_ids:
                return {"dispatched_count": 0, "notification_ids": []}
            query = query.filter(CareAndSystemLog.patient_id.in_(assigned_ids))

        due_recalls = query.order_by(CareAndSystemLog.scheduled_date.asc()).all()
        notification_ids: list[int] = []
        for recall in due_recalls:
            pat = recall.patient
            if not pat:
                continue
            lang = normalize_language(recall.language or pat.preferred_language)
            doc_name = recall.assigned_doctor.full_name if recall.assigned_doctor else "PGI Dental Specialist"
            title, body = render_appointment_message(
                "recall_due",
                lang,
                patient_name=pat.full_name,
                doctor_name=doc_name,
                appointment_date=(recall.scheduled_date or today).isoformat(),
                start_time="09:30",
                operatory="PGI Dental OPD",
                recall_title=recall.title or "Dental Recall",
            )
            notif = cls.dispatch_notification(
                db,
                patient_id=pat.id,
                channel=recall.channel or "sms",
                category="recall",
                title=title,
                message_body=body,
                language=lang,
                recipient=pat.phone,
                actor_user=current_user,
                doctor_id=recall.assigned_doctor_id,
                student_id=recall.assigned_student_id,
                scheduled_date=recall.scheduled_date,
                extra_payload={"recall_id": recall.id, "recall_type": (recall.payload_json or {}).get("recall_type")},
            )
            notification_ids.append(notif.id)
            recall.status = "dispatched"
            pjson = dict(recall.payload_json or {})
            pjson["dispatched_at"] = datetime.now(UTC).isoformat()
            pjson["notification_id"] = notif.id
            recall.payload_json = pjson

        db.commit()
        return {"dispatched_count": len(notification_ids), "notification_ids": notification_ids}

    @staticmethod
    def evaluate_preventive_care(patient: Patient, language: str | None = None) -> dict[str, Any]:
        """Rules engine evaluating demographics, medical history, dental categories, and habits."""
        lang = normalize_language(language or patient.preferred_language)
        matched_rules: list[dict[str, str]] = []

        med = patient.medical_history_json or {}
        dent = patient.dental_history_json or {}
        cats = " ".join(str(c).lower() for c in (patient.disease_categories or []))
        kws = " ".join(str(k).lower() for k in (patient.case_keywords or []))
        med_conds = str(med.get("medical_conditions") or "").lower()
        habits = str(dent.get("habits") or "").lower()
        brushing = str(dent.get("brushing_frequency") or "").lower()

        def _add_rule(rule_key: str, trigger_reason: str) -> None:
            tpl = PREVENTIVE_CARE_TEMPLATES.get(rule_key)
            if not tpl:
                return
            if any(m["rule_key"] == rule_key for m in matched_rules):
                return
            matched_rules.append({
                "rule_key": rule_key,
                "reason": trigger_reason,
                "title": tpl["title"][lang],
                "message": tpl["message"][lang],
            })

        # Demographics
        if patient.age < 18 or "pediatric" in kws or "pediatric" in cats:
            _add_rule("pediatric_hygiene", f"Age {patient.age} (<18) / Pediatric Case")
        if patient.age >= 60 or "geriatric" in kws:
            _add_rule("geriatric_oral_care", f"Age {patient.age} (60+) / Geriatric Care")

        # Medical Conditions
        if "diabet" in med_conds or "diabet" in kws:
            _add_rule("diabetic_gum_care", "Medical history / keyword: Diabetes")
        if "hypertens" in med_conds or "bp" in med_conds or "hypertens" in kws:
            _add_rule("hypertension_oral_care", "Medical history / keyword: Hypertension")
        if med.get("is_pregnant") or "pregnan" in med_conds or "pregnan" in kws:
            _add_rule("pregnancy_oral_care", "Pregnancy oral health rule")

        # Dental Categories
        if "periodont" in cats or "gingiv" in cats or bool((patient.perio_chart_json or {}).get("teeth")):
            _add_rule("periodontal_maintenance", "Dental condition: Periodontitis / Gingival")
        if "caries" in cats or "restor" in cats:
            _add_rule("caries_prevention", "Dental condition: Caries & Restorative")
        if "orthodont" in cats or "malocclusion" in cats:
            _add_rule("orthodontic_care", "Dental condition: Orthodontics")

        # Habits
        if any(t in habits or t in kws for t in ("tobacco", "smok", "gutka", "khaini", "paan")):
            _add_rule("tobacco_cessation", "Habit: Tobacco / Smoking")
        if any(b in habits or b in kws for b in ("bruxism", "grind", "clench")):
            _add_rule("bruxism_nightguard", "Habit: Bruxism / Grinding")
        if any(br in brushing for br in ("once", "irregular", "rare", "never")):
            _add_rule("brushing_hygiene", f"Brushing habit: {dent.get('brushing_frequency')}")

        if not matched_rules:
            _add_rule("brushing_hygiene", "General preventive oral health maintenance")
            _add_rule("caries_prevention", "General enamel protection guidance")

        combined_message = " ".join(m["message"] for m in matched_rules)
        titles = ", ".join(r["title"] for r in matched_rules[:2])
        return {
            "patient_id": patient.id,
            "patient_name": patient.full_name,
            "cr_number": patient.cr_number,
            "language": lang,
            "matched_rules": matched_rules,
            "matched_factors": [r["reason"] for r in matched_rules],
            "title": f"Preventive Care: {titles}",
            "message_body": combined_message,
            "combined_message": combined_message,
        }

    @classmethod
    def send_preventive_care(
        cls,
        db: Session,
        patient: Patient,
        *,
        language: str | None = None,
        channel: str = "sms",
        custom_message: str | None = None,
        actor_user: User | None = None,
    ) -> dict[str, Any]:
        preview = cls.evaluate_preventive_care(patient, language=language)
        titles = ", ".join(r["title"] for r in preview["matched_rules"][:2])
        msg_body = custom_message.strip() if custom_message else preview["combined_message"]
        notif = cls.dispatch_notification(
            db,
            patient_id=patient.id,
            channel=channel,
            category="preventive_care",
            title=f"Preventive Oral Care: {titles}",
            message_body=msg_body,
            language=preview["language"],
            actor_user=actor_user,
            extra_payload={"rule_keys": [r["rule_key"] for r in preview["matched_rules"]]},
        )
        return {
            "notification_id": notif.id,
            "status": notif.status,
            "message": "Preventive care guidance dispatched.",
            **preview,
        }

    @staticmethod
    def list_logs(
        db: Session,
        current_user: User,
        *,
        event_type: str = "notification",
        patient_id: int | None = None,
        status_filter: str | None = None,
    ) -> list[CareAndSystemLog]:
        if current_user.role in ("receptionist", "patient"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "FORBIDDEN", "message": "Access to notification logs is restricted."},
            )
        query = db.query(CareAndSystemLog).filter(CareAndSystemLog.event_type == event_type)
        if current_user.role == "student":
            stu = resolve_student_for_user(db, current_user)
            if not stu:
                return []
            assigned_ids = [
                r[0]
                for r in db.query(Patient.id).filter(Patient.student_id == stu.id, Patient.is_deleted == False).all()
            ]
            if not assigned_ids:
                return []
            query = query.filter(CareAndSystemLog.patient_id.in_(assigned_ids))
        if patient_id is not None:
            verify_patient_access(db, current_user, patient_id)
            query = query.filter(CareAndSystemLog.patient_id == patient_id)
        if status_filter:
            query = query.filter(CareAndSystemLog.status == status_filter)
        return query.order_by(desc(CareAndSystemLog.created_at), desc(CareAndSystemLog.id)).all()
