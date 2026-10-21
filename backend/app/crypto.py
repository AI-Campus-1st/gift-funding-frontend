"""
정산 계좌번호 암호화 (docs/backend/API.SPEC.md S3 "계좌번호 암호화 저장" · 2026-10-19 확정)

- 파이썬 cryptography 라이브러리의 Fernet(AES + 위조 검사)을 쓴다.
- 열쇠는 .env 의 ACCOUNT_ENCRYPTION_KEY (코드 · DB 에 두지 않는다).
  만들기:  python3 -c "import base64,os;print(base64.urlsafe_b64encode(os.urandom(32)).decode())"
- DB(settlements.account_number)에는 암호문만 저장한다. 화면에는 뒤 4자리만 보여준다 (mask_account).
"""

from functools import lru_cache

from cryptography.fernet import Fernet

from app.config import get_settings


@lru_cache
def _fernet() -> Fernet:
    return Fernet(get_settings().account_encryption_key.encode())


def encrypt_account(account_number: str) -> str:
    return _fernet().encrypt(account_number.encode()).decode()


def decrypt_account(token: str) -> str:
    return _fernet().decrypt(token.encode()).decode()


def mask_account(account_number: str) -> str:
    """뒤 4자리만 보이게: 1234567890 → ******7890"""
    if len(account_number) <= 4:
        return account_number
    return "*" * (len(account_number) - 4) + account_number[-4:]
