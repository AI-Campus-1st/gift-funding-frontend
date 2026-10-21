"""그룹 · 초대 링크 (G1 ~ G9) — docs/backend/API.SPEC.md 4장"""

import pytest
from sqlalchemy import select

from app.models import Funding, Invite
from app.services.group import assert_can_open_funding
from app.errors import ApiError
from tests.conftest import API, seed_id, token_of

SEOYEON, JIHOON, MINA, DOYOON = (f"{n}@example.com" for n in ("seoyeon", "jihoon", "mina", "doyoon"))
COLLEGE, OFFICE, FAMILY, DOYOON_G = (seed_id(g) for g in ("g_college", "g_office", "g_family", "g_doyoon"))


def test_list_groups_split_created_and_joined(client):
    body = client.get(f"{API}/groups", headers=token_of(client, SEOYEON)).json()
    assert [g["name"] for g in body["created"]] == ["대학 친구들"]
    assert sorted(g["name"] for g in body["joined"]) == ["도윤 생일 모임", "회사 동료"]
    college = body["created"][0]
    assert college["is_admin"] is True and college["member_count"] == 3
    # 대학 친구들에는 서연 펀딩 5개 (100% 달성한 펀딩 포함)
    assert len(college["fundings"]) == 5
    # 연결 펀딩은 최신순 (시작일 최신 → 먼저)
    assert [f["name"] for f in college["fundings"]] == ["나의 24번째 생일선물", "후원 없이 끝난 펀딩", "100% 달성한 펀딩", "작년 생일 펀딩", "재작년 생일 펀딩"]
    assert {f["name"] for f in college["fundings"]} >= {"100% 달성한 펀딩", "나의 24번째 생일선물"}
    assert all(f["is_mine"] for f in college["fundings"])
    statuses = {f["name"]: f["status"] for f in college["fundings"]}
    assert statuses["나의 24번째 생일선물"] == "active" and statuses["작년 생일 펀딩"] == "ended"


def test_seed_fundings_are_opened_only_in_owner_created_groups(db):
    from app.models import Group

    rows = db.execute(select(Funding.owner_id, Group.admin_id).join(Group, Group.id == Funding.group_id)).all()
    assert rows and all(owner == admin for owner, admin in rows)


def test_create_group_and_validation(client):
    headers = token_of(client, MINA)
    res = client.post(f"{API}/groups", headers=headers, json={"name": "  스터디  ", "description": " 매주 화요일 "})
    assert res.status_code == 201
    detail = client.get(f"{API}/groups/{res.json()['id']}", headers=headers).json()
    assert detail["name"] == "스터디" and detail["description"] == "매주 화요일"
    assert detail["is_admin"] is True and detail["members"] == [{"id": detail["members"][0]["id"], "name": "박민아", "is_admin": True}]

    empty = client.post(f"{API}/groups", headers=headers, json={"name": " ", "description": ""})
    assert empty.status_code == 400 and empty.json()["message"] == "그룹 이름을 입력해 주세요."
    long = client.post(f"{API}/groups", headers=headers, json={"name": "가" * 31, "description": "나" * 101})
    assert long.json()["field_errors"] == {"name": "그룹 이름은 30자 이내로 입력해 주세요.", "description": "그룹 설명은 100자 이내로 입력해 주세요."}


def test_group_detail_permissions(client):
    headers = token_of(client, MINA)  # 민아는 회사 동료 그룹에 없다
    assert client.get(f"{API}/groups/{OFFICE}", headers=headers).status_code == 403
    assert client.get(f"{API}/groups/{seed_id('nothing')}", headers=headers).json()["code"] == "NOT_FOUND"
    assert client.get(f"{API}/groups/not-a-uuid", headers=headers).status_code == 404
    detail = client.get(f"{API}/groups/{COLLEGE}", headers=headers).json()
    assert detail["is_admin"] is False
    assert detail["members"][0] == {"id": seed_id("u_seoyeon"), "name": "김서연", "is_admin": True}
    assert all("email" not in m for m in detail["members"])


def test_update_group_only_by_creator(client):
    # 관리자(만든 사람) 서연 → 수정 가능
    res = client.patch(f"{API}/groups/{COLLEGE}", headers=token_of(client, SEOYEON), json={"name": " 대학 동기 ", "description": "새 설명"})
    assert res.status_code == 200
    assert res.json()["name"] == "대학 동기" and res.json()["description"] == "새 설명"
    assert len(res.json()["members"]) == 3
    # 참여자 지훈 → 403
    res = client.patch(f"{API}/groups/{COLLEGE}", headers=token_of(client, JIHOON), json={"name": "바꿈", "description": ""})
    assert res.status_code == 403 and res.json()["message"] == "그룹 관리자만 수정할 수 있어요."
    # 참여자가 아니면 403 (그룹 접근 권한 없음)
    assert client.patch(f"{API}/groups/{OFFICE}", headers=token_of(client, MINA), json={"name": "x", "description": ""}).status_code == 403
    # 검증
    bad = client.patch(f"{API}/groups/{COLLEGE}", headers=token_of(client, SEOYEON), json={"name": "", "description": ""})
    assert bad.status_code == 400 and bad.json()["field_errors"] == {"name": "그룹 이름을 입력해 주세요."}


def test_only_group_creator_can_open_funding(db):
    from app.models import User

    seoyeon = db.scalar(select(User).where(User.email == SEOYEON))
    assert assert_can_open_funding(db, COLLEGE, seoyeon).name == "대학 친구들"
    for group_id in (OFFICE, DOYOON_G, FAMILY, "bad-id"):  # 참여만 한 그룹 · 참여하지 않은 그룹 · 잘못된 ID
        with pytest.raises(ApiError) as e:
            assert_can_open_funding(db, group_id, seoyeon)
        assert e.value.code == "FORBIDDEN" and e.value.message == "내가 만든 그룹에만 펀딩을 열 수 있어요."


def test_invite_list_permissions(client):
    # 관리자 민아: 그룹의 모든 링크 (최신순)
    tokens = [i["token"] for i in client.get(f"{API}/groups/{FAMILY}/invites", headers=token_of(client, MINA)).json()]
    assert tokens == ["INVITE-MINA-2026", "INVITE-OLD-0000"]
    # 참여자 지훈: 관리 권한 없음
    res = client.get(f"{API}/groups/{FAMILY}/invites", headers=token_of(client, JIHOON))
    assert res.status_code == 403 and res.json()["message"] == "초대 링크는 그룹 관리자 또는 펀딩 생일자만 관리할 수 있어요."
    # 관리자도 그 펀딩 생일자도 아니면 펀딩 지정 링크도 볼 수 없다
    res = client.get(f"{API}/groups/{OFFICE}/invites", headers=token_of(client, SEOYEON), params={"funding_id": seed_id("f_jihoon")})
    assert res.status_code == 403  # 서연은 그 펀딩 생일자가 아니다


def test_create_and_deactivate_invite(client, db):
    headers = token_of(client, SEOYEON)
    res = client.post(f"{API}/groups/{COLLEGE}/invites", headers=headers, json={"funding_id": None})
    assert res.status_code == 201
    link = res.json()
    assert link["token"].startswith("INV_") and len(link["token"]) == 36
    assert link["funding_id"] is None and link["is_active"] is True and link["is_expired"] is False
    # 다른 그룹 펀딩 지정 → 400
    bad = client.post(f"{API}/groups/{COLLEGE}/invites", headers=headers, json={"funding_id": seed_id("f_jihoon")})
    assert bad.status_code == 400 and bad.json()["message"] == "이 그룹에 연결된 펀딩만 선택할 수 있어요."
    # 참여자 지훈은 그룹 링크를 만들 수 없다
    assert client.post(f"{API}/groups/{COLLEGE}/invites", headers=token_of(client, JIHOON), json={"funding_id": None}).status_code == 403
    # 비활성화 → 204, 다시 확인하면 INVITE_INACTIVE
    assert client.patch(f"{API}/invites/{link['token']}", headers=headers, json={"is_active": False}).status_code == 204
    invite = db.scalar(select(Invite).where(Invite.token == link["token"]))
    assert invite.is_active is False and invite.deactivated_at is not None
    assert client.get(f"{API}/invites/{link['token']}", headers=headers).json()["code"] == "INVITE_INACTIVE"
    assert client.patch(f"{API}/invites/NOPE", headers=headers, json={"is_active": False}).status_code == 404


def test_funding_owner_manages_own_funding_invite(client):
    # 회사 동료(관리자 지훈)에서 지훈 펀딩 링크 → 생일자 = 관리자. 도윤 생일 모임 관리자 도윤도 자기 그룹 링크 관리 가능
    headers = token_of(client, DOYOON)
    res = client.post(f"{API}/groups/{DOYOON_G}/invites", headers=headers, json={"funding_id": seed_id("f_doyoon")})
    assert res.status_code == 201 and res.json()["funding_name"] == "도윤 생일 러닝 펀딩"
    assert res.json()["is_expired"] is True  # 종료된 펀딩 지정 링크는 만료


def test_invite_preview_and_errors(client):
    headers = token_of(client, DOYOON)
    preview = client.get(f"{API}/invites/INVITE-MINA-2026", headers=headers).json()
    assert preview == {
        "token": "INVITE-MINA-2026",
        "group_name": "민아네 생일 모임",
        "funding_name": "민아 생일 축하 펀딩",
        "owner_name": "박민아",
        "already_joined": False,
        "target_funding_id": seed_id("f_mina"),
    }
    res = client.get(f"{API}/invites/NOPE", headers=headers)
    assert res.status_code == 404 and res.json()["code"] == "INVITE_INVALID"
    res = client.get(f"{API}/invites/INVITE-OLD-0000", headers=headers)
    assert res.status_code == 410 and res.json()["code"] == "INVITE_INACTIVE"
    assert client.get(f"{API}/invites/INVITE-MINA-2026").status_code == 401


def test_join_by_invite_is_idempotent(client):
    headers = token_of(client, DOYOON)
    first = client.post(f"{API}/invites/INVITE-MINA-2026/join", headers=headers).json()
    assert first == {"group_id": FAMILY, "target_funding_id": seed_id("f_mina"), "target_is_mine": False, "already_joined": False}
    second = client.post(f"{API}/invites/INVITE-MINA-2026/join", headers=headers).json()
    assert second["already_joined"] is True
    detail = client.get(f"{API}/groups/{FAMILY}", headers=headers).json()
    assert detail["member_count"] == 3


def test_group_link_target_is_latest_active_friend_funding(client):
    # 대학 친구들 그룹 링크: 진행 중인 다른 사람 펀딩 → 지훈 입장에서는 서연의 나의 24번째 생일선물
    owner = token_of(client, SEOYEON)
    token = client.post(f"{API}/groups/{COLLEGE}/invites", headers=owner, json={"funding_id": None}).json()["token"]
    preview = client.get(f"{API}/invites/{token}", headers=token_of(client, JIHOON)).json()
    assert preview["target_funding_id"] == seed_id("f_my24") and preview["already_joined"] is True
    # 서연 본인에게는 자기 펀딩으로 이동하지 않는다 → null (그룹 상세로)
    mine = client.get(f"{API}/invites/{token}", headers=owner).json()
    assert mine["target_funding_id"] is None and mine["funding_name"] is None and mine["owner_name"] is None
    # 진행 중인 펀딩이 없는 그룹(도윤 생일 모임) → null
    t2 = client.post(f"{API}/groups/{DOYOON_G}/invites", headers=token_of(client, DOYOON), json={"funding_id": None}).json()["token"]
    joined = client.post(f"{API}/invites/{t2}/join", headers=token_of(client, MINA)).json()
    assert joined["target_funding_id"] is None and joined["already_joined"] is False
