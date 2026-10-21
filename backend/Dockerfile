# 백엔드(FastAPI) 이미지 — docker-compose.yml 의 backend 서비스가 사용
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    TZ=Asia/Seoul

WORKDIR /app

# 의존성 먼저 설치 (코드만 바뀌면 이 단계는 캐시를 재사용해서 빨라진다)
COPY requirements.txt .
RUN pip install -r requirements.txt

# 코드 복사
COPY app ./app
COPY tests ./tests
COPY pytest.ini .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
