"""인증 · 사용자 관리 (A1 ~ A7) — docs/backend/API.SPEC.md 3장"""

from tests.conftest import API, auth_header, login

SIGNUP = {"name": "홍길동", "email": "Gildong@Example.com", "password": "password123", "password_confirm": "password123", "birthday": "2000-05-05"}


def test_health(client):
    assert client.get("/health").json() == {"status": "ok", "db": "ok"}


def test_seed_account_login_with_argon2(client):
    body = login(client, remember=True)
    assert body["token_type"] == "bearer"
    assert body["expires_in"] == 30 * 24 * 3600
    assert body["user"]["email"] == "seoyeon@example.com"
    assert body["user"]["name"] == "김서연"
    assert set(body["user"]) == {"id", "name", "email", "birthday", "profile_image_url"}


def test_login_expiry_is_30_days_regardless_of_remember_me(client):
    assert login(client, remember=False)["expires_in"] == 30 * 24 * 3600


def test_login_failure_hides_which_part_is_wrong(client):
    for email, pw in [("seoyeon@example.com", "wrong-pass"), ("nobody@example.com", "password123")]:
        res = client.post(f"{API}/auth/login", json={"email": email, "password": pw, "remember_me": False})
        assert res.status_code == 401
        assert res.json() == {"code": "INVALID_CREDENTIALS", "message": "이메일 또는 비밀번호를 확인해 주세요."}


def test_signup_then_login_and_email_is_lowercased(client, db):
    res = client.post(f"{API}/auth/signup", json=SIGNUP)
    assert res.status_code == 201
    assert "id" in res.json()
    body = login(client, email="gildong@example.com")
    assert body["user"]["email"] == "gildong@example.com"
    # 빈 취향이 함께 만들어진다
    pref = client.get(f"{API}/me/preferences", headers=auth_header(body["access_token"])).json()
    assert pref == {"keywords": [], "categories": [], "price_range": None}
    # 비밀번호는 Argon2 해시로 저장
    from app.models import User
    from sqlalchemy import select

    stored = db.scalar(select(User.password_hash).where(User.email == "gildong@example.com"))
    assert stored.startswith("$argon2id$") and "password123" not in stored


def test_signup_duplicate_email(client):
    res = client.post(f"{API}/auth/signup", json={**SIGNUP, "email": "SEOYEON@example.com"})
    assert res.status_code == 409
    assert res.json()["code"] == "DUPLICATE_EMAIL"
    assert res.json()["field_errors"] == {"email": "이미 사용 중인 이메일입니다."}


def test_signup_validation_messages_match_frontend(client):
    res = client.post(
        f"{API}/auth/signup",
        json={"name": "가" * 51, "email": "not-email", "password": "short", "password_confirm": "different", "birthday": "2999-01-01"},
    )
    assert res.status_code == 400
    assert res.json()["code"] == "VALIDATION"
    assert res.json()["field_errors"] == {
        "name": "이름은 50자 이내로 입력해 주세요.",
        "email": "올바른 이메일 형식으로 입력해 주세요.",
        "password": "비밀번호는 8자 이상 입력해 주세요.",
        "password_confirm": "비밀번호가 일치하지 않습니다.",
        "birthday": "오늘 이후 날짜는 선택할 수 없습니다.",
    }


def test_protected_api_requires_token(client):
    for headers in [{}, auth_header("invalid.token.value")]:
        res = client.get(f"{API}/me", headers=headers)
        assert res.status_code == 401
        assert res.json() == {"code": "UNAUTHORIZED", "message": "로그인이 만료되었습니다. 다시 로그인해 주세요."}


def test_me_and_update_profile(client):
    token = login(client)["access_token"]
    me = client.get(f"{API}/me", headers=auth_header(token)).json()
    assert me["name"] == "김서연"
    res = client.patch(f"{API}/me", headers=auth_header(token), json={"name": " 김서연2 ", "birthday": "2002-01-02", "profile_image_url": None})
    assert res.status_code == 200
    assert res.json()["name"] == "김서연2"
    assert res.json()["birthday"] == "2002-01-02"
    bad = client.patch(f"{API}/me", headers=auth_header(token), json={"name": "", "birthday": "x", "profile_image_url": None})
    assert bad.status_code == 400
    assert set(bad.json()["field_errors"]) == {"name", "birthday"}


def test_preferences_are_normalized(client):
    token = login(client)["access_token"]
    assert client.get(f"{API}/me/preferences", headers=auth_header(token)).json()["keywords"] == ["음악", "캠핑", "향수"]
    keywords = [" 캠핑 ", "캠핑", ""] + [f"k{i}" for i in range(12)]
    res = client.put(f"{API}/me/preferences", headers=auth_header(token), json={"keywords": keywords, "categories": ["취미"], "price_range": "30k-100k"})
    assert res.status_code == 200
    assert res.json()["keywords"][:2] == ["캠핑", "k0"]
    assert len(res.json()["keywords"]) == 10
    bad = client.put(f"{API}/me/preferences", headers=auth_header(token), json={"keywords": [], "categories": [], "price_range": "free"})
    assert bad.status_code == 400


def test_logout_returns_204(client):
    assert client.post(f"{API}/auth/logout").status_code == 204


def test_unknown_api_returns_error_format(client):
    res = client.get(f"{API}/nothing-here")
    assert res.status_code == 404
    assert res.json()["code"] == "NOT_FOUND"


# ───────── A8 비밀번호 변경 (docs/features/password-change.md) ─────────


def change(client, headers, current="password123", new="newpass1234", confirm=None):
    body = {"current_password": current, "new_password": new, "new_password_confirm": new if confirm is None else confirm}
    return client.patch(f"{API}/me/password", headers=headers, json=body)


def test_change_password_then_login_with_new_only(client):
    token = login(client)["access_token"]
    assert change(client, auth_header(token)).status_code == 204
    # 로그인 유지: 지금 토큰으로 계속 쓸 수 있다
    assert client.get(f"{API}/me", headers=auth_header(token)).status_code == 200
    # 새 비밀번호로만 로그인된다
    assert login(client, password="newpass1234")["user"]["email"] == "seoyeon@example.com"
    old = client.post(f"{API}/auth/login", json={"email": "seoyeon@example.com", "password": "password123", "remember_me": False})
    assert old.status_code == 401


def test_change_password_rejects_wrong_current_and_same_password(client):
    headers = auth_header(login(client)["access_token"])
    wrong = change(client, headers, current="wrong-pass")
    assert wrong.status_code == 400 and wrong.json()["field_errors"] == {"current_password": "현재 비밀번호가 일치하지 않습니다."}
    same = change(client, headers, new="password123")
    assert same.status_code == 400 and same.json()["field_errors"] == {"new_password": "현재 비밀번호와 다른 비밀번호를 입력해 주세요."}


def test_change_password_validation_messages(client):
    headers = auth_header(login(client)["access_token"])
    empty = client.patch(f"{API}/me/password", headers=headers, json={"current_password": "", "new_password": "", "new_password_confirm": ""})
    assert empty.status_code == 400 and empty.json()["field_errors"] == {
        "current_password": "현재 비밀번호를 입력해 주세요.",
        "new_password": "비밀번호를 입력해 주세요.",
        "new_password_confirm": "비밀번호를 다시 입력해 주세요.",
    }
    short = change(client, headers, new="short", confirm="different")
    assert short.json()["field_errors"] == {"new_password": "비밀번호는 8자 이상 입력해 주세요.", "new_password_confirm": "비밀번호가 일치하지 않습니다."}
    assert client.patch(f"{API}/me/password", json={}).status_code == 401
