"use client";

/**
 * UI-25 프로필 수정 (/edit-profile)
 * - 프로필 사진(선택) · 이름 · 생일 수정, 이메일은 조회만 가능
 * - 저장 성공 시 로그인 사용자 정보(AuthProvider)도 갱신하고 마이페이지로 이동
 */
import { TEXT_LIMITS } from "@/lib/constants";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Camera, Trash2 } from "lucide-react";
import { BirthdayPicker } from "@/components/common/BirthdayPicker";
import { FormField, InlineAlert } from "@/components/common/FormField";
import { RetroWindow } from "@/components/layout/RetroWindow";
import { Screen } from "@/components/layout/Screen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUpdateProfileMutation } from "@/hooks/queries/auth";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import { useAuth } from "@/lib/auth";
import { fileToResizedDataUrl, validateImageFile } from "@/lib/image";
import { validateBirthday, validateName } from "@/lib/validation";
import { ProfileAvatar } from "@/components/common/ProfileAvatar";
import { withFreshState } from "@/lib/withFreshState";

function EditProfilePage() {
  const { user, setUser } = useAuth();
  const router = useRouter();
  const [name, setName] = useState(user?.name ?? "");
  const [birthday, setBirthday] = useState(user?.birthday ?? "");
  const [image, setImage] = useState<string | null>(user?.profileImage ?? null);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const updateMutation = useUpdateProfileMutation();

  if (!user) return null;

  async function handleImage(file: File | undefined) {
    if (!file) return;
    const error = validateImageFile(file);
    if (error) {
      setErrors((p) => ({ ...p, image: error }));
      return;
    }
    try {
      setImage(await fileToResizedDataUrl(file, 320));
      setErrors((p) => ({ ...p, image: undefined }));
    } catch {
      setErrors((p) => ({ ...p, image: "이미지를 불러오지 못했어요." }));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const next = { name: validateName(name) ?? undefined, birthday: validateBirthday(birthday) ?? undefined };
    setErrors(next);
    if (next.name || next.birthday) return;
    setSaving(true);
    setFormError(null);
    try {
      setUser(await updateMutation.mutateAsync({ name, birthday, profileImage: image }));
      toast.success("프로필을 저장했어요.");
      router.push("/mypage");
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      setFormError(getErrorMessage(error, "저장하지 못했어요. 잠시 후 다시 시도해 주세요."));
      setSaving(false);
    }
  }

  return (
    <Screen title="프로필 수정" backHref="/mypage">
      <RetroWindow title="edit_profile.exe" tone="pink">
        <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-2">
            <ProfileAvatar name={name || user.name} image={image} size={96} />
            <div className="flex gap-2">
              <label className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-sm border-2 border-line-strong bg-surface px-3 text-body-sm font-bold shadow-button focus-within:outline focus-within:outline-3 focus-within:outline-info">
                <Camera className="size-4" aria-hidden /> 사진 변경
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={(e) => handleImage(e.target.files?.[0])} />
              </label>
              {image && (
                <Button type="button" variant="tertiary" size="sm" onClick={() => setImage(null)}>
                  <Trash2 aria-hidden /> 기본 이미지
                </Button>
              )}
            </div>
            {errors.image && <p role="alert" className="text-body-sm text-error">{errors.image}</p>}
          </div>
          <FormField id="profile-name" label="이름" required error={errors.name}>
            {(p) => <Input {...p} maxLength={TEXT_LIMITS.userName} value={name} onChange={(e) => setName(e.target.value)} />}
          </FormField>
          <FormField id="profile-email" label="이메일" hint="이메일은 변경할 수 없어요.">
            {(p) => <Input {...p} value={user.email} readOnly disabled />}
          </FormField>
          <FormField id="profile-birthday" label="생일" required error={errors.birthday}>
            {(p) => <BirthdayPicker id={p.id} value={birthday} onChange={setBirthday} invalid={p["aria-invalid"]} describedBy={p["aria-describedby"]} />}
          </FormField>
          {formError && <InlineAlert>{formError}</InlineAlert>}
          <div className="flex flex-col gap-2">
            <Button type="submit" block loading={saving} loadingText="저장 중...">
              저장
            </Button>
            <Button type="button" variant="secondary" block size="md" onClick={() => router.push("/mypage")} disabled={saving}>
              취소
            </Button>
          </div>
        </form>
      </RetroWindow>
    </Screen>
  );
}

export default withFreshState(EditProfilePage);
