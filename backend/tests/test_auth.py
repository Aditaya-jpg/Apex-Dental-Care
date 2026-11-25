def test_login_success(client):
    res = client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "admin@pgi.edu.in", "password": "Dental@123"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user"]["role"] == "admin"
    assert data["user"]["is_admin"] is True


def test_login_invalid_credentials(client):
    res = client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "admin@pgi.edu.in", "password": "WrongPassword!"},
    )
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_token_refresh(client):
    login_res = client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "dr.mehta@pgi.edu.in", "password": "Dental@123"},
    )
    assert login_res.status_code == 200
    refresh_token = login_res.json()["refresh_token"]

    ref_res = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert ref_res.status_code == 200
    ref_data = ref_res.json()
    assert "access_token" in ref_data
    assert "refresh_token" in ref_data
    assert ref_data["refresh_token"] != refresh_token


def test_get_current_user_profile(client, doctor_token):
    res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {doctor_token}"})
    assert res.status_code == 200
    body = res.json()
    assert body["email"] == "dr.sharma@pgi.edu.in"
    assert body["role"] == "doctor"
    assert body["doctor_id"] is not None
    assert body["is_admin"] is False
