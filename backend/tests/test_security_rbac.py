def test_receptionist_cannot_modify_tooth_condition(client, receptionist_token):
    payload = {"tooth_number": 11, "condition": "caries"}
    res = client.post("/api/v1/dental-chart/1/tooth", json=payload, headers={"Authorization": f"Bearer {receptionist_token}"})
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "FORBIDDEN_ROLE"


def test_receptionist_cannot_create_prescription(client, receptionist_token):
    payload = {
        "patient_id": 1,
        "doctor_id": 1,
        "items": [{"medicine_name": "Amoxicillin", "dosage": "500mg", "frequency": "1-0-1", "duration": "5d"}],
    }
    res = client.post("/api/v1/prescriptions", json=payload, headers={"Authorization": f"Bearer {receptionist_token}"})
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "FORBIDDEN_ROLE"


def test_receptionist_cannot_access_audit_logs_or_patients(client, receptionist_token):
    assert client.get("/api/v1/audit-logs", headers={"Authorization": f"Bearer {receptionist_token}"}).status_code == 403
    assert client.get("/api/v1/patients", headers={"Authorization": f"Bearer {receptionist_token}"}).status_code == 403
    assert client.get("/api/v1/patients/1", headers={"Authorization": f"Bearer {receptionist_token}"}).status_code == 403


def test_doctor_cannot_create_users(client, doctor_token):
    payload = {
        "email": "hacker@pgi.edu.in",
        "username": "hacker",
        "password": "Password123!",
        "full_name": "Intruder",
        "role": "admin",
    }
    res = client.post("/api/v1/users", json=payload, headers={"Authorization": f"Bearer {doctor_token}"})
    assert res.status_code == 403


def test_unauthenticated_access_denied(client):
    res = client.get("/api/v1/patients")
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "UNAUTHORIZED"


def test_sql_injection_payload_in_search(client, doctor_token):
    sqli = "' OR '1'='1"
    res = client.get(f"/api/v1/patients?search={sqli}", headers={"Authorization": f"Bearer {doctor_token}"})
    assert res.status_code == 200
    assert res.json()["total"] == 0
