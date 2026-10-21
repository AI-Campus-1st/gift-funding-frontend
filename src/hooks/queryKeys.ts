/**
 * TanStack Query 쿼리 키 모음 (docs/ARCHITECTURE.md 5.2)
 *
 * - 쿼리 키는 이 파일에서만 만든다. (rules.md 10.1)
 * - 앞부분이 같은 키는 한 번에 무효화된다. 예) fundings.all 무효화 → 내 펀딩 · 친구 펀딩 · 상세 모두 다시 조회
 */
export const queryKeys = {
  me: ["me"] as const,
  preference: ["me", "preference"] as const,

  groups: {
    all: ["groups"] as const,
    detail: (groupId: string) => ["groups", groupId] as const,
  },
  invites: {
    group: (groupId: string) => ["invites", groupId] as const,
    list: (groupId: string, fundingId: string | null) => ["invites", groupId, fundingId] as const,
    preview: (token: string) => ["invites", "preview", token] as const,
  },

  fundings: {
    all: ["fundings"] as const,
    mine: ["fundings", "mine"] as const,
    myDetail: (fundingId: string) => ["fundings", "mine", fundingId] as const,
    supporters: (fundingId: string) => ["fundings", fundingId, "supporters"] as const,
    friends: ["fundings", "friends"] as const,
    friendDetail: (fundingId: string) => ["fundings", "friend", fundingId] as const,
  },
  gifts: {
    all: ["gifts"] as const,
    edit: (giftId: string) => ["gifts", "edit", giftId] as const,
    donation: (giftId: string) => ["gifts", "donation", giftId] as const,
  },
  carryovers: {
    all: ["carryovers"] as const,
    pending: ["carryovers", "pending"] as const,
  },

  donations: {
    mine: ["donations", "mine"] as const,
    mineByFunding: (fundingId?: string) => ["donations", "mine", fundingId ?? "all"] as const,
    detail: (donationId: string) => ["donations", "detail", donationId] as const,
  },
  messages: {
    all: ["messages"] as const,
    byFunding: (fundingId?: string) => ["messages", fundingId ?? "all"] as const,
  },
  settlement: (fundingId: string) => ["settlement", fundingId] as const,

  birthdayEvents: {
    all: ["birthday-events"] as const,
    linkable: ["birthday-events", "linkable"] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    unread: ["notifications", "unread"] as const,
  },
};
