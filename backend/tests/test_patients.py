def test_list_patients_doctor_sees_all(client, doctor_token):
    res = client.get("/api/v1/patients", headers={"Authorization": f"Bearer {doctor_token}"})
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert data["total"] >= 16


def test_search_patients(client, doctor_token):
    res = client.get("/api/v1/patients?search=Aarav", headers={"Authorization": f"Bearer {doctor_token}"})
    assert res.status_code == 200
    items = res.json()["items"]
    assert any(p["first_name"] == "Aarav" for p in items)


def test_create_patient_by_doctor_and_student(client, doctor_token, student1_token):
    payload = {
        "first_name": "Kunal",
        "last_name": "Sharma",
        "date_of_birth": "1990-01-11",
        "gender": "Male",
        "phone": "+91 98765 99999",
        "email": "kunal.sharma@example.in",
        "address": "Sector 14, Chandigarh",
        "blood_group": "A+",
        "preferred_language": "hi",
        "medical_history": {
            "allergies": "None",
            "medical_conditions": "None",
            "bleeding_disorders": False,
        },
        "dental_history": {
            "chief_complaint": "Regular cleaning",
            "brushing_frequency": "Twice daily",
        },
    }
    res = client.post("/api/v1/patients", json=payload, headers={"Authorization": f"Bearer {doctor_token}"})
    assert res.status_code == 201
    data = res.json()
    assert data["first_name"] == "Kunal"
    assert data["patient_code"].startswith("P-")
    assert data["cr_number"].startswith("PGI-CR-")
    assert data["medical_history"]["allergies"] == "None"

    # Student registers new patient -> auto-linked to student
    stu_payload = {
        **payload,
        "first_name": "Simran",
        "phone": "+91 98765 88888",
        "email": "simran.p@example.in",
    }
    res2 = client.post("/api/v1/patients", json=stu_payload, headers={"Authorization": f"Bearer {student1_token}"})
    assert res2.status_code == 201
    data2 = res2.json()
    assert data2["student_id"] is not None
    assert data2["student_name"] == "Rohan Malhotra"


def test_get_patient_timeline(client, doctor_token):
    res = client.get("/api/v1/patients/1/timeline", headers={"Authorization": f"Bearer {doctor_token}"})
    assert res.status_code == 200
    timeline = res.json()
    assert isinstance(timeline, list)
    assert len(timeline) > 0
    assert all(ev["type"] != "invoice" for ev in timeline)
