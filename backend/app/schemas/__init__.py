from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentMissedCreate,
    AppointmentResponse,
    AppointmentStatusUpdate,
    AppointmentTypeResponse,
    AppointmentUpdate,
)
from app.schemas.audit import AuditLogResponse
from app.schemas.auth import (
    LoginRequest,
    PasswordChangeRequest,
    RefreshTokenRequest,
    TokenResponse,
)
from app.schemas.clinical import VisitCreate, VisitResponse, VisitUpdate
from app.schemas.common import (
    ErrorDetail,
    ErrorResponse,
    MessageResponse,
    PaginatedResponse,
)
from app.schemas.dashboard import (
    AdminDashboardResponse,
    DashboardAnalyticsResponse,
    DashboardSummaryResponse,
    DoctorDashboardResponse,
    StudentDashboardResponse,
)
from app.schemas.dental_chart import (
    DentalChartDetailResponse,
    PerioChartResponse,
    PerioChartUpdate,
    ToothConditionResponse,
    ToothConditionUpdate,
    ToothHistoryResponse,
)
from app.schemas.doctor import DoctorCreate, DoctorResponse, DoctorUpdate
from app.schemas.document import DocumentResponse, DocumentShareUpdate, DocumentUpdate
from app.schemas.followup import FollowUpCreate, FollowUpResponse, FollowUpUpdate
from app.schemas.patient import (
    DentalHistoryBase,
    DentalHistoryResponse,
    MedicalHistoryBase,
    MedicalHistoryResponse,
    PatientCreate,
    PatientDetailResponse,
    PatientListItem,
    PatientSeverityUpdate,
    PatientUpdate,
)
from app.schemas.prescription import (
    MedicineCatalogResponse,
    PrescriptionCreate,
    PrescriptionItemCreate,
    PrescriptionItemResponse,
    PrescriptionResponse,
)
from app.schemas.student import StudentCreate, StudentResponse, StudentUpdate
from app.schemas.treatment import (
    ProcedureCatalogResponse,
    TreatmentItemCreate,
    TreatmentItemResponse,
    TreatmentItemUpdate,
    TreatmentPlanCreate,
    TreatmentPlanResponse,
    TreatmentPlanUpdate,
)
from app.schemas.user import (
    DentistProfileCreate,
    DentistProfileResponse,
    UserCreate,
    UserResponse,
    UserUpdate,
)
