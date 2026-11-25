from decimal import Decimal

from pydantic import BaseModel


class DashboardSummaryResponse(BaseModel):
    total_patients: int
    new_patients_period: int
    today_appointments: int
    upcoming_appointments: int
    pending_treatments: int
    completed_treatments: int
    total_revenue: Decimal = Decimal('0.00')
    outstanding_payments: Decimal = Decimal('0.00')
    followups_due: int

class StatusCount(BaseModel):
    status: str
    count: int

class ProcedureCount(BaseModel):
    procedure_name: str
    count: int

class RevenueTrendPoint(BaseModel):
    date: str
    revenue: Decimal = Decimal('0.00')
    invoiced: Decimal = Decimal('0.00')

class PatientTrendPoint(BaseModel):
    date: str
    new_patients: int

class DashboardAnalyticsResponse(BaseModel):
    appointments_by_status: list[StatusCount]
    treatments_by_procedure: list[ProcedureCount]
    revenue_trend: list[RevenueTrendPoint] = []
    patients_trend: list[PatientTrendPoint]


class DoctorPatientCount(BaseModel):
    doctor_id: int
    doctor_name: str
    specialization: str
    student_count: int
    patient_count: int


class StudentPatientCount(BaseModel):
    student_id: int
    student_name: str
    doctor_name: str
    enrollment_number: str
    patient_count: int


class RecentRegistrationItem(BaseModel):
    entity_type: str
    id: int
    name: str
    code_or_email: str
    created_at: str


class AdminDashboardResponse(BaseModel):
    total_doctors: int
    total_students: int
    total_patients: int
    doctor_wise_patients: list[DoctorPatientCount]
    student_wise_patients: list[StudentPatientCount]
    recent_registrations: list[RecentRegistrationItem]


class DoctorDashboardResponse(BaseModel):
    doctor_id: int
    doctor_name: str
    my_students_count: int
    my_patients_count: int
    direct_patients_count: int
    assigned_patients_count: int
    my_students: list[dict]
    recent_patients: list[dict]
    pending_followups: list[dict]


class StudentDashboardResponse(BaseModel):
    student_id: int
    student_name: str
    doctor_name: str
    my_patients_count: int
    my_patients: list[dict]
    recent_patients: list[dict]
    pending_records_count: int
    upcoming_appointments: list[dict]
