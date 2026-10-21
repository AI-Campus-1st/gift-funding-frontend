"use client";

/**
 * UI-14 그룹 생성 (/create-group, ?returnTo=/create-funding)
 * - 그룹 이름(필수) · 설명(선택). 생성자는 자동으로 그룹 관리자가 된다.
 * - 성공 시 그룹 상세(UI-15)로 이동. 펀딩 생성 중에 왔다면 펀딩 생성 화면으로 돌아간다.
 */
import { TEXT_LIMITS } from "@/lib/constants";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { FormField, InlineAlert } from "@/components/common/FormField";
import { RetroWindow } from "@/components/layout/RetroWindow";
import { Screen } from "@/components/layout/Screen";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/api/client";
import { useCreateGroupMutation } from "@/hooks/queries/groups";
import { getSafeRedirect } from "@/lib/auth";
import { loadFundingDraft, saveFundingDraft } from "@/lib/fundingDraft";
import { withFreshState } from "@/lib/withFreshState";

function CreateGroupPage() {
  const router = useRouter();
  const returnTo = useSearchParams().get("returnTo");
  const backHref = getSafeRedirect(returnTo, "/group");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false); // 성공 후 화면 이동이 끝날 때까지 잠근다
  const createMutation = useCreateGroupMutation();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (name.trim().length === 0) {
      setNameError("그룹 이름을 입력해 주세요.");
      document.getElementById("group-name")?.focus();
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const { id } = await createMutation.mutateAsync({ name, description });
      toast.success("그룹을 만들었어요!");
      if (returnTo === "/create-funding") {
        // 펀딩 생성 중이었다면 방금 만든 그룹을 선택해 둔다
        saveFundingDraft({ ...loadFundingDraft(), groupId: id });
        router.replace("/create-funding");
      } else {
        router.replace(`/group-detail/${id}`);
      }
    } catch (error) {
      setFormError(getErrorMessage(error, "그룹 생성에 실패했어요. 잠시 후 다시 시도해 주세요."));
      setSubmitting(false);
    }
  }

  return (
    <Screen title="그룹 만들기" backHref={backHref}>
      <RetroWindow title="new_group.exe" tone="sky">
        <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormField id="group-name" label="그룹 이름" required error={nameError} hint="예) 대학 친구들, 가족, 회사 동료">
            {(p) => (
              <Input
                {...p}
                maxLength={TEXT_LIMITS.groupName}
                placeholder="그룹 이름을 입력해 주세요"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameError(null);
                }}
              />
            )}
          </FormField>
          <FormField id="group-description" label="그룹 설명 (선택)">
            {(p) => <Textarea {...p} maxLength={TEXT_LIMITS.groupDescription} placeholder="어떤 모임인지 적어 주세요" value={description} onChange={(e) => setDescription(e.target.value)} />}
          </FormField>
          <p className="rounded-sm bg-memo px-3 py-2 text-caption font-medium text-warning">그룹은 비공개예요. 초대 링크를 받은 사람만 참여할 수 있어요.</p>
          {formError && <InlineAlert>{formError}</InlineAlert>}
          <div className="flex flex-col gap-2">
            <Button type="submit" block loading={submitting} loadingText="그룹 만드는 중...">
              그룹 생성
            </Button>
            <Button type="button" variant="secondary" block size="md" onClick={() => router.push(backHref)} disabled={submitting}>
              취소
            </Button>
          </div>
        </form>
      </RetroWindow>
    </Screen>
  );
}

export default withFreshState(CreateGroupPage);
