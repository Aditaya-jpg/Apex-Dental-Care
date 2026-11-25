from datetime import date, timedelta


def test_list_appointments(client, doctor_token):
    res = client.get("/api/v1/appointments", headers={"Authorization": f"Bearer {doctor_token}"})
    assert res.status_code == 200
    assert isinstance(res.json(), list)
    assert len(res.json()) > 0


def test_create_appointment_and_conflict_detection(client, doctor_token):
    target_date = (date.today() + timedelta(days=20)).isoformat()

    # 1. Schedule appointment 10:00 - 10:45 with doctor 1 in Operatory 1
    res1 = client.post(
        "/api/v1/appointments",
        json={
            "patient_id": 1,
            "doctor_id": 1,
            "operatory": "Operatory 1",
            "appointment_type": "Routine Checkup & Consultation",
            "appointment_date": target_date,
            "start_time": "10:00:00",
            "end_time": "10:45:00",
            "reason": "Test Consultation",
        },
        headers={"Authorization": f"Bearer {doctor_token}"},
    )
    assert res1.status_code == 201

    # 2. Try booking overlapping appointment with SAME doctor (10:15 - 11:00)
    res2 = client.post(
        "/api/v1/appointments",
        json={
            "patient_id": 2,
            "doctor_id": 1,
            "operatory": "Operatory 2",
            "appointment_type": "Routine Checkup & Consultation",
            "appointment_date": target_date,
            "start_time": "10:15:00",
            "end_time": "11:00:00",
            "reason": "Conflicting Doctor Consultation",
        },
        headers={"Authorization": f"Bearer {doctor_token}"},
    )
    assert res2.status_code == 409
    assert res2.json()["error"]["code"] == "APPOINTMENT_CONFLICT"

    # 3. Try booking overlapping appointment with DIFFERENT doctor in SAME operatory
    res3 = client.post(
        "/api/v1/appointments",
        json={
            "patient_id": 2,
            "doctor_id": 2,
            "operatory": "Operatory 1",
            "appointment_type": "Routine Checkup & Consultation",
            "appointment_date": target_date,
            "start_time": "10:15:00",
            "end_time": "11:00:00",
            "reason": "Conflicting Operatory",
        },
        headers={"Authorization": f"Bearer {doctor_token}"},
    )
    assert res3.status_code == 409
    assert res3.json()["error"]["code"] == "APPOINTMENT_CONFLICT"


def test_update_appointment_status(client, doctor_token):
    target_date = (date.today() + timedelta(days=22)).isoformat()
    res = client.post(
        "/api/v1/appointments",
        json={
            "patient_id": 2,
            "doctor_id": 2,
            "operatory": "Operatory 3",
            "appointment_date": target_date,
            "start_time": "14:00:00",
            "end_time": "14:30:00",
            "reason": "Status Test",
        },
        headers={"Authorization": f"Bearer {doctor_token}"},
    )
    assert res.status_code == 201
    appt_id = res.json()["id"]

    patch_res = client.patch(
        f"/api/v1/appointments/{appt_id}/status",
        json={"status": "cancelled", "cancellation_reason": "Patient requested reschedule"},
        headers={"Authorization": f"Bearer {doctor_token}"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "cancelled"
    assert patch_res.json()["cancellation_reason"] == "Patient requested reschedule"
