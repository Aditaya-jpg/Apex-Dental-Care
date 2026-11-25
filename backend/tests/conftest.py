import os
import shutil
import sys
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.database import Base, get_db
from app.main import app
from app.storage.file_storage import LocalEncryptedStorageBackend, file_storage
from seeds.seed_data import seed_database

TEST_DATABASE_URL = "sqlite:///./test_dental.db"
test_engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})


@event.listens_for(test_engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    tmp_vault = tempfile.mkdtemp(prefix="pgi_test_vault_")
    orig_vault_dir = getattr(file_storage, "vault_dir", None)
    if isinstance(file_storage, LocalEncryptedStorageBackend):
        file_storage.vault_dir = Path(tmp_vault).resolve()

    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()
    try:
        seed_database(db=db)
    finally:
        db.close()

    yield

    Base.metadata.drop_all(bind=test_engine)
    if orig_vault_dir is not None and isinstance(file_storage, LocalEncryptedStorageBackend):
        file_storage.vault_dir = orig_vault_dir
    shutil.rmtree(tmp_vault, ignore_errors=True)
    if os.path.exists("./test_dental.db"):
        try:
            os.remove("./test_dental.db")
        except Exception:
            pass


@pytest.fixture
def db_session():
    connection = test_engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def _login_token(client: TestClient, email: str, password: str = "Dental@123") -> str:
    res = client.post("/api/v1/auth/login", json={"username_or_email": email, "password": password})
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


@pytest.fixture
def admin_token(client):
    return _login_token(client, "admin@pgi.edu.in")


@pytest.fixture
def admin_doctor_token(client):
    return _login_token(client, "dr.mehta@pgi.edu.in")


@pytest.fixture
def doctor_token(client):
    return _login_token(client, "dr.sharma@pgi.edu.in")


@pytest.fixture
def dentist_token(client):
    return _login_token(client, "dr.mehta@pgi.edu.in")


@pytest.fixture
def student1_token(client):
    return _login_token(client, "student1@pgi.edu.in")


@pytest.fixture
def student2_token(client):
    return _login_token(client, "student2@pgi.edu.in")


@pytest.fixture
def receptionist_token(client):
    return _login_token(client, "reception@pgi.edu.in")


@pytest.fixture
def patient_token(client):
    return _login_token(client, "patient@pgi.edu.in")
