# 프론트엔드(Next.js) 배포용 이미지 — 빌드 단계 / 실행 단계로 나눠 이미지를 작게 만든다
# docker compose up -d --build 로 DB · 백엔드와 함께 켜진다 (http://localhost:3000)

# ───────── 1단계: 빌드 ─────────
FROM node:22-alpine AS builder
WORKDIR /app

# 패키지 목록이 바뀔 때만 다시 설치 (빌드 캐시)
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# NEXT_PUBLIC_* 값은 빌드할 때 화면 코드에 들어간다 → docker-compose.yml 의 build.args 로 넘긴다
# API 주소는 사용자 "브라우저" 기준이라 http://localhost:8000 (컨테이너 이름 backend 가 아님)
ARG NEXT_PUBLIC_API_MODE=http
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_MODE=$NEXT_PUBLIC_API_MODE \
    NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_TELEMETRY_DISABLED=1
RUN mkdir -p public && npm run build

# ───────── 2단계: 실행 ─────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# 보안: root 가 아닌 사용자로 실행
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public
USER app

EXPOSE 3000
CMD ["node", "server.js"]
