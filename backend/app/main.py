"""
FastAPI 서버 시작점

실행 (backend 폴더에서):  uvicorn app.main:app --reload
API 문서(테스트 화면):    http://localhost:8000/docs
모든 API 경로 앞에 /api/v1 이 붙는다 (프론트 lib/api/http.ts 와 같음).
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import get_settings
from app.db import engine
from app.errors import register_error_handlers
from app.routers import ai, auth, donation, funding, group, schedule, settlement

API_PREFIX = "/api/v1"

settings = get_settings()

app = FastAPI(title="생일선물 공동 펀딩 API", version="0.1.0", docs_url="/docs")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
register_error_handlers(app)

app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(group.router, prefix=API_PREFIX)
app.include_router(funding.router, prefix=API_PREFIX)
app.include_router(donation.router, prefix=API_PREFIX)
app.include_router(settlement.router, prefix=API_PREFIX)
app.include_router(schedule.router, prefix=API_PREFIX)
app.include_router(ai.router, prefix=API_PREFIX)


@app.get("/health", tags=["상태"], summary="서버 · DB 연결 확인")
def health() -> dict:
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return {"status": "ok", "db": "ok"}
