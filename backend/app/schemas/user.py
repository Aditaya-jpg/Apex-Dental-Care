from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class DentistProfileBase(BaseModel):
    license_number: str
    specialization: str = "General Dentistry"
    qualifications: str | None = None
    department: str | None = None
    cabin_number: str | None = None
    cabin_operatory: str | None = None
    is_admin: bool = False
    is_active: bool = True


class DentistProfileCreate(DentistProfileBase):
    pass


class DentistProfileResponse(DentistProfileBase):
    id: int
    user_id: int | None = None
    model_config = ConfigDict(from_attributes=True)


class UserBase(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=50)
    full_name: str = Field(min_length=2, max_length=150)
    role: str = Field(default="patient")  # admin, doctor, student, receptionist, patient
    phone: str | None = None
    patient_id: int | None = None
    doctor_id: int | None = None
    student_id: int | None = None
    is_active: bool = True
    is_admin: bool = False


class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=50)
    full_name: str = Field(min_length=2, max_length=150)
    role: str = Field(default="receptionist")
    phone: str | None = None
    is_active: bool = True
    password: str = Field(min_length=8)
    dentist_profile: DentistProfileCreate | None = None


class UserUpdate(BaseModel):
    email: EmailStr | None = None
    full_name: str | None = None
    phone: str | None = None
    role: str | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=8)
    dentist_profile: DentistProfileCreate | None = None


class UserResponse(UserBase):
    id: int
    created_at: datetime
    doctor_profile: DentistProfileResponse | None = None
    dentist_profile: DentistProfileResponse | None = None
    model_config = ConfigDict(from_attributes=True)
