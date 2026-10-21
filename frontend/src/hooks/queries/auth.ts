/**
 * 사용자 관리 데이터 훅 (F-01 · F-02) — 프로필 · 선물 취향
 * 로그인 · 로그아웃 상태는 lib/auth.tsx(AuthProvider)가 관리한다.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { changePassword, getPreference, signup, updatePreference, updateProfile } from "@/lib/api/auth";
import type { GiftPreference, ProfileInput, SignupInput } from "@/types";
import { queryKeys } from "../queryKeys";

export function usePreferenceQuery() {
  return useQuery({ queryKey: queryKeys.preference, queryFn: getPreference });
}

/** 취향 저장 · 항목 삭제 — 저장 결과로 캐시를 바로 바꾼다 */
export function useUpdatePreferenceMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GiftPreference) => updatePreference(input),
    onSuccess: (saved) => qc.setQueryData(queryKeys.preference, saved),
  });
}

export function useUpdateProfileMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ProfileInput) => updateProfile(input),
    onSuccess: (user) => qc.setQueryData(queryKeys.me, user),
  });
}

/** 회원가입 — 캐시에 남길 데이터가 없어 무효화는 하지 않는다 */
export function useSignupMutation() {
  return useMutation({ mutationFn: (input: SignupInput) => signup(input) });
}

/** A8 비밀번호 변경 — 캐시에 바뀌는 데이터가 없다 */
export function useChangePasswordMutation() {
  return useMutation({ mutationFn: (input: { currentPassword: string; newPassword: string; newPasswordConfirm: string }) => changePassword(input) });
}
