from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException, Request, status
from sqlalchemy.orm import Session

from app.audit.service import log_audit_event
from app.constants import FDI_PERMANENT_TEETH
from app.models.patient import Patient
from app.models.user import User
from app.schemas.dental_chart import (
    DentalChartDetailResponse,
    PerioChartResponse,
    PerioChartUpdate,
    ToothConditionResponse,
    ToothConditionUpdate,
    ToothHistoryResponse,
)
from app.security.dependencies import resolve_doctor_for_user, verify_patient_access


def _parse_dt(val: str | None) -> datetime:
    if val:
        try:
            return datetime.fromisoformat(val)
        except Exception:
            pass
    return datetime.now(UTC)


class DentalChartService:
    @staticmethod
    def _ensure_chart_dict(patient: Patient) -> dict[str, Any]:
        chart = dict(patient.dental_chart_json or {})
        teeth = dict(chart.get("teeth") or {})
        history = list(chart.get("history") or [])
        now_iso = datetime.now(UTC).isoformat()

        changed = False
        for idx, t_num in enumerate(sorted(FDI_PERMANENT_TEETH), start=1):
            key = str(t_num)
            if key not in teeth:
                teeth[key] = {
                    "id": idx,
                    "tooth_number": t_num,
                    "current_condition": "healthy",
                    "severity": "none",
                    "surfaces": None,
                    "notes": None,
                    "updated_at": now_iso,
                }
                changed = True

        chart["teeth"] = teeth
        chart["history"] = history
        if changed:
            patient.dental_chart_json = chart
        return chart

    @classmethod
    def get_full_chart_details(
        cls,
        db: Session,
        patient_id: int,
        current_user: User,
    ) -> DentalChartDetailResponse:
        patient = verify_patient_access(db, current_user, patient_id)
        had_missing = len((patient.dental_chart_json or {}).get("teeth", {})) < len(FDI_PERMANENT_TEETH)
        chart = cls._ensure_chart_dict(patient)
        if had_missing:
            db.commit()
            db.refresh(patient)

        teeth_dict: dict[int, ToothConditionResponse] = {}
        for key, entry in chart["teeth"].items():
            t_num = int(key)
            teeth_dict[t_num] = ToothConditionResponse(
                id=int(entry.get("id", t_num)),
                patient_id=patient.id,
                tooth_number=t_num,
                current_condition=entry.get("current_condition", "healthy"),
                severity=entry.get("severity", "none"),
                surfaces=entry.get("surfaces"),
                notes=entry.get("notes"),
                updated_at=_parse_dt(entry.get("updated_at")),
            )

        history_list: list[ToothHistoryResponse] = []
        for idx, h in enumerate(reversed(chart["history"]), start=1):
            history_list.append(
                ToothHistoryResponse(
                    id=h.get("id", idx),
                    patient_id=patient.id,
                    visit_id=h.get("visit_id"),
                    doctor_id=h.get("doctor_id"),
                    dentist_id=h.get("doctor_id"),
                    doctor_name=h.get("doctor_name"),
                    dentist_name=h.get("doctor_name"),
                    tooth_number=int(h["tooth_number"]),
                    condition=h["condition"],
                    severity=h.get("severity"),
                    surfaces=h.get("surfaces"),
                    notes=h.get("notes"),
                    created_at=_parse_dt(h.get("created_at")),
                )
            )

        return DentalChartDetailResponse(patient_id=patient.id, teeth=teeth_dict, history=history_list)

    @classmethod
    def update_tooth_condition(
        cls,
        db: Session,
        patient_id: int,
        data: ToothConditionUpdate,
        current_user: User,
        request: Request | None = None,
    ) -> ToothConditionResponse:
        patient = verify_patient_access(db, current_user, patient_id, require_write=True)

        if data.tooth_number not in FDI_PERMANENT_TEETH:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_TOOTH", "message": f"Tooth {data.tooth_number} is not a valid FDI permanent tooth."},
            )

        doc = resolve_doctor_for_user(db, current_user)
        doc_id = doc.id if doc else patient.doctor_id
        actor_name = doc.full_name if doc else current_user.full_name

        chart = cls._ensure_chart_dict(patient)
        now = datetime.now(UTC)
        now_iso = now.isoformat()
        key = str(data.tooth_number)

        existing_entry = dict(chart["teeth"].get(key) or {})
        entry_id = int(existing_entry.get("id", data.tooth_number))
        chart["teeth"][key] = {
            "id": entry_id,
            "tooth_number": data.tooth_number,
            "current_condition": data.condition,
            "severity": data.severity or "none",
            "surfaces": data.surfaces,
            "notes": data.notes,
            "updated_at": now_iso,
        }

        history = list(chart.get("history") or [])
        history.append({
            "id": len(history) + 1,
            "visit_id": data.visit_id,
            "doctor_id": doc_id,
            "doctor_name": actor_name,
            "tooth_number": data.tooth_number,
            "condition": data.condition,
            "severity": data.severity,
            "surfaces": data.surfaces,
            "notes": data.notes,
            "created_at": now_iso,
        })
        chart["history"] = history
        patient.dental_chart_json = chart

        db.commit()
        db.refresh(patient)

        log_audit_event(
            db=db,
            action="TOOTH_UPDATE",
            user=current_user,
            entity_name="ToothCondition",
            entity_id=f"{patient_id}-{data.tooth_number}",
            patient_id=patient.id,
            details={"condition": data.condition, "severity": data.severity, "surfaces": data.surfaces},
            request=request,
        )

        return ToothConditionResponse(
            id=entry_id,
            patient_id=patient.id,
            tooth_number=data.tooth_number,
            current_condition=data.condition,
            severity=data.severity or "none",
            surfaces=data.surfaces,
            notes=data.notes,
            updated_at=now,
        )

    @classmethod
    def get_tooth_history(
        cls,
        db: Session,
        patient_id: int,
        tooth_number: int,
        current_user: User,
    ) -> list[ToothHistoryResponse]:
        patient = verify_patient_access(db, current_user, patient_id)
        chart = cls._ensure_chart_dict(patient)
        records = [h for h in chart["history"] if int(h.get("tooth_number", 0)) == tooth_number]
        records.reverse()
        return [
            ToothHistoryResponse(
                id=h.get("id", idx),
                patient_id=patient.id,
                visit_id=h.get("visit_id"),
                doctor_id=h.get("doctor_id"),
                dentist_id=h.get("doctor_id"),
                doctor_name=h.get("doctor_name"),
                dentist_name=h.get("doctor_name"),
                tooth_number=int(h["tooth_number"]),
                condition=h["condition"],
                severity=h.get("severity"),
                surfaces=h.get("surfaces"),
                notes=h.get("notes"),
                created_at=_parse_dt(h.get("created_at")),
            )
            for idx, h in enumerate(records, start=1)
        ]

    @staticmethod
    def _compute_perio_summary(teeth_data: dict[str, Any]) -> dict[str, Any]:
        depths: list[int] = []
        bop_sites = 0
        total_sites = 0
        deep_pockets = 0
        for tooth_info in teeth_data.values():
            sites = tooth_info.get("sites") or {}
            for val in sites.values():
                if isinstance(val, (int, float)):
                    depths.append(int(val))
                    if val >= 4:
                        deep_pockets += 1
            bop = tooth_info.get("bop") or {}
            for flag in bop.values():
                total_sites += 1
                if flag:
                    bop_sites += 1

        mean_ppd = round(sum(depths) / len(depths), 2) if depths else 0.0
        bop_pct = round((bop_sites / total_sites) * 100, 1) if total_sites else 0.0
        return {
            "mean_ppd": mean_ppd,
            "max_ppd": max(depths) if depths else 0,
            "bop_percentage": bop_pct,
            "deep_pockets_ge_4mm": deep_pockets,
        }

    @classmethod
    def get_perio_chart(cls, db: Session, patient_id: int, current_user: User) -> PerioChartResponse:
        patient = verify_patient_access(db, current_user, patient_id)
        perio = dict(patient.perio_chart_json or {})
        teeth = perio.get("teeth") or {}
        return PerioChartResponse(
            patient_id=patient.id,
            teeth=teeth,
            snapshots=perio.get("snapshots") or [],
            summary=perio.get("summary") or cls._compute_perio_summary(teeth),
            updated_at=perio.get("updated_at"),
        )

    @classmethod
    def update_perio_chart(
        cls,
        db: Session,
        patient_id: int,
        data: PerioChartUpdate,
        current_user: User,
        request: Request | None = None,
    ) -> PerioChartResponse:
        patient = verify_patient_access(db, current_user, patient_id, require_write=True)
        now_iso = datetime.now(UTC).isoformat()
        existing = dict(patient.perio_chart_json or {})
        snapshots = list(existing.get("snapshots") or [])
        summary = cls._compute_perio_summary(data.teeth)

        snapshots.append({
            "recorded_at": now_iso,
            "recorded_by": current_user.full_name,
            "plaque_index": data.plaque_index,
            "notes": data.notes,
            "summary": summary,
        })
        new_perio = {
            "teeth": data.teeth,
            "snapshots": snapshots[-20:],
            "summary": summary,
            "plaque_index": data.plaque_index,
            "notes": data.notes,
            "updated_at": now_iso,
        }
        patient.perio_chart_json = new_perio
        db.commit()
        db.refresh(patient)

        log_audit_event(
            db=db,
            action="PERIO_CHART_UPDATE",
            user=current_user,
            entity_name="Patient",
            entity_id=str(patient.id),
            patient_id=patient.id,
            details=summary,
            request=request,
        )

        return PerioChartResponse(
            patient_id=patient.id,
            teeth=new_perio["teeth"],
            snapshots=new_perio["snapshots"],
            summary=summary,
            updated_at=now_iso,
        )
