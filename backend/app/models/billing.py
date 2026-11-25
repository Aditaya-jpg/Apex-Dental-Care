from datetime import date, datetime, UTC
from decimal import Decimal

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String(50), unique=True, nullable=False, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False, index=True)
    visit_id = Column(Integer, ForeignKey("visits.id", ondelete="SET NULL"), nullable=True)
    treatment_plan_id = Column(Integer, ForeignKey("treatment_plans.id", ondelete="SET NULL"), nullable=True)

    issue_date = Column(Date, default=date.today, nullable=False)
    due_date = Column(Date, nullable=False)

    subtotal = Column(Numeric(10, 2), default=Decimal('0.00'), nullable=False)
    discount = Column(Numeric(10, 2), default=Decimal('0.00'), nullable=False)
    tax = Column(Numeric(10, 2), default=Decimal('0.00'), nullable=False)
    total = Column(Numeric(10, 2), default=Decimal('0.00'), nullable=False)
    paid_amount = Column(Numeric(10, 2), default=Decimal('0.00'), nullable=False)
    balance = Column(Numeric(10, 2), default=Decimal('0.00'), nullable=False)

    status = Column(String(50), default="unpaid", nullable=False, index=True) # unpaid, partially_paid, paid, voided
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC), nullable=False)

    patient = relationship("Patient", back_populates="invoices")
    visit = relationship("Visit", back_populates="invoices")
    treatment_plan = relationship("TreatmentPlan")
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")


class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    description = Column(String(255), nullable=False)
    unit_price = Column(Numeric(10, 2), default=Decimal('0.00'), nullable=False)
    quantity = Column(Integer, default=1, nullable=False)
    total = Column(Numeric(10, 2), default=Decimal('0.00'), nullable=False)

    invoice = relationship("Invoice", back_populates="items")
