"""
설정 — 프로젝트 루트의 .env 를 읽는다 (DB 접속 정보 · JWT 비밀키는 환경 변수로만 관리, TechStack 6장)
"""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_ENV = Path(__file__).resolve().parents[2] / ".env"  # gift-funding/.env


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT_ENV, env_file_encoding="utf-8", extra="ignore")

    database_url: str  # postgresql://user:pw@localhost:5432/gift_funding
    jwt_secret: str  # 길고 예측 불가능한 값 (openssl rand -hex 32)
    jwt_algorithm: str = "HS256"
    # 정산 계좌번호 암호화 열쇠 (Fernet, 2026-10-19 확정). 바꾸면 이미 저장된 계좌번호를 읽을 수 없다
    account_encryption_key: str
    # 로그인 토큰 유효기간 30일 (2026-10-19 확정, Q16)
    # "로그인 상태 유지"는 프론트가 브라우저를 닫아도 토큰을 남길지만 정한다 (localStorage / sessionStorage)
    token_expire_days: int = 30
    # AI 선물 추천 (2026-10-20 확정: GPT). OPENAI_API_KEY → GEMINI_API_KEY → 둘 다 없으면 모의 추천 순서로 고른다
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"  # 저렴한 mini급 모델 (Q21). .env 의 OPENAI_MODEL 로 바꿀 수 있다
    gemini_api_key: str = ""
    # Flash 모델 (Q21). 2026-10-20: gemini-2.5-flash 는 새 사용자에게 막혀서(404) Google 안내대로 3.8 로 변경. .env 의 GEMINI_MODEL 로 바꿀 수 있다
    gemini_model: str = "gemini-3.8-flash"
    ai_timeout_seconds: float = 15.0  # Q22
    ai_rate_limit_per_minute: int = 5  # Q24 — 1인당 1분 요청 수 (Gemini 를 쓸 때만)
    # 프론트 주소 (CORS). 쉼표로 여러 개
    cors_origins: str = "http://localhost:3000"
    timezone: str = "Asia/Seoul"

    @property
    def sqlalchemy_url(self) -> str:
        """psycopg 3 드라이버를 쓰도록 주소 앞부분을 맞춘다"""
        url = self.database_url
        for prefix in ("postgresql+psycopg://", "postgresql://", "postgres://"):
            if url.startswith(prefix):
                return "postgresql+psycopg://" + url[len(prefix):]
        return url

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
