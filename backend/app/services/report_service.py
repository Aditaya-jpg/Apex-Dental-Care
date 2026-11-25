import csv
import io
from datetime import date
from typing import Any

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models.billing import Invoice


class ReportService:
    @staticmethod
    def get_revenue_report(
        db: Session,
        start_date: date | None = None,
        end_date: date | None = None
    ) -> list[dict[str, Any]]:
        query = db.query(Invoice)
        if start_date:
            query = query.filter(Invoice.issue_date >= start_date)
        if end_date:
            query = query.filter(Invoice.issue_date <= end_date)

        invoices = query.order_by(desc(Invoice.issue_date)).all()
        return [
            {
                "invoice_id": inv.id,
                "invoice_number": inv.invoice_number,
                "patient_name": inv.patient.full_name if inv.patient else "",
                "amount": float(inv.total),
                "status": inv.status,
                "due_date": inv.due_date.isoformat(),
                "date": inv.issue_date.isoformat()
            }
            for inv in invoices
        ]

    @staticmethod
    def get_outstanding_report(db: Session) -> list[dict[str, Any]]:
        invoices = db.query(Invoice).filter(
            Invoice.status.in_(["unpaid", "partially_paid"])
        ).order_by(desc(Invoice.balance)).all()

        return [
            {
                "invoice_id": inv.id,
                "invoice_number": inv.invoice_number,
                "patient_name": inv.patient.full_name if inv.patient else "",
                "patient_phone": inv.patient.phone if inv.patient else "",
                "total": float(inv.total),
                "paid": float(inv.paid_amount),
                "balance": float(inv.balance),
                "due_date": inv.due_date.isoformat(),
                "status": inv.status
            }
            for inv in invoices
        ]

    @staticmethod
    def export_csv(headers: list[str], rows: list[list[Any]]) -> str:
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(headers)
        writer.writerows(rows)
        return output.getvalue()
