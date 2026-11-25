import os
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(BASE_DIR.parent / ".env"), str(BASE_DIR / ".env"), ".env"),
        extra="ignore",
    )

    APP_NAME: str = "PGI Dental Management System"
    ENVIRONMENT: str = Field(default="development")
    DEBUG: bool = True

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    API_PREFIX: str = "/api/v1"

    # Database
    # Default is SQLite inside backend/ for seamless local dev & viva demo; override with MySQL 8.0 in production:
    # mysql+pymysql://dental_user:dental_pass@localhost:3306/dental_db
    DATABASE_URL: str = Field(default=f"sqlite:///{(BASE_DIR / 'dental.db').as_posix()}")
    DB_ECHO: bool = False

    # JWT Secrets
    JWT_SECRET_KEY: str = Field(default="pgi-dental-insecure-secret-key-change-in-prod-token-98472918")
    JWT_REFRESH_SECRET_KEY: str = Field(default="pgi-dental-insecure-refresh-key-change-in-prod-91823719")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Security & CORS
    CORS_ORIGINS: str | list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    # Encrypted File Vault Storage
    STORAGE_TYPE: str = Field(default="local_encrypted")  # local_encrypted or s3
    UPLOAD_DIR: str = Field(default=str(BASE_DIR / "uploads"))
    VAULT_DIR: str = Field(default=str(BASE_DIR / "uploads" / "vault"))
    FILE_ENCRYPTION_KEY: str = Field(default="")
    MAX_UPLOAD_SIZE_MB: int = 25
    MAX_CBCT_SIZE_MB: int = 500
    ALLOWED_EXTENSIONS: list[str] = [
        "png", "jpg", "jpeg", "webp", "bmp", "tif", "tiff",
        "pdf",
        "dcm", "dicom", "nii", "nii.gz", "zip", "rar", "glb", "stl", "obj",
    ]
    BLOCKED_EXTENSIONS: list[str] = [
        "exe", "sh", "bat", "cmd", "ps1", "html", "htm", "js", "mjs", "svg", "php", "py", "dll", "so",
    ]
    ALLOWED_MIME_TYPES: list[str] = [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/bmp",
        "image/tiff",
        "application/dicom",
        "application/zip",
        "application/x-rar-compressed",
        "application/vnd.rar",
        "application/gzip",
        "application/x-gzip",
        "model/gltf-binary",
        "model/stl",
        "model/obj",
        "application/octet-stream",
    ]

    # S3 / MinIO Upgrade Hook Settings (for STORAGE_TYPE=s3)
    S3_BUCKET: str = ""
    S3_REGION: str = "ap-south-1"
    S3_ENDPOINT_URL: str = ""
    S3_ACCESS_KEY_ID: str = ""
    S3_SECRET_ACCESS_KEY: str = ""

    # PGI Dental Branch Details for PDFs & Patient Communications
    CLINIC_NAME: str = "PGI Dental Branch — Oral Health Sciences Centre"
    CLINIC_ADDRESS: str = "Oral Health Sciences Centre, PGIMER, Sector 12, Chandigarh 160012"
    CLINIC_PHONE: str = "+91 172 275 6831 / +91 172 274 7585"
    CLINIC_EMAIL: str = "dental@pgimer.edu.in"
    CLINIC_WEBSITE: str = "pgimer.edu.in"
    CLINIC_REG_NO: str = "PGIMER-OHSC-CHD | DCI-INST-012"

    # SMS & Email Notification Settings
    SMS_SENDER_ID: str = "PGIDNT"
    SMS_PROVIDER: str = "sandbox"  # sandbox | twilio | msg91
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAIL_FROM: str = "dental@pgimer.edu.in"

    # Google Calendar OAuth Integration
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/v1/integrations/google/callback"

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v):
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        return v


settings = Settings()

# Ensure upload and encrypted vault directories exist
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.VAULT_DIR, exist_ok=True)
