"""생일 캘린더 (C1 ~ C5) · 알림 (N1 ~ N4) — docs/backend/API.SPEC.md 8장"""

from datetime import date

from sqlalchemy import select

from app.models import Notification, User
from app.services.schedule import days_until_next_birthday, ensure_notifications
from tests.conftest import API, seed_id, token_of

SEOYEON, JIHOON = "seoyeon@example.com", "jihoon@example.com"


def event_body(**overrides):
    return {"friend_name": "새 친구", "birthday": "2001-03-03", "linked_funding_id": None} | overrides


# ───────── 생일 일정 ─────────


def test_list_events_hides_unviewable_funding_name(client):
    events = {e["friend_name"]: e for e in client.get(f"{API}/birthday-events", headers=token_of(client, SEOYEON)).json()}
    assert set(events) == {"이지훈", "박민아", "최도윤", "엄마"}
    assert events["이지훈"] | {} == events["이지훈"] | {"linked_funding_name": "지훈이의 27번째 생일", "can_open_linked_funding": True, "linked_funding_is_mine": False}
    # 민아 펀딩은 서연이 참여하지 않은 그룹 → 이름도 공개하지 않는다
    assert events["박민아"]["linked_funding_name"] is None and events["박민아"]["can_open_linked_funding"] is False
    assert events["엄마"]["linked_funding_id"] is None


def test_linkable_fundings_are_viewable_only(client):
    names = [f["name"] for f in client.get(f"{API}/birthday-events/linkable-fundings", headers=token_of(client, SEOYEON)).json()]
    assert set(names) == {"나의 24번째 생일선물", "작년 생일 펀딩", "100% 달성한 펀딩", "후원 없이 끝난 펀딩", "재작년 생일 펀딩", "지훈이의 27번째 생일", "도윤 생일 러닝 펀딩"}
    assert "민아 생일 축하 펀딩" not in names


def test_create_update_delete_event(client):
    headers = token_of(client, SEOYEON)
    res = client.post(f"{API}/birthday-events", headers=headers, json=event_body(friend_name=" 수아 ", linked_funding_id=seed_id("f_jihoon")))
    assert res.status_code == 201
    eid = res.json()["id"]
    created = next(e for e in client.get(f"{API}/birthday-events", headers=headers).json() if e["id"] == eid)
    assert created["friend_name"] == "수아" and created["birthday"] == "2001-03-03" and created["linked_funding_name"] == "지훈이의 27번째 생일"
    assert client.put(f"{API}/birthday-events/{eid}", headers=headers, json=event_body(friend_name="수아2")).status_code == 204
    updated = next(e for e in client.get(f"{API}/birthday-events", headers=headers).json() if e["id"] == eid)
    assert updated["friend_name"] == "수아2" and updated["linked_funding_id"] is None
    # 남의 일정
    other = token_of(client, JIHOON)
    res = client.put(f"{API}/birthday-events/{eid}", headers=other, json=event_body())
    assert res.status_code == 403 and res.json()["message"] == "본인이 등록한 일정만 관리할 수 있어요."
    assert client.delete(f"{API}/birthday-events/{eid}", headers=other).status_code == 403
    assert client.delete(f"{API}/birthday-events/{eid}", headers=headers).status_code == 204
    assert client.delete(f"{API}/birthday-events/{eid}", headers=headers).json()["message"] == "존재하지 않는 일정이에요."


def test_event_validation(client):
    headers = token_of(client, SEOYEON)
    res = client.post(f"{API}/birthday-events", headers=headers, json=event_body(friend_name=" ", birthday="2001-02-30", linked_funding_id=seed_id("f_mina")))
    assert res.status_code == 400 and res.json()["field_errors"] == {
        "friend_name": "친구 이름을 입력해 주세요.",
        "birthday": "올바른 생일을 선택해 주세요.",
        "linked_funding_id": "접근 가능한 펀딩만 연결할 수 있어요.",
    }
    long = client.post(f"{API}/birthday-events", headers=headers, json=event_body(friend_name="가" * 21, linked_funding_id="nope"))
    assert long.json()["field_errors"] == {"friend_name": "친구 이름은 20자 이내로 입력해 주세요.", "linked_funding_id": "접근 가능한 펀딩만 연결할 수 있어요."}


# ───────── 알림 ─────────


def test_notifications_created_on_read(client):
    headers = token_of(client, SEOYEON)
    rows = client.get(f"{API}/notifications", headers=headers).json()
    by_type = {n["type"]: n for n in rows}
    assert set(by_type) == {"birthday-before", "birthday-today", "shortfall-reminder"}
    before = by_type["birthday-before"]
    assert before["title"] == "내일은 이지훈님의 생일이에요 🎁" and before["funding_id"] == seed_id("f_jihoon") and before["can_open_funding"] is True
    today = by_type["birthday-today"]
    assert today["title"] == "오늘은 박민아님의 생일이에요 🎂"
    assert today["funding_id"] is None and today["can_open_funding"] is False  # 볼 수 없는 펀딩 → 생일 캘린더로
    short = by_type["shortfall-reminder"]
    assert short["title"] == "'작년 생일 펀딩' 목표 미달 선물을 처리해 주세요" and short["funding_id"] == seed_id("f_mylast")
    assert short["body"] == "펀딩이 끝난 지 7일이 지났어요. 선물 1개의 이월 또는 인출을 선택해 주세요." and short["funding_is_mine"] is True
    # 다시 조회해도 늘어나지 않는다
    assert len(client.get(f"{API}/notifications", headers=headers).json()) == 3
    assert client.get(f"{API}/notifications/unread-count", headers=headers).json() == {"count": 3}


def test_shortfall_reminder_not_created_after_decision(client):
    headers = token_of(client, SEOYEON)
    assert client.post(f"{API}/gifts/{seed_id('gift_chair')}/shortfall", headers=headers, json={"action": "withdraw"}).status_code == 204
    types = [n["type"] for n in client.get(f"{API}/notifications", headers=headers).json()]
    assert "shortfall-reminder" not in types  # 처리한 선물 · 0원 선물(후원 없이 끝난 펀딩)은 세지 않는다


def test_birthday_notification_follows_current_link(client, db):
    headers = token_of(client, SEOYEON)
    client.get(f"{API}/notifications", headers=headers)
    # 일정의 연결을 끊으면 이미 만든 알림도 펀딩으로 가지 않는다
    client.put(f"{API}/birthday-events/{seed_id('be_1')}", headers=headers, json=event_body(friend_name="이지훈", birthday="1999-01-01"))
    before = next(n for n in client.get(f"{API}/notifications", headers=headers).json() if n["type"] == "birthday-before")
    assert before["funding_id"] is None and before["can_open_funding"] is False


def test_deleting_event_deletes_its_notifications(client, db):
    headers = token_of(client, SEOYEON)
    client.get(f"{API}/notifications", headers=headers)
    client.delete(f"{API}/birthday-events/{seed_id('be_1')}", headers=headers)
    titles = [n["title"] for n in client.get(f"{API}/notifications", headers=headers).json()]
    assert not any("이지훈" in t for t in titles)


def test_read_and_read_all(client):
    headers = token_of(client, SEOYEON)
    rows = client.get(f"{API}/notifications", headers=headers).json()
    assert client.patch(f"{API}/notifications/{rows[0]['id']}", headers=headers, json={"is_read": True}).status_code == 204
    assert client.get(f"{API}/notifications/unread-count", headers=headers).json()["count"] == 2
    res = client.patch(f"{API}/notifications/{rows[0]['id']}", headers=token_of(client, JIHOON), json={"is_read": True})
    assert res.status_code == 404 and res.json()["message"] == "알림을 찾을 수 없어요."
    assert client.patch(f"{API}/notifications/nope", headers=headers, json={"is_read": True}).status_code == 404
    assert client.post(f"{API}/notifications/read-all", headers=headers).status_code == 204
    assert client.get(f"{API}/notifications/unread-count", headers=headers).json()["count"] == 0


def test_feb_29_birthday_is_feb_28_in_common_years(client, db):
    born = date(2000, 2, 29)
    assert days_until_next_birthday(born, date(2027, 2, 28)) == 0  # 평년 → 2월 28일
    assert days_until_next_birthday(born, date(2027, 2, 27)) == 1
    assert days_until_next_birthday(born, date(2028, 2, 28)) == 1  # 윤년 → 2월 29일
    assert days_until_next_birthday(born, date(2027, 3, 1)) == 365  # 2028-02-29 까지
    headers = token_of(client, SEOYEON)
    client.post(f"{API}/birthday-events", headers=headers, json=event_body(friend_name="윤년이", birthday="2000-02-29"))
    seoyeon = db.scalar(select(User).where(User.email == SEOYEON))
    ensure_notifications(db, seoyeon, today=date(2027, 2, 28))
    ensure_notifications(db, seoyeon, today=date(2027, 2, 28))  # 두 번 돌아도 한 번만
    rows = db.scalars(select(Notification).where(Notification.user_id == seoyeon.id, Notification.title.like("%윤년이%"))).all()
    assert [(n.type, n.dedupe_key.endswith("2027-02-28")) for n in rows] == [("birthday-today", True)]
