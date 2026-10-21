"""목표 미달 처리 · 정산 (S1 ~ S3) — docs/backend/API.SPEC.md 7장 (모의 정산)"""

import threading
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.crypto import decrypt_account
from app.db import engine
from app.errors import ApiError
from app.models import Carryover, Settlement, SettlementItem, User
from app.schemas.settlement import SettlementRequest
from app.services import settlement as service
from tests.conftest import API, seed_id, token_of

SEOYEON, JIHOON = "seoyeon@example.com", "jihoon@example.com"
F_LAST, F_DONE, F_MY24 = seed_id("f_mylast"), seed_id("f_done"), seed_id("f_my24")
CHAIR, BOOKS, SPEAKER = seed_id("gift_chair"), seed_id("gift_books"), seed_id("gift_speaker")  # 의자: 120,000 중 80,000 (미달)
ACCOUNT = {"bank": "국민은행", "account_number": "123456-78-901234", "account_holder": "김서연"}


def shortfall(client, headers, gift_id, action):
    return client.post(f"{API}/gifts/{gift_id}/shortfall", headers=headers, json={"action": action})


def settle(client, headers, funding_id, gift_ids, **account):
    return client.post(f"{API}/fundings/{funding_id}/settlements", headers=headers, json={"gift_ids": gift_ids, **(ACCOUNT | account)})


def later(db, seconds=61):
    """1분이 지난 것처럼 정산 상태를 진행시킨다"""
    service.advance_settlements(db, owner_id=seed_id("u_seoyeon"), now=datetime.now(UTC) + timedelta(seconds=seconds))


# ───────── S1 ─────────


def test_shortfall_withdraw_makes_gift_eligible(client):
    headers = token_of(client, SEOYEON)
    before = client.get(f"{API}/fundings/{F_LAST}/settlement", headers=headers).json()
    assert [(g["name"], g["amount"], g["reason"]) for g in before["eligible_gifts"]] == [("에세이 책 세트", 30000, "achieved")]
    assert shortfall(client, headers, CHAIR, "withdraw").status_code == 204
    after = client.get(f"{API}/fundings/{F_LAST}/settlement", headers=headers).json()
    assert [(g["name"], g["reason"]) for g in after["eligible_gifts"]] == [("캠핑 릴렉스 의자", "withdraw"), ("에세이 책 세트", "achieved")]
    assert after["eligible_amount"] == 110000
    gift = client.get(f"{API}/me/fundings/{F_LAST}", headers=headers).json()["gifts"][0]
    assert gift["shortfall_action"] == "withdraw"
    again = shortfall(client, headers, CHAIR, "carryover")
    assert again.status_code == 409 and again.json()["message"] == "이미 처리한 선물이에요. 같은 금액을 다시 처리할 수 없어요."


def test_shortfall_carryover_creates_pending_record(client, db):
    headers = token_of(client, SEOYEON)
    assert shortfall(client, headers, CHAIR, "carryover").status_code == 204
    c = db.scalar(select(Carryover).where(Carryover.gift_id == CHAIR))
    assert c.amount == 80000 and c.status == "pending"
    overview = client.get(f"{API}/fundings/{F_LAST}/settlement", headers=headers).json()
    assert overview["carryover_gifts"] == [{"id": CHAIR, "name": "캠핑 릴렉스 의자", "amount": 80000}]
    assert CHAIR not in [g["id"] for g in overview["eligible_gifts"]]
    assert [x["gift_name"] for x in client.get(f"{API}/me/carryovers", headers=headers).json()] == ["필름 카메라", "캠핑 릴렉스 의자"]


def test_shortfall_rejections(client):
    headers = token_of(client, SEOYEON)
    bad = shortfall(client, headers, CHAIR, "keep")
    assert bad.status_code == 400 and bad.json()["message"] == "처리 방식을 선택해 주세요."
    assert shortfall(client, headers, BOOKS, "withdraw").json()["message"] == "목표를 달성한 선물은 정상 정산 대상이에요."
    assert shortfall(client, headers, seed_id("gift_tumbler"), "withdraw").json()["message"] == "모금액이 없어 처리할 금액이 없어요."  # 0원 선물
    active = shortfall(client, headers, seed_id("gift_headphone"), "withdraw")
    assert active.status_code == 409 and active.json()["message"] == "펀딩이 종료된 후에 처리할 수 있어요."
    assert shortfall(client, token_of(client, JIHOON), CHAIR, "withdraw").status_code == 403
    assert shortfall(client, headers, "nope", "withdraw").status_code == 404


# ───────── S2 ─────────


def test_overview_owner_only_and_empty_before_end(client):
    headers = token_of(client, SEOYEON)
    assert client.get(f"{API}/fundings/{F_LAST}/settlement", headers=token_of(client, JIHOON)).status_code == 403
    active = client.get(f"{API}/fundings/{F_MY24}/settlement", headers=headers).json()
    assert active["eligible_gifts"] == [] and active["eligible_amount"] == 0
    noone = client.get(f"{API}/fundings/{seed_id('f_noone')}/settlement", headers=headers).json()
    assert noone["eligible_gifts"] == []  # 0원 선물 제외
    my22 = client.get(f"{API}/fundings/{seed_id('f_my22')}/settlement", headers=headers).json()
    assert my22["carryover_gifts"][0]["amount"] == 60000 and my22["eligible_gifts"] == []


# ───────── S3 ─────────


def test_request_settlement_encrypts_and_completes(client, db):
    headers = token_of(client, SEOYEON)
    res = settle(client, headers, F_DONE, [SPEAKER])
    assert res.status_code == 201
    s = db.get(Settlement, res.json()["id"])
    assert s.amount == 89000 and s.status == "requested"
    assert "12345678901234" not in s.account_number and decrypt_account(s.account_number) == "12345678901234"  # 암호화 저장
    overview = client.get(f"{API}/fundings/{F_DONE}/settlement", headers=headers).json()
    record = overview["history"][0]
    assert record == record | {"status": "processing", "gift_names": ["블루투스 스피커"], "amount": 89000, "account_number_masked": "**********1234", "failure_reason": None}
    assert overview["eligible_gifts"] == []
    assert client.get(f"{API}/me/fundings/{F_DONE}", headers=headers).json()["gifts"][0]["settlement_status"] == "processing"
    # 중복 요청 (처리 중)
    dup = settle(client, headers, F_DONE, [SPEAKER])
    assert dup.status_code == 409 and dup.json()["message"] == "이미 정산 요청한 선물이 포함되어 있어요."
    later(db)
    gift = client.get(f"{API}/me/fundings/{F_DONE}", headers=headers).json()["gifts"][0]
    assert gift["settlement_status"] == "completed" and gift["settled"] is True
    assert settle(client, headers, F_DONE, [SPEAKER]).status_code == 409  # 완료 후에도 다시 불가


def test_failed_settlement_can_be_requested_again(client, db):
    headers = token_of(client, SEOYEON)
    settle(client, headers, F_LAST, [BOOKS], account_number="1234560000")  # 끝 0000 → 계좌 정보 오류
    assert BOOKS not in [g["id"] for g in client.get(f"{API}/fundings/{F_LAST}/settlement", headers=headers).json()["eligible_gifts"]]
    later(db)
    failed = client.get(f"{API}/fundings/{F_LAST}/settlement", headers=headers).json()
    assert failed["history"][0]["status"] == "failed" and failed["history"][0]["failure_reason"] == "ACCOUNT_INVALID"
    assert BOOKS in [g["id"] for g in failed["eligible_gifts"]]
    item = db.scalar(select(SettlementItem).where(SettlementItem.gift_id == BOOKS))
    assert item.is_active is False
    # 계좌를 다시 입력해 재요청 → 9999 는 은행 오류
    assert settle(client, headers, F_LAST, [BOOKS], account_number="1234569999").status_code == 201
    later(db)
    assert client.get(f"{API}/fundings/{F_LAST}/settlement", headers=headers).json()["history"][0]["failure_reason"] == "BANK_ERROR"
    assert settle(client, headers, F_LAST, [BOOKS]).status_code == 201


def test_settlement_validation(client):
    headers = token_of(client, SEOYEON)
    res = settle(client, headers, F_LAST, [BOOKS], bank="없는은행", account_number="12-34", account_holder="홍길동")
    assert res.status_code == 400 and res.json()["field_errors"] == {
        "bank": "은행을 선택해 주세요.",
        "account_number": "계좌번호는 숫자 10~14자리로 입력해 주세요.",
        "account_holder": "본인 명의 계좌만 등록할 수 있어요.",
    }
    empty = settle(client, headers, F_LAST, [BOOKS], account_number="", account_holder=" ")
    assert empty.json()["field_errors"] == {"account_number": "계좌번호를 입력해 주세요.", "account_holder": "예금주를 입력해 주세요."}
    assert settle(client, headers, F_LAST, []).json()["message"] == "정산할 선물을 선택해 주세요."
    assert settle(client, headers, F_LAST, [SPEAKER]).status_code == 404  # 다른 펀딩의 선물
    unmet = settle(client, headers, F_LAST, [CHAIR])  # 미달 + 처리 전
    assert unmet.status_code == 400 and unmet.json()["message"] == "정산할 수 없는 선물이 포함되어 있어요."
    assert settle(client, headers, seed_id("f_noone"), [seed_id("gift_tumbler")]).status_code == 400  # 0원
    assert settle(client, headers, F_MY24, [seed_id("gift_moodlight")]).json()["code"] == "FUNDING_NOT_ACTIVE"
    assert settle(client, token_of(client, JIHOON), F_LAST, [BOOKS]).status_code == 403


def test_carryover_can_be_reopened_in_next_funding(client):
    """이월한 의자(80,000원)를 다음 생일 펀딩에서 다시 열면 시작 모금액이 된다"""
    from app.services.validation import today

    headers = token_of(client, SEOYEON)
    shortfall(client, headers, CHAIR, "carryover")
    chair = next(c for c in client.get(f"{API}/me/carryovers", headers=headers).json() if c["gift_name"] == "캠핑 릴렉스 의자")
    body = {"name": "다음 생일", "group_id": seed_id("g_college"), "start_date": today().isoformat(), "end_date": today().isoformat(), "gifts": [], "carryover_ids": [chair["id"]]}
    fid = client.post(f"{API}/fundings", headers=headers, json=body).json()["id"]
    gift = client.get(f"{API}/me/fundings/{fid}", headers=headers).json()["gifts"][0]
    assert gift["raised_amount"] == 80000 and gift["remaining_amount"] == 40000 and gift["carried_over_amount"] == 80000


# ───────── 동시 정산 요청 (실제 커밋 — 끝나면 지운다) ─────────


def test_concurrent_settlement_requests_save_once():
    results: list = [None, None]
    barrier = threading.Barrier(2)

    def run(i):
        with Session(engine) as s:
            user = s.scalar(select(User).where(User.email == SEOYEON))
            barrier.wait()
            try:
                results[i] = service.request_settlement(s, F_DONE, user, SettlementRequest(gift_ids=[SPEAKER], **ACCOUNT))
            except ApiError as e:
                results[i] = e.code

    threads = [threading.Thread(target=run, args=(i,)) for i in range(2)]
    try:
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        assert results.count("CONFLICT") == 1
        with Session(engine) as s:
            assert len(s.scalars(select(SettlementItem).where(SettlementItem.gift_id == SPEAKER)).all()) == 1
    finally:
        with Session(engine) as s:
            ids = s.scalars(select(Settlement.id).where(Settlement.funding_id == F_DONE)).all()
            s.execute(delete(SettlementItem).where(SettlementItem.settlement_id.in_(ids)))
            s.execute(delete(Settlement).where(Settlement.id.in_(ids)))
            s.commit()
