"""
오류 응답 — API 명세 0.4 형식 { code, message, field_errors?, max_available? }

프론트(lib/api/http.ts)는 이 형식을 그대로 ApiError 로 바꿔 화면에 message 를 보여준다.
"""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

STATUS_BY_CODE = {
    "VALIDATION": 400,
    "UNAUTHORIZED": 401,
    "INVALID_CREDENTIALS": 401,
    "FORBIDDEN": 403,
    "NOT_FOUND": 404,
    "INVITE_INVALID": 404,
    "DUPLICATE_EMAIL": 409,
    "CONFLICT": 409,
    "GIFT_LOCKED": 409,
    "GOAL_REACHED": 409,
    "EXCEEDS_REMAINING": 409,
    "FUNDING_NOT_ACTIVE": 409,
    "INVITE_INACTIVE": 410,
    "INVITE_EXPIRED": 410,
    "RATE_LIMITED": 429,
    "AI_UNAVAILABLE": 502,
    "INTERNAL": 500,
}


class ApiError(Exception):
    def __init__(self, code: str, message: str, *, field_errors: dict[str, str] | None = None, max_available: int | None = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.field_errors = field_errors
        self.max_available = max_available

    @property
    def status(self) -> int:
        return STATUS_BY_CODE.get(self.code, 500)

    def body(self) -> dict:
        data: dict = {"code": self.code, "message": self.message}
        if self.field_errors:
            data["field_errors"] = self.field_errors
        if self.max_available is not None:
            data["max_available"] = self.max_available
        return data


def unauthorized() -> ApiError:
    return ApiError("UNAUTHORIZED", "로그인이 만료되었습니다. 다시 로그인해 주세요.")


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api_error(_: Request, exc: ApiError) -> JSONResponse:
        return JSONResponse(status_code=exc.status, content=exc.body())

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        # 요청 형식 자체가 틀린 경우 (필드 누락 · 타입 오류). 내용 검증 문구는 각 서비스가 만든다.
        field_errors: dict[str, str] = {}
        for err in exc.errors():
            loc = [str(p) for p in err.get("loc", []) if p not in ("body", "query", "path")]
            if loc:
                field_errors.setdefault(loc[0], "입력값을 확인해 주세요.")
        return JSONResponse(status_code=400, content=ApiError("VALIDATION", "입력값을 확인해 주세요.", field_errors=field_errors or None).body())

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        if exc.status_code == 404:
            return JSONResponse(status_code=404, content={"code": "NOT_FOUND", "message": "요청한 API를 찾을 수 없어요."})
        if exc.status_code == 405:
            return JSONResponse(status_code=405, content={"code": "NOT_FOUND", "message": "지원하지 않는 요청이에요."})
        return JSONResponse(status_code=exc.status_code, content={"code": "INTERNAL", "message": str(exc.detail)})

    @app.exception_handler(Exception)
    async def _internal(_: Request, __: Exception) -> JSONResponse:
        return JSONResponse(status_code=500, content={"code": "INTERNAL", "message": "잠시 후 다시 시도해 주세요."})
