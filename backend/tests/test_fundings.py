"""펀딩 · 선물 (F1 ~ F14) — docs/backend/API.SPEC.md 5장"""

from datetime import timedelta

from sqlalchemy import select

from app.models import BirthdayEvent, Carryover, Gift, Invite, Notification
from app.services.validation import today
from tests.conftest import API, seed_id, token_of

SEOYEON, JIHOON, MINA, DOYOON = (f"{n}@example.com" for n in ("seoyeon", "jihoon", "mina", "doyoon"))
COLLEGE, OFFICE = seed_id("g_college"), seed_id("g_office")
OWNER_ONLY_FIELDS = {"raised_amount", "remaining_amount", "donation_count", "shortfall_action", "settled", "settlement_status", "carried_over_amount"}


def day(n: int) -> str:
    return (today() + timedelta(days=n)).isoformat()  # 서버와 같은 기준 날짜 (Asia/Seoul)


GIFT = {"name": "새 선물", "price": 10000, "image_url": "data:,", "product_url": "https://example.com", "description": ""}


def new_funding(client, headers, **overrides) -> str:
    body = {"name": "테스트 펀딩", "group_id": COLLEGE, "start_date": day(0), "end_date": day(5), "gifts": [GIFT], "carryover_ids": []} | overrides
    res = client.post(f"{API}/fundings", headers=headers, json=body)
    assert res.status_code == 201, res.text
    return res.json()["id"]


# ───────── 조회 · 계산 ─────────


def test_my_fundings_newest_first_with_amounts(client):
    body = client.get(f"{API}/me/fundings", headers=token_of(client, SEOYEON)).json()
    assert [f["name"] for f in body] == ["나의 24번째 생일선물", "후원 없이 끝난 펀딩", "100% 달성한 펀딩", "작년 생일 펀딩", "재작년 생일 펀딩"]
    my24 = body[0]
    assert my24["status"] == "active" and my24["group_name"] == "대학 친구들" and my24["owner_name"] == "김서연"
    assert my24["total_raised"] == 249000
    headphone, mood = my24["gifts"]
    assert headphone == headphone | {"name": "노이즈캔슬링 무선 헤드폰", "price": 359000, "raised_amount": 210000, "remaining_amount": 149000,
                                     "donation_count": 3, "achievement_rate": 58, "is_closed": False, "settled": False, "carried_over_amount": 0}
    assert mood["achievement_rate"] == 100 and mood["is_closed"] is True and mood["remaining_amount"] == 0
    camera = body[4]["gifts"][0]
    assert camera["shortfall_action"] == "carryover" and camera["raised_amount"] == 60000


def test_owner_only_detail_and_404(client):
    headers = token_of(client, SEOYEON)
    assert client.get(f"{API}/me/fundings/{seed_id('f_my24')}", headers=headers).json()["name"] == "나의 24번째 생일선물"
    res = client.get(f"{API}/me/fundings/{seed_id('f_jihoon')}", headers=headers)
    assert res.status_code == 403 and res.json()["message"] == "이 펀딩을 관리할 권한이 없어요."
    assert client.get(f"{API}/me/fundings/nope", headers=headers).json() == {"code": "NOT_FOUND", "message": "펀딩을 찾을 수 없어요."}


def test_friend_views_hide_amounts(client):
    """F-13: 후원자 응답에는 모금액 필드가 아예 없다"""
    headers = token_of(client, SEOYEON)
    friends = client.get(f"{API}/fundings/friends", headers=headers).json()
    assert [f["name"] for f in friends] == ["지훈이의 27번째 생일", "도윤 생일 러닝 펀딩"]
    detail = client.get(f"{API}/fundings/{seed_id('f_jihoon')}", headers=headers).json()
    assert "total_raised" not in detail
    for gift in friends[0]["gifts"] + detail["gifts"]:
        assert not OWNER_ONLY_FIELDS & set(gift)
    assert [g["achievement_rate"] for g in detail["gifts"]] == [62, 94]
    gift = client.get(f"{API}/gifts/{seed_id('gift_console')}", headers=headers).json()
    assert gift["funding"]["name"] == "지훈이의 27번째 생일" and not OWNER_ONLY_FIELDS & set(gift["gift"])


def test_friend_view_permissions(client):
    headers = token_of(client, SEOYEON)
    own = client.get(f"{API}/fundings/{seed_id('f_my24')}", headers=headers)
    assert own.status_code == 403 and own.json()["message"] == "본인 펀딩은 내 펀딩 메뉴에서 관리해 주세요."
    other = client.get(f"{API}/fundings/{seed_id('f_mina')}", headers=headers)  # 민아네 생일 모임에 서연은 없다
    assert other.status_code == 403 and other.json()["message"] == "이 펀딩에 접근할 권한이 없어요."
    assert client.get(f"{API}/gifts/{seed_id('gift_perfume')}", headers=headers).status_code == 403
    # 민아는 대학 친구들 참여자 → 서연 펀딩 5개 (예정 · 진행 · 종료 모두)
    assert len(client.get(f"{API}/fundings/friends", headers=token_of(client, MINA)).json()) == 5


def test_supporter_donations_owner_only(client):
    rows = client.get(f"{API}/fundings/{seed_id('f_my24')}/donations", headers=token_of(client, SEOYEON)).json()
    assert [r["amount"] for r in rows] == [30000, 39000, 80000, 100000]  # 최신순
    assert rows[0]["supporter_name"] == "이지훈" and rows[0]["gift_name"] == "노이즈캔슬링 무선 헤드폰"
    assert client.get(f"{API}/fundings/{seed_id('f_my24')}/donations", headers=token_of(client, JIHOON)).status_code == 403


# ───────── F3 펀딩 생성 ─────────


def test_create_funding_and_validation(client):
    headers = token_of(client, SEOYEON)
    fid = new_funding(client, headers, name="  올해 생일  ", gifts=[GIFT, GIFT | {"name": "두 번째", "price": 20000.0}])
    detail = client.get(f"{API}/me/fundings/{fid}", headers=headers).json()
    assert detail["name"] == "올해 생일" and detail["status"] == "active"  # 오늘 시작 → 바로 진행 중
    assert [g["name"] for g in detail["gifts"]] == ["새 선물", "두 번째"]

    res = client.post(f"{API}/fundings", headers=headers, json={"name": "", "group_id": "", "start_date": day(-1), "end_date": day(-2), "gifts": []})
    assert res.status_code == 400
    assert res.json()["field_errors"] == {
        "name": "펀딩 이름을 입력해 주세요.",
        "group_id": "그룹을 선택해 주세요.",
        "start_date": "시작일은 오늘 이전으로 선택할 수 없어요.",
        "end_date": "종료일은 시작일보다 빠를 수 없어요.",
        "gifts": "선물을 최소 1개 이상 등록해 주세요.",
    }
    long = client.post(f"{API}/fundings", headers=headers, json={"name": "가" * 41, "group_id": COLLEGE, "start_date": day(0), "end_date": day(21), "gifts": [GIFT]})
    assert long.json()["field_errors"] == {"name": "펀딩 이름은 40자 이내로 입력해 주세요.", "end_date": "펀딩 기간은 최대 3주(21일)까지 설정할 수 있어요."}
    assert client.post(f"{API}/fundings", headers=headers, json={"name": "a", "group_id": COLLEGE, "start_date": day(0), "end_date": day(20), "gifts": [GIFT]}).status_code == 201


def test_create_funding_gift_validation(client):
    headers = token_of(client, SEOYEON)
    bad = {"name": " ", "price": 1.5, "image_url": "", "product_url": "ftp://x", "description": "나" * 101}
    res = client.post(f"{API}/fundings", headers=headers, json={"name": "a", "group_id": COLLEGE, "start_date": day(0), "end_date": day(1), "gifts": [bad]})
    assert res.status_code == 400 and res.json()["message"] == "선물 정보를 확인해 주세요."
    assert res.json()["field_errors"] == {
        "name": "선물 이름을 입력해 주세요.",
        "description": "선물 설명은 100자 이내로 입력해 주세요.",
        "price": "금액은 원 단위 정수로 입력해 주세요.",
        "image_url": "선물 이미지를 등록해 주세요.",
        "product_url": "올바른 URL 형식으로 입력해 주세요. (예: https://...)",
    }
    for price, message in [(None, "선물 가격을 입력해 주세요."), (0, "0원보다 큰 금액을 입력해 주세요."), (50_000_001, "선물 가격은 50,000,000원 이하로 입력해 주세요.")]:
        res = client.post(f"{API}/fundings", headers=headers, json={"name": "a", "group_id": COLLEGE, "start_date": day(0), "end_date": day(1), "gifts": [GIFT | {"price": price}]})
        assert res.json()["field_errors"]["price"] == message


def test_create_funding_only_in_my_group(client):
    headers = token_of(client, SEOYEON)
    for group_id in (OFFICE, seed_id("g_doyoon"), seed_id("g_family"), "nope"):
        res = client.post(f"{API}/fundings", headers=headers, json={"name": "a", "group_id": group_id, "start_date": day(0), "end_date": day(1), "gifts": [GIFT]})
        assert res.status_code == 403 and res.json()["message"] == "내가 만든 그룹에만 펀딩을 열 수 있어요."


def test_reopen_carryover(client, db):
    headers = token_of(client, SEOYEON)
    pending = client.get(f"{API}/me/carryovers?status=pending", headers=headers).json()
    assert [(c["gift_name"], c["amount"], c["price"], c["funding_name"]) for c in pending] == [("필름 카메라", 60000, 150000, "재작년 생일 펀딩")]
    fid = new_funding(client, headers, gifts=[], carryover_ids=[pending[0]["id"], pending[0]["id"]])
    gift = client.get(f"{API}/me/fundings/{fid}", headers=headers).json()["gifts"]
    assert len(gift) == 1
    assert gift[0] == gift[0] | {"name": "필름 카메라", "raised_amount": 60000, "remaining_amount": 90000, "carried_over_amount": 60000, "donation_count": 0, "achievement_rate": 40}
    c = db.scalar(select(Carryover).where(Carryover.id == pending[0]["id"]))
    assert c.status == "reopened" and str(c.reopened_funding_id) == fid and c.reopened_at is not None
    assert client.get(f"{API}/me/carryovers", headers=headers).json() == []
    again = client.post(f"{API}/fundings", headers=headers, json={"name": "a", "group_id": COLLEGE, "start_date": day(0), "end_date": day(1), "carryover_ids": [pending[0]["id"]]})
    assert again.status_code == 409 and again.json()["code"] == "CONFLICT"
    # 후원자에게는 이월 금액이 달성률로만 보인다
    friend_gift = client.get(f"{API}/fundings/{fid}", headers=token_of(client, JIHOON)).json()["gifts"][0]
    assert friend_gift["achievement_rate"] == 40 and "raised_amount" not in friend_gift
    # 이월 금액이 들어간 선물 · 펀딩은 지울 수 없고 가격도 못 바꾼다
    gid = gift[0]["id"]
    assert client.get(f"{API}/me/gifts/{gid}", headers=headers).json()["has_donations"] is True
    assert client.delete(f"{API}/gifts/{gid}", headers=headers).json()["message"] == "이월 금액이 포함된 선물은 삭제할 수 없어요."
    assert client.delete(f"{API}/fundings/{fid}", headers=headers).json()["message"] == "이월 금액이 포함된 펀딩은 삭제할 수 없어요."
    assert client.put(f"{API}/gifts/{gid}", headers=headers, json=GIFT | {"price": 1}).json()["code"] == "GIFT_LOCKED"


def test_other_users_carryover_is_not_found(client):
    co = token_of(client, SEOYEON)
    cid = client.get(f"{API}/me/carryovers", headers=co).json()[0]["id"]
    res = client.post(f"{API}/fundings", headers=token_of(client, JIHOON), json={"name": "a", "group_id": OFFICE, "start_date": day(0), "end_date": day(1), "carryover_ids": [cid]})
    assert res.status_code == 404 and res.json()["message"] == "이월 기록을 찾을 수 없어요."


# ───────── F14 · F4 ─────────


def test_update_funding_name_rules(client):
    headers = token_of(client, SEOYEON)
    res = client.patch(f"{API}/fundings/{seed_id('f_my24')}", headers=headers, json={"name": " 새 이름 "})
    assert res.status_code == 200 and res.json()["name"] == "새 이름" and "total_raised" in res.json()
    assert client.patch(f"{API}/fundings/{seed_id('f_mylast')}", headers=headers, json={"name": "x"}).json()["code"] == "FUNDING_NOT_ACTIVE"
    assert client.patch(f"{API}/fundings/{seed_id('f_my24')}", headers=headers, json={"name": "  "}).status_code == 400
    assert client.patch(f"{API}/fundings/{seed_id('f_my24')}", headers=headers, json={"name": "가" * 41}).json()["message"] == "펀딩 이름은 40자 이내로 입력해 주세요."
    locked = client.patch(f"{API}/fundings/{seed_id('f_my24')}", headers=headers, json={"name": "a", "group_id": OFFICE})
    assert locked.status_code == 400 and locked.json()["message"] == "펀딩 기간과 연결 그룹은 수정할 수 없어요."
    assert client.patch(f"{API}/fundings/{seed_id('f_jihoon')}", headers=headers, json={"name": "남의 펀딩"}).status_code == 403


def test_delete_funding(client, db):
    headers = token_of(client, SEOYEON)
    assert client.delete(f"{API}/fundings/{seed_id('f_my24')}", headers=headers).json()["message"] == "후원이 들어온 펀딩은 삭제할 수 없어요."
    fid = new_funding(client, headers)
    # 연결 데이터: 지정 초대 링크 · 미달 처리 알림 · 생일 일정 연결 · 생일 알림
    client.post(f"{API}/groups/{COLLEGE}/invites", headers=headers, json={"funding_id": fid})
    event = db.scalar(select(BirthdayEvent).where(BirthdayEvent.id == seed_id("be_4")))
    event.linked_funding_id = fid
    db.add(Notification(user_id=seed_id("u_seoyeon"), type="shortfall-reminder", title="t", body="b", funding_id=fid, dedupe_key="test-short"))
    db.add(Notification(user_id=seed_id("u_seoyeon"), type="birthday-today", title="t", body="b", event_id=event.id, dedupe_key="test-bday"))
    db.commit()
    assert client.delete(f"{API}/fundings/{fid}", headers=token_of(client, JIHOON)).status_code == 403
    assert client.delete(f"{API}/fundings/{fid}", headers=headers).status_code == 204
    db.expire_all()
    assert db.scalar(select(Gift).where(Gift.funding_id == fid)) is None
    assert db.scalar(select(Invite).where(Invite.funding_id == fid)) is None
    keys = set(db.scalars(select(Notification.dedupe_key).where(Notification.dedupe_key.like("test-%"))))
    assert keys == {"test-bday"}  # 생일 알림은 남는다
    assert db.get(BirthdayEvent, event.id).linked_funding_id is None
    assert client.get(f"{API}/me/fundings/{fid}", headers=headers).status_code == 404


# ───────── F5 ~ F8 선물 ─────────


def test_add_gift_until_funding_ends(client):
    headers = token_of(client, SEOYEON)
    fid = new_funding(client, headers, start_date=day(3), end_date=day(10))  # 예정
    res = client.post(f"{API}/fundings/{fid}/gifts", headers=headers, json=GIFT | {"name": " 추가 "})
    assert res.status_code == 201
    names = [g["name"] for g in client.get(f"{API}/me/fundings/{fid}", headers=headers).json()["gifts"]]
    assert names == ["새 선물", "추가"]
    assert client.post(f"{API}/fundings/{fid}/gifts", headers=headers, json=GIFT | {"price": 50_000_000}).status_code == 201  # 최대 5,000만 원
    ended = client.post(f"{API}/fundings/{seed_id('f_mylast')}/gifts", headers=headers, json=GIFT)
    assert ended.status_code == 409 and ended.json()["message"] == "종료된 펀딩에는 선물을 추가할 수 없어요."
    assert client.post(f"{API}/fundings/{seed_id('f_jihoon')}/gifts", headers=headers, json=GIFT).status_code == 403
    assert client.post(f"{API}/fundings/{fid}/gifts", headers=headers, json=GIFT | {"price": -1}).status_code == 400


def test_update_gift_price_lock(client):
    headers = token_of(client, SEOYEON)
    headphone = seed_id("gift_headphone")
    edit = client.get(f"{API}/me/gifts/{headphone}", headers=headers).json()
    assert edit["has_donations"] is True and edit["funding_id"] == seed_id("f_my24")
    same_price = {k: edit[k] for k in ("name", "price", "image_url", "product_url")} | {"description": "설명만 바꿈"}
    assert client.put(f"{API}/gifts/{headphone}", headers=headers, json=same_price).status_code == 204
    res = client.put(f"{API}/gifts/{headphone}", headers=headers, json=same_price | {"price": 1000})
    assert res.status_code == 409 and res.json()["message"] == "후원 또는 이월 금액이 있는 선물은 가격(목표 금액)을 변경할 수 없어요."
    assert client.get(f"{API}/me/gifts/{headphone}", headers=token_of(client, JIHOON)).status_code == 403
    # 후원 없는 선물은 가격도 바꿀 수 있다
    fid = new_funding(client, headers)
    gid = client.get(f"{API}/me/fundings/{fid}", headers=headers).json()["gifts"][0]["id"]
    assert client.put(f"{API}/gifts/{gid}", headers=headers, json=GIFT | {"price": 55555}).status_code == 204
    assert client.get(f"{API}/me/gifts/{gid}", headers=headers).json()["price"] == 55555


def test_delete_gift_rules(client):
    headers = token_of(client, SEOYEON)
    res = client.delete(f"{API}/gifts/{seed_id('gift_headphone')}", headers=headers)
    assert res.status_code == 409 and res.json()["message"] == "후원이 발생한 선물은 삭제할 수 없어요."
    fid = new_funding(client, headers, gifts=[GIFT, GIFT | {"name": "둘"}])
    first, second = [g["id"] for g in client.get(f"{API}/me/fundings/{fid}", headers=headers).json()["gifts"]]
    assert client.delete(f"{API}/gifts/{first}", headers=token_of(client, JIHOON)).status_code == 403
    assert client.delete(f"{API}/gifts/{first}", headers=headers).status_code == 204
    last = client.delete(f"{API}/gifts/{second}", headers=headers)
    assert last.status_code == 409 and last.json()["message"] == "펀딩에는 선물이 최소 1개 있어야 해요."
    assert client.delete(f"{API}/gifts/nope", headers=headers).json()["message"] == "선물을 찾을 수 없어요."
