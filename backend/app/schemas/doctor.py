from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class DoctorCreate(BaseModel):
    doctor_name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    phone_number: str | None = None
    qualification: str | None = None
    specialization: str = "General Dentistry"
    registration_number: str = Field(..., min_length=2, max_length=100)
    account_status: str = "active"


class DoctorUpdate(BaseModel):
    doctor_name: str | None = None
    email: EmailStr | None = None
    phone_number: str | None = None
    qualification: str | None = None
    specialization: str | None = None
    registration_number: str | None = None
    password: str | None = None
    account_status: str | None = None


class DoctorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    doctor_name: str
    email: str
    phone_number: str | None = None
    qualification: str | None = None
    specialization: str
    registration_number: str
    account_status: str
    created_at: datetime
    students_count: int = 0
    patients_count: int = 0
