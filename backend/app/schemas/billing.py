from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class InvoiceItemCreate(BaseModel):
    description: str
    unit_price: Decimal = Field(ge=0)
    quantity: int = Field(default=1, ge=1)

class InvoiceItemResponse(BaseModel):
    id: int
    invoice_id: int
    description: str
    unit_price: Decimal
    quantity: int
    total: Decimal
    model_config = ConfigDict(from_attributes=True)

class InvoiceCreate(BaseModel):
    patient_id: int
    visit_id: int | None = None
    treatment_plan_id: int | None = None
    due_date: date
    discount: Decimal = Field(default=Decimal('0.00'), ge=0)
    tax: Decimal = Field(default=Decimal('0.00'), ge=0)
    notes: str | None = None
    items: list[InvoiceItemCreate] = Field(min_length=1)

class InvoiceResponse(BaseModel):
    id: int
    invoice_number: str
    patient_id: int
    visit_id: int | None = None
    treatment_plan_id: int | None = None
    issue_date: date
    due_date: date
    subtotal: Decimal
    discount: Decimal
    tax: Decimal
    total: Decimal
    paid_amount: Decimal = Decimal('0.00')
    balance: Decimal
    status: str
    notes: str | None = None
    created_at: datetime
    patient_name: str | None = None
    items: list[InvoiceItemResponse] = []
    model_config = ConfigDict(from_attributes=True)
