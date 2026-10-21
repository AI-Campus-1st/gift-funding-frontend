/**
 * 서버 응답(snake_case DTO) ↔ 프론트 타입(camelCase) 변환
 *
 * - 키 이름만 다른 응답은 fromDto(키 변환)로 바꾼다.
 * - 이름 · 구조가 다른 응답(사용자 이미지, 초대 참여 결과, 알림)은 전용 함수로 바꾼다.
 * - 화면 경로는 서버가 주지 않으므로 여기서 만든다. (rules.md 9.3)
 */
import { fundingDetailPath } from "@/lib/paths";
import type { AppNotification, JoinResult, ProfileInput, User } from "@/types";
import { toCamelDeep, toSnakeDeep, type Snake } from "./case";
import type { JoinResultDto, NotificationDto, ProfileRequestDto, UserDto } from "./dto";

/** 키 이름만 다른 응답 → 프론트 타입 */
export function fromDto<T>(dto: Snake<T>): T {
  return toCamelDeep<T>(dto);
}

/** 프론트 입력 → 서버 요청 본문 */
export function toDto<T>(input: T): Snake<T> {
  return toSnakeDeep(input);
}

export function toUser(dto: UserDto): User {
  return { id: dto.id, name: dto.name, email: dto.email, birthday: dto.birthday, profileImage: dto.profile_image_url };
}

export function toProfileRequest(input: ProfileInput): ProfileRequestDto {
  return { name: input.name, birthday: input.birthday, profile_image_url: input.profileImage };
}

/** 초대 참여 결과 → 이동할 화면 (지정 펀딩 > 그룹 상세) */
export function toJoinResult(dto: JoinResultDto): JoinResult {
  const redirectPath = dto.target_funding_id ? fundingDetailPath(dto.target_funding_id, dto.target_is_mine) : `/group-detail/${dto.group_id}`;
  return { redirectPath, alreadyJoined: dto.already_joined };
}

/** 알림 → 클릭 시 이동 경로 (미달 처리 알림 > 열람 가능한 연결 펀딩 > 생일 캘린더) */
export function toNotification(dto: NotificationDto): AppNotification {
  let href = dto.funding_id && dto.can_open_funding ? fundingDetailPath(dto.funding_id, dto.funding_is_mine) : "/birthday-calendar";
  if (dto.type === "shortfall-reminder" && dto.funding_id) href = `/my-funding-detail/${dto.funding_id}/unmet-goal`;
  return { id: dto.id, type: dto.type, title: dto.title, body: dto.body, createdAt: dto.created_at, isRead: dto.is_read, href };
}
