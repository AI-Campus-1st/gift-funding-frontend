"use client";

/**
 * withFreshState — 새로 이동할 때마다 화면 상태를 초기화하는 래퍼 (HOC: Higher-Order Component, 컴포넌트를 감싸는 함수)
 *
 * 배경: Next.js 16(cacheComponents)은 React <Activity> 로 이전 화면을 숨겨서 보관한다.
 * 그래서 로그인/후원 버튼의 "처리 중..." 같은 상태가 다음 방문 때 그대로 남아
 * "로그인 중..." 에서 멈춘 것처럼 보이는 문제가 생긴다.
 *
 * 해결: router.bfcacheId 를 key 로 사용한다.
 * - 링크 클릭 · router.push/replace 로 "새로" 들어오면 bfcacheId 가 바뀌어 화면이 처음 상태로 다시 그려진다.
 * - 브라우저 뒤로/앞으로 가기에서는 같은 값이라 작성 중이던 내용이 유지된다.
 * 사용 위치: src/app 의 각 page.tsx 마지막 줄 `export default withFreshState(XxxPage)`
 */
import { useRouter } from "next/navigation";
import type { ComponentType } from "react";

export function withFreshState<P extends object>(Page: ComponentType<P>) {
  function FreshPage(props: P) {
    const { bfcacheId } = useRouter();
    return <Page key={bfcacheId} {...props} />;
  }
  FreshPage.displayName = `withFreshState(${Page.displayName ?? Page.name})`;
  return FreshPage;
}
