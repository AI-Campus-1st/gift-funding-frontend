"""
02_data.sql (개발 · 테스트용 초기 데이터) 생성 스크립트

- 프론트 Mock 시드(frontend/src/lib/mock/seed.ts)와 같은 계정 · 그룹 · 펀딩 · 후원을 넣는다.
- 날짜는 SQL 의 CURRENT_DATE 기준 상대값으로 넣어서, 언제 DB를 만들어도
  "진행 중 / 종료" 펀딩이 그대로 나온다. (DB 시간대 Asia/Seoul)
- ID 는 Mock ID 로 만든 고정 UUID (uuid5) → 다시 만들어도 같은 값.
- 비밀번호는 Argon2 해시로 저장한다. (모든 테스트 계정: password123)
- 펀딩 기간 최대 21일 규칙(DB CHECK)에 맞게 Mock 보다 긴 기간은 줄였다.

사용법 (프로젝트 루트에서)
    pip install argon2-cffi
    python db/scripts/generate_seed.py          # → db/02_data.sql 생성
"""

from __future__ import annotations

import uuid
from pathlib import Path
from urllib.parse import quote

from argon2 import PasswordHasher

OUT = Path(__file__).resolve().parent.parent / "02_data.sql"
NAMESPACE = uuid.UUID("6f1c2a52-6b1e-4c0b-9a52-0d3c5e7f9a11")  # 이 프로젝트 고정 네임스페이스
PASSWORD = "password123"


def uid(mock_id: str) -> str:
    """Mock ID → 고정 UUID"""
    return str(uuid.uuid5(NAMESPACE, mock_id))


def q(value: str | None) -> str:
    """SQL 문자열 리터럴"""
    if value is None:
        return "NULL"
    return "'" + value.replace("'", "''") + "'"


def day(offset: int) -> str:
    """오늘 기준 n일 뒤 DATE"""
    return f"(CURRENT_DATE + {offset})"


def at(offset: int, hour: int = 12, minute: int = 0) -> str:
    """오늘 기준 n일 뒤 특정 시각 TIMESTAMPTZ (세션 시간대 Asia/Seoul)"""
    return f"((CURRENT_DATE + {offset}) + TIME '{hour:02d}:{minute:02d}')::timestamptz"


def birthday_in(offset: int, year: int) -> str:
    """오늘 기준 n일 뒤의 월 · 일을 가진 생년월일 (2월 29일 → 평년이면 2월 28일)"""
    d = f"(CURRENT_DATE + {offset})"
    return f"({d} - make_interval(years => extract(year FROM {d})::int - {year}))::date"


def gift_image(emoji: str, start: str, end: str) -> str:
    """외부 이미지 없이 쓰는 SVG 썸네일 data URL (Mock 과 같은 그림)"""
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240">'
        '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'
        f'<stop offset="0" stop-color="{start}"/><stop offset="1" stop-color="{end}"/>'
        '</linearGradient></defs><rect width="320" height="240" fill="url(#g)"/>'
        f'<text x="160" y="150" font-size="96" text-anchor="middle">{emoji}</text></svg>'
    )
    return "data:image/svg+xml;charset=utf-8," + quote(svg, safe="-_.!~*'()")


def arr(values: list[str]) -> str:
    return "ARRAY[" + ", ".join(q(v) for v in values) + "]::text[]" if values else "'{}'::text[]"


# ───────── 데이터 (seed.ts 기준) ─────────

USERS = [
    # mock_id, 이름, 이메일, 생일(offset, year), 취향(keywords, categories, price_range)
    ("u_seoyeon", "김서연", "seoyeon@example.com", (28, 2002), (["음악", "캠핑", "향수"], ["전자기기", "취미"], "100k-300k")),
    ("u_jihoon", "이지훈", "jihoon@example.com", (1, 1999), ([], [], None)),
    ("u_mina", "박민아", "mina@example.com", (0, 2001), ([], [], None)),
    ("u_doyoon", "최도윤", "doyoon@example.com", (-40, 2000), ([], [], None)),
]

GROUPS = [
    # mock_id, 이름, 설명, 관리자, 참여자(관리자 포함), 만든 날
    ("g_college", "대학 친구들", "새내기 때부터 함께한 동기 모임", "u_seoyeon", ["u_seoyeon", "u_jihoon", "u_mina"], -800),
    ("g_office", "회사 동료", "디자인팀 점심 메이트", "u_jihoon", ["u_jihoon", "u_seoyeon", "u_doyoon"], -120),
    ("g_family", "민아네 생일 모임", "", "u_mina", ["u_mina", "u_jihoon"], -20),
    # 펀딩은 그 그룹을 만든 사람만 열 수 있다 (2026-10-19 확정) → 도윤이는 자기 생일용 그룹을 따로 만든다
    ("g_doyoon", "도윤 생일 모임", "", "u_doyoon", ["u_doyoon", "u_jihoon", "u_seoyeon"], -70),
]

FUNDINGS = [
    # mock_id, 생일자, 그룹, 이름, 시작(offset), 종료(offset)   ※ 최대 21일 · 그룹은 생일자가 만든 그룹
    ("f_my24", "u_seoyeon", "g_college", "나의 24번째 생일선물", -10, 10),
    ("f_mylast", "u_seoyeon", "g_college", "작년 생일 펀딩", -360, -340),
    ("f_done", "u_seoyeon", "g_college", "100% 달성한 펀딩", -90, -75),
    ("f_noone", "u_seoyeon", "g_college", "후원 없이 끝난 펀딩", -50, -30),
    ("f_my22", "u_seoyeon", "g_college", "재작년 생일 펀딩", -725, -705),
    ("f_jihoon", "u_jihoon", "g_office", "지훈이의 27번째 생일", -5, 1),
    ("f_doyoon", "u_doyoon", "g_doyoon", "도윤 생일 러닝 펀딩", -50, -30),
    ("f_mina", "u_mina", "g_family", "민아 생일 축하 펀딩", -3, 10),
]

INVITES = [
    # mock_id, 토큰, 그룹, 펀딩(없으면 그룹 링크), 만든 사람, 활성, 만든 날
    ("inv_college", "INVITE-COLLEGE-24", "g_college", "f_my24", "u_seoyeon", True, -10),
    ("inv_mina", "INVITE-MINA-2026", "g_family", "f_mina", "u_mina", True, -3),
    ("inv_old", "INVITE-OLD-0000", "g_family", None, "u_mina", False, -30),
]

GIFTS = [
    # mock_id, 펀딩, 이름, 가격, (이모지, 색1, 색2), 구매 URL, 설명, 미달 처리
    ("gift_headphone", "f_my24", "노이즈캔슬링 무선 헤드폰", 359000, ("🎧", "#F7C4E8", "#C8DDF7"), "https://example.com/products/headphone", "출퇴근길에 쓰고 싶어요!", None),
    ("gift_moodlight", "f_my24", "레트로 무드등", 39000, ("💡", "#FFF1B8", "#F7C4E8"), "https://example.com/products/mood-light", "", None),
    ("gift_chair", "f_mylast", "캠핑 릴렉스 의자", 120000, ("🏕️", "#C8DDF7", "#DCC5F3"), "https://example.com/products/camping-chair", "", None),
    ("gift_books", "f_mylast", "에세이 책 세트", 30000, ("📚", "#DCC5F3", "#FFF1B8"), "https://example.com/products/essay-set", "", None),
    ("gift_speaker", "f_done", "블루투스 스피커", 89000, ("🔊", "#DCC5F3", "#C8DDF7"), "https://example.com/products/speaker", "", None),
    ("gift_tumbler", "f_noone", "스테인리스 텀블러", 25000, ("🥤", "#C8DDF7", "#FFF1F9"), "https://example.com/products/tumbler", "", None),
    ("gift_camera", "f_my22", "필름 카메라", 150000, ("📷", "#FFF1B8", "#DCC5F3"), "https://example.com/products/film-camera", "여행 사진 찍고 싶어요", "carryover"),
    ("gift_console", "f_jihoon", "휴대용 게임기", 398000, ("🎮", "#C8DDF7", "#F7C4E8"), "https://example.com/products/game-console", "같이 게임해요 🙌", None),
    ("gift_keyboard", "f_jihoon", "기계식 키보드", 159000, ("⌨️", "#F3E7F5", "#C8DDF7"), "https://example.com/products/keyboard", "", None),
    ("gift_shoes", "f_doyoon", "러닝화", 129000, ("👟", "#FFF1B8", "#C8DDF7"), "https://example.com/products/running-shoes", "", None),
    ("gift_perfume", "f_mina", "플로럴 향수 50ml", 150000, ("🌸", "#F7C4E8", "#FFF1F9"), "https://example.com/products/perfume", "", None),
]

DONATIONS = [
    # mock_id, 펀딩, 선물, 후원자, 금액, 시각(offset, hour)
    ("d_1", "f_my24", "gift_headphone", "u_jihoon", 100000, (-8, 10)),
    ("d_2", "f_my24", "gift_headphone", "u_mina", 80000, (-6, 21)),
    ("d_3", "f_my24", "gift_headphone", "u_jihoon", 30000, (-2, 9)),
    ("d_4", "f_my24", "gift_moodlight", "u_mina", 39000, (-5, 18)),
    ("d_5", "f_mylast", "gift_chair", "u_jihoon", 50000, (-355, 12)),
    ("d_6", "f_mylast", "gift_chair", "u_mina", 30000, (-350, 12)),
    ("d_7", "f_mylast", "gift_books", "u_mina", 30000, (-345, 12)),
    ("d_8", "f_jihoon", "gift_console", "u_doyoon", 200000, (-4, 12)),
    ("d_9", "f_jihoon", "gift_console", "u_seoyeon", 50000, (-3, 20)),
    ("d_10", "f_jihoon", "gift_keyboard", "u_doyoon", 150000, (-2, 12)),
    ("d_11", "f_doyoon", "gift_shoes", "u_jihoon", 100000, (-48, 12)),
    ("d_12", "f_doyoon", "gift_shoes", "u_seoyeon", 29000, (-45, 12)),
    ("d_15", "f_done", "gift_speaker", "u_jihoon", 50000, (-85, 12)),
    ("d_16", "f_done", "gift_speaker", "u_mina", 39000, (-80, 12)),
    ("d_14", "f_my22", "gift_camera", "u_jihoon", 60000, (-715, 12)),
    ("d_13", "f_mina", "gift_perfume", "u_jihoon", 60000, (-1, 12)),
]

MESSAGES = [
    # mock_id, 후원, 내용
    ("m_1", "d_1", "생일 축하해! 🎂 좋은 노래 많이 들어!"),
    ("m_2", "d_2", "태어나줘서 고마워 💗 올해도 잘 부탁해~"),
    ("m_3", "d_9", "오늘 하루 행복하게 보내! 🎉"),
    ("m_4", "d_6", "항상 좋은 일만 가득하길 ✨"),
]

# 재작년 펀딩의 필름 카메라(60,000원)를 다음 생일로 이월 → "이월 선물 불러오기"로 다시 열 수 있다
CARRYOVERS = [("co_camera", "u_seoyeon", "f_my22", "gift_camera", 60000, -700)]

BIRTHDAY_EVENTS = [
    # mock_id, 주인, 친구 이름, 생일(offset, year), 연결 펀딩
    ("be_1", "u_seoyeon", "이지훈", (1, 1999), "f_jihoon"),
    ("be_2", "u_seoyeon", "박민아", (0, 2001), "f_mina"),
    ("be_3", "u_seoyeon", "최도윤", (-40, 2000), "f_doyoon"),
    ("be_4", "u_seoyeon", "엄마", (45, 1972), None),
]


def build() -> str:
    ph = PasswordHasher()  # Argon2id 기본 설정 (백엔드도 같은 라이브러리로 검증)
    lines: list[str] = [
        "-- =====================================================================",
        "-- 02_data.sql — 개발 · 테스트용 초기 데이터 (db/scripts/generate_seed.py 로 생성, 직접 수정하지 말 것)",
        "--",
        "-- 테스트 계정 (비밀번호 모두 password123)",
        "--   seoyeon@example.com 김서연 · jihoon@example.com 이지훈 · mina@example.com 박민아 · doyoon@example.com 최도윤",
        "-- 초대 링크: INVITE-MINA-2026(활성) · INVITE-OLD-0000(비활성) · INVITE-COLLEGE-24(서연 펀딩)",
        "-- 날짜는 CURRENT_DATE 기준 상대값 → 언제 만들어도 진행 중 / 종료 펀딩이 유지된다.",
        "-- 실제 배포 DB에는 넣지 않는다.",
        "-- =====================================================================",
        "",
        "BEGIN;",
        "SET LOCAL TIME ZONE 'Asia/Seoul';",
        "",
        "-- 회원 · 취향",
    ]
    for mid, name, email, (b_off, b_year), (kw, cats, pr) in USERS:
        lines.append(
            "INSERT INTO users (id, name, email, password_hash, birthday, created_at, updated_at) VALUES "
            f"({q(uid(mid))}, {q(name)}, {q(email)}, {q(ph.hash(PASSWORD))}, {birthday_in(b_off, b_year)}, {at(-900)}, {at(-900)});"
        )
    for mid, _name, _email, _b, (kw, cats, pr) in USERS:
        lines.append(
            "INSERT INTO user_preferences (user_id, keywords, categories, price_range) VALUES "
            f"({q(uid(mid))}, {arr(kw)}, {arr(cats)}, {q(pr)});"
        )

    lines += ["", "-- 그룹 · 참여자 (관리자도 참여자)"]
    for mid, name, desc, admin, members, created in GROUPS:
        lines.append(
            "INSERT INTO groups (id, name, description, admin_id, created_at, updated_at) VALUES "
            f"({q(uid(mid))}, {q(name)}, {q(desc)}, {q(uid(admin))}, {at(created)}, {at(created)});"
        )
        for i, member in enumerate(members):
            lines.append(
                "INSERT INTO group_members (group_id, user_id, joined_at) VALUES "
                f"({q(uid(mid))}, {q(uid(member))}, {at(created + (0 if i == 0 else 1))});"
            )

    lines += ["", "-- 펀딩 (상태는 날짜로 계산: 진행 중 f_my24 · f_jihoon · f_mina / 종료 나머지)"]
    for mid, owner, group, name, start, end in FUNDINGS:
        lines.append(
            "INSERT INTO fundings (id, owner_id, group_id, name, start_date, end_date, created_at, updated_at) VALUES "
            f"({q(uid(mid))}, {q(uid(owner))}, {q(uid(group))}, {q(name)}, {day(start)}, {day(end)}, {at(start - 1)}, {at(start - 1)});"
        )

    lines += ["", "-- 초대 링크"]
    for mid, token, group, funding, creator, active, created in INVITES:
        lines.append(
            "INSERT INTO invites (id, token, group_id, funding_id, created_by, is_active, created_at, deactivated_at) VALUES "
            f"({q(uid(mid))}, {q(token)}, {q(uid(group))}, {q(uid(funding)) if funding else 'NULL'}, {q(uid(creator))}, "
            f"{'true' if active else 'false'}, {at(created)}, {'NULL' if active else at(created + 5)});"
        )

    lines += ["", "-- 선물 (price = 목표 금액)"]
    order: dict[str, int] = {}
    starts = {f[0]: f[4] for f in FUNDINGS}
    for mid, funding, name, price, (emoji, c1, c2), url, desc, shortfall in GIFTS:
        order[funding] = order.get(funding, 0) + 1
        decided = at(-702) if shortfall else "NULL"
        created = at(starts[funding] - 1)
        lines.append(
            "INSERT INTO gifts (id, funding_id, name, price, image_url, product_url, description, sort_order, shortfall_action, shortfall_decided_at, created_at, updated_at) VALUES "
            f"({q(uid(mid))}, {q(uid(funding))}, {q(name)}, {price}, {q(gift_image(emoji, c1, c2))}, {q(url)}, {q(desc)}, "
            f"{order[funding]}, {q(shortfall)}, {decided}, {created}, {created});"
        )

    lines += ["", "-- 후원"]
    for mid, funding, gift, supporter, amount, (off, hour) in DONATIONS:
        lines.append(
            "INSERT INTO donations (id, funding_id, gift_id, supporter_id, amount, idempotency_key, created_at) VALUES "
            f"({q(uid(mid))}, {q(uid(funding))}, {q(uid(gift))}, {q(uid(supporter))}, {amount}, {q('seed-' + mid[2:])}, {at(off, hour)});"
        )

    lines += ["", "-- 축하 메시지"]
    donation_time = {d[0]: d[5] for d in DONATIONS}
    for mid, donation, content in MESSAGES:
        off, hour = donation_time[donation]
        lines.append(
            "INSERT INTO messages (id, donation_id, content, created_at) VALUES "
            f"({q(uid(mid))}, {q(uid(donation))}, {q(content)}, {at(off, hour)});"
        )

    lines += ["", "-- 이월 (다시 열기 전: pending)"]
    for mid, owner, funding, gift, amount, created in CARRYOVERS:
        lines.append(
            "INSERT INTO carryovers (id, owner_id, funding_id, gift_id, amount, status, created_at) VALUES "
            f"({q(uid(mid))}, {q(uid(owner))}, {q(uid(funding))}, {q(uid(gift))}, {amount}, 'pending', {at(created)});"
        )

    lines += ["", "-- 생일 일정"]
    for mid, owner, friend, (b_off, b_year), funding in BIRTHDAY_EVENTS:
        lines.append(
            "INSERT INTO birthday_events (id, owner_id, friend_name, birthday, linked_funding_id, created_at, updated_at) VALUES "
            f"({q(uid(mid))}, {q(uid(owner))}, {q(friend)}, {birthday_in(b_off, b_year)}, {q(uid(funding)) if funding else 'NULL'}, {at(-30)}, {at(-30)});"
        )

    lines += ["", "-- 정산 · 알림: 초기 데이터 없음 (정산은 화면에서 요청, 알림은 백엔드 작업이 생성)", "", "COMMIT;", ""]
    return "\n".join(lines)


if __name__ == "__main__":
    OUT.write_text(build(), encoding="utf-8")
    print(f"생성 완료: {OUT}")
