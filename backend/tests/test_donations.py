"""후원 · 축하 메시지 (D1 ~ D4) — docs/backend/API.SPEC.md 6장"""

import threading
import uuid
from datetime import timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db import engine
from app.errors import ApiError
from app.models import Donation, Funding, Gift, Message, User
from app.schemas.donation import DonationRequest
from app.services import donation as service
from app.services.validation import today
from tests.conftest import API, seed_id, token_of

SEOYEON, JIHOON, MINA, DOYOON = (f"{n}@example.com" for n in ("seoyeon", "jihoon", "mina", "doyoon"))
HEADPHONE = seed_id("gift_headphone")  # 서연 펀딩 · 359,000원 중 210,000원 모금 → 남은 149,000원


def donate(client, headers, gift_id=HEADPHONE, amount=10000, message="", key=None):
    return client.post(f"{API}/donations", headers=headers, json={"gift_id": gift_id, "amount": amount, "message": message, "idempotency_key": key or uuid.uuid4().hex})


def test_donate_with_message_and_owner_sees_it(client, db):
    jihoon = token_of(client, JIHOON)
    res = donate(client, jihoon, amount=20000, message="  생일 축하해!  ")
    assert res.status_code == 201
    donation_id = res.json()["donation_id"]
    mine = client.get(f"{API}/me/donations/{donation_id}", headers=jihoon).json()
    assert mine == mine | {"amount": 20000, "gift_name": "노이즈캔슬링 무선 헤드폰", "owner_name": "김서연", "funding_name": "나의 24번째 생일선물", "has_message": True, "status": "completed"}
    # 생일자 화면: 모금액 반영 · 메시지 · 후원자 내역
    owner = token_of(client, SEOYEON)
    gift = client.get(f"{API}/me/fundings/{seed_id('f_my24')}", headers=owner).json()["gifts"][0]
    assert gift["raised_amount"] == 230000 and gift["donation_count"] == 4
    messages = client.get(f"{API}/me/messages", headers=owner).json()
    assert messages[0] == messages[0] | {"author_name": "이지훈", "content": "생일 축하해!", "gift_name": "노이즈캔슬링 무선 헤드폰"}
    # 빈 메시지 → 메시지 없음
    no_msg = donate(client, jihoon, amount=1, message="   ").json()["donation_id"]
    assert client.get(f"{API}/me/donations/{no_msg}", headers=jihoon).json()["has_message"] is False
    assert db.scalar(select(Message).where(Message.donation_id == no_msg)) is None


def test_same_key_returns_first_result_even_after_closed(client, db):
    jihoon = token_of(client, JIHOON)
    first = donate(client, jihoon, amount=149000, key="retry-key").json()["donation_id"]  # 남은 금액 전부 → 마감
    # 같은 키 재전송: 마감됐어도 금액 · 메시지가 달라도 기존 성공 응답
    again = donate(client, jihoon, amount=5, message="다른 메시지", key="retry-key")
    assert again.status_code == 201 and again.json()["donation_id"] == first
    assert len(db.scalars(select(Donation.id).where(Donation.idempotency_key == "retry-key")).all()) == 1
    # 새 키로는 마감
    closed = donate(client, jihoon, amount=1)
    assert closed.status_code == 409 and closed.json() == {"code": "GOAL_REACHED", "message": "후원이 마감된 선물입니다."}
    # 키는 후원자별: 민아가 같은 키를 써도 다른 요청 (마감이라 409)
    assert donate(client, token_of(client, MINA), amount=1, key="retry-key").json()["code"] == "GOAL_REACHED"


def test_exceeds_remaining_returns_max_available(client):
    res = donate(client, token_of(client, JIHOON), amount=150000)
    assert res.status_code == 409
    assert res.json() == {
        "code": "EXCEEDS_REMAINING",
        "message": "현재 이 선물에는 최대 149,000원까지 후원할 수 있습니다. 후원 금액을 수정해 주세요.",
        "max_available": 149000,
    }


def test_donation_validation_and_permissions(client):
    jihoon = token_of(client, JIHOON)
    for amount in (0, -1, 1.5, "만원", None):
        res = donate(client, jihoon, amount=amount)
        assert res.status_code == 400 and res.json()["message"] == "0원보다 큰 금액을 입력해 주세요."
    long = donate(client, jihoon, message="가" * 201)
    assert long.status_code == 400 and long.json()["message"] == "축하 메시지는 200자 이내로 작성해 주세요."
    assert donate(client, jihoon, message="가" * 200).status_code == 201
    for key in ("", " ", "k" * 65):
        res = donate(client, jihoon, key=key) if key else client.post(f"{API}/donations", headers=jihoon, json={"gift_id": HEADPHONE, "amount": 1, "message": "", "idempotency_key": ""})
        assert res.status_code == 400 and res.json()["message"] == "잘못된 요청이에요. 다시 시도해 주세요."
    assert donate(client, jihoon, key="k" * 64).status_code == 201
    # 본인 펀딩 · 다른 그룹 펀딩 · 없는 선물
    own = donate(client, token_of(client, SEOYEON))
    assert own.status_code == 403 and own.json()["message"] == "본인 펀딩은 내 펀딩 메뉴에서 관리해 주세요."
    other = donate(client, token_of(client, DOYOON))  # 도윤은 대학 친구들 참여자가 아니다
    assert other.status_code == 403 and other.json()["message"] == "이 펀딩에 접근할 권한이 없어요."
    assert donate(client, jihoon, gift_id="nope").json() == {"code": "NOT_FOUND", "message": "선물을 찾을 수 없어요."}
    # 종료된 펀딩
    ended = donate(client, jihoon, gift_id=seed_id("gift_chair"))
    assert ended.status_code == 409 and ended.json()["message"] == "진행 중인 펀딩이 아니라 후원할 수 없어요."


def test_scheduled_funding_cannot_receive(client):
    owner = token_of(client, SEOYEON)
    start = (today() + timedelta(days=3)).isoformat()
    body = {"name": "예정", "group_id": seed_id("g_college"), "start_date": start, "end_date": start,
            "gifts": [{"name": "g", "price": 1000, "image_url": "data:,", "product_url": "https://e.com", "description": ""}]}
    fid = client.post(f"{API}/fundings", headers=owner, json=body).json()["id"]
    gid = client.get(f"{API}/me/fundings/{fid}", headers=owner).json()["gifts"][0]["id"]
    assert donate(client, token_of(client, JIHOON), gift_id=gid, amount=1).json()["code"] == "FUNDING_NOT_ACTIVE"


def test_my_donations_list_and_detail(client):
    jihoon = token_of(client, JIHOON)
    rows = client.get(f"{API}/me/donations", headers=jihoon).json()
    assert len(rows) == 7 and all(r["status"] == "completed" for r in rows)
    assert rows == sorted(rows, key=lambda r: r["created_at"], reverse=True)
    my24 = client.get(f"{API}/me/donations", headers=jihoon, params={"funding_id": seed_id("f_my24")}).json()
    assert [r["amount"] for r in my24] == [30000, 100000]  # 같은 선물 두 번 → 각각
    assert [r["has_message"] for r in my24] == [False, True]
    assert client.get(f"{API}/me/donations", headers=jihoon, params={"funding_id": "bad"}).json() == []
    # 남의 후원 · 없는 후원
    res = client.get(f"{API}/me/donations/{seed_id('d_2')}", headers=jihoon)  # 민아의 후원
    assert res.status_code == 403 and res.json()["message"] == "본인의 후원 내역만 확인할 수 있어요."
    assert client.get(f"{API}/me/donations/{uuid.uuid4()}", headers=jihoon).json()["message"] == "후원 내역을 찾을 수 없어요."


def test_received_messages(client):
    owner = token_of(client, SEOYEON)
    rows = client.get(f"{API}/me/messages", headers=owner).json()
    assert [r["content"] for r in rows] == ["태어나줘서 고마워 💗 올해도 잘 부탁해~", "생일 축하해! 🎂 좋은 노래 많이 들어!", "항상 좋은 일만 가득하길 ✨"]
    assert rows[0]["author_name"] == "박민아" and rows[2]["funding_name"] == "작년 생일 펀딩"
    only = client.get(f"{API}/me/messages", headers=owner, params={"funding_id": seed_id("f_mylast")}).json()
    assert [r["gift_name"] for r in only] == ["캠핑 릴렉스 의자"]
    res = client.get(f"{API}/me/messages", headers=owner, params={"funding_id": seed_id("f_jihoon")})
    assert res.status_code == 403
    # 지훈이는 자기 펀딩 메시지만 (서연의 m_3)
    assert [r["author_name"] for r in client.get(f"{API}/me/messages", headers=token_of(client, JIHOON)).json()] == ["김서연"]


def test_no_update_or_delete_api(client):
    jihoon = token_of(client, JIHOON)
    assert client.delete(f"{API}/me/donations/{seed_id('d_1')}", headers=jihoon).status_code in (404, 405)
    assert client.put(f"{API}/donations", headers=jihoon, json={}).status_code in (404, 405)


# ───────── 동시 요청 (실제 트랜잭션 · 커밋을 쓰므로 직접 만들고 지운다) ─────────


def _concurrent(calls):
    results: list = [None] * len(calls)
    barrier = threading.Barrier(len(calls))

    def run(i, fn):
        with Session(engine) as session:
            barrier.wait()
            try:
                results[i] = fn(session)
            except ApiError as e:
                results[i] = e.code

    threads = [threading.Thread(target=run, args=(i, fn)) for i, fn in enumerate(calls)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    return results


def _setup_gift(price: int) -> tuple[uuid.UUID, uuid.UUID]:
    with Session(engine) as s:
        f = Funding(owner_id=seed_id("u_seoyeon"), group_id=seed_id("g_college"), name="동시성 테스트", start_date=today(), end_date=today())
        s.add(f)
        s.flush()
        g = Gift(funding_id=f.id, name="g", price=price, image_url="data:,", product_url="https://e.com", description="", sort_order=1)
        s.add(g)
        s.commit()
        return f.id, g.id


def _cleanup(funding_id: uuid.UUID) -> None:
    with Session(engine) as s:
        ids = s.scalars(select(Donation.id).where(Donation.funding_id == funding_id)).all()
        s.execute(delete(Message).where(Message.donation_id.in_(ids)))
        s.execute(delete(Donation).where(Donation.funding_id == funding_id))
        s.execute(delete(Funding).where(Funding.id == funding_id))
        s.commit()


def _user(session: Session, email: str) -> User:
    return session.scalar(select(User).where(User.email == email))


def test_concurrent_donations_never_exceed_goal():
    funding_id, gift_id = _setup_gift(10000)
    try:
        def make(email):
            return lambda s: service.donate(s, _user(s, email), DonationRequest(gift_id=str(gift_id), amount=7000, idempotency_key=uuid.uuid4().hex))

        results = _concurrent([make(JIHOON), make(MINA)])
        assert "EXCEEDS_REMAINING" in results  # 둘 중 하나만 성공
        assert sum(isinstance(r, uuid.UUID) for r in results) == 1
        with Session(engine) as s:
            assert sum(s.scalars(select(Donation.amount).where(Donation.gift_id == gift_id))) == 7000
    finally:
        _cleanup(funding_id)


def test_concurrent_same_key_saves_once():
    funding_id, gift_id = _setup_gift(10000)
    try:
        call = lambda s: service.donate(s, _user(s, JIHOON), DonationRequest(gift_id=str(gift_id), amount=1000, message="축하해", idempotency_key="same-key-concurrent"))
        results = _concurrent([call, call, call])
        assert len(set(results)) == 1 and isinstance(results[0], uuid.UUID)
        with Session(engine) as s:
            assert len(s.scalars(select(Donation.id).where(Donation.gift_id == gift_id)).all()) == 1
            assert len(s.scalars(select(Message.id).join(Donation, Donation.id == Message.donation_id).where(Donation.gift_id == gift_id)).all()) == 1
    finally:
        _cleanup(funding_id)
