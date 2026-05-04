import io

def test_login_success(client, admin_user):
    response = client.post("/api/v1/auth/login", json={
        "username": "admin_test",
        "password": "admin123"
    })
    assert response.status_code == 200
    data = response.json
    assert "access_token" in data
    assert data["user"]["username"] == "admin_test"

def test_login_failure(client):
    response = client.post("/api/v1/auth/login", json={
        "username": "wrong",
        "password": "wrong"
    })
    assert response.status_code == 401

def test_change_password(client, auth_headers):
    # New password must satisfy strength rules: 8+ chars, uppercase, digit
    response = client.post("/api/v1/auth/change-password", headers=auth_headers, json={
        "current_password": "admin123",
        "new_password": "NewPass456"
    })
    assert response.status_code == 204

    # After change, the old token is revoked — must log in again with the new password
    response = client.post("/api/v1/auth/login", json={
        "username": "admin_test",
        "password": "NewPass456"
    })
    assert response.status_code == 200

def test_upload_photo(client, auth_headers):
    # Build a minimal valid JPEG: starts with FF D8 magic bytes
    jpeg_bytes = b"\xff\xd8\xff\xe0" + b"\x00" * 20
    data = {
        "file": (io.BytesIO(jpeg_bytes), "photo.jpg", "image/jpeg")
    }
    response = client.post(
        "/api/v1/usuarios/me/photo",
        headers=auth_headers,
        data=data,
        content_type="multipart/form-data"
    )
    assert response.status_code == 200
    assert "photo_url" in response.json
    # Filename is UUID-based, not the original name — just verify the URL path prefix
    assert response.json["photo_url"].startswith("/api/v1/static/photos/")
