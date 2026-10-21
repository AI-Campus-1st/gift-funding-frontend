"use client";

/**
 * BirthdayPicker — 연도 · 월 · 일을 각각 선택하는 날짜 선택 UI (F-01, 01_auth.md)
 *
 * - 선택한 월에 없는 날짜(예: 2월 30일)는 목록에 나오지 않는다 → 존재하지 않는 날짜 선택 방지
 * - 미래 날짜는 선택 목록에서 제외한다 (allowFuture=false 일 때)
 * - value / onChange 는 "YYYY-MM-DD" 문자열. 세 칸이 모두 선택되기 전에는 "" 를 전달한다.
 * 사용 위치: 회원가입(UI-02), 프로필 수정(UI-25), 생일 캘린더 일정 등록(UI-28)
 */
import { useState } from "react";
import { NativeSelect } from "@/components/ui/input";

interface BirthdayPickerProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  allowFuture?: boolean;
  invalid?: boolean;
  describedBy?: string;
}

export function BirthdayPicker({ id, value, onChange, onBlur, allowFuture = false, invalid, describedBy }: BirthdayPickerProps) {
  const [year, setYear] = useState(value.slice(0, 4));
  const [month, setMonth] = useState(value ? String(Number(value.slice(5, 7))) : "");
  const [day, setDay] = useState(value ? String(Number(value.slice(8, 10))) : "");

  // 외부에서 value 가 바뀌면(예: 프로필 불러오기) 선택 상태도 맞춘다
  // (React 권장 패턴: effect 대신 렌더링 중에 이전 값과 비교해 상태를 조정)
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    if (value) {
      setYear(value.slice(0, 4));
      setMonth(String(Number(value.slice(5, 7))));
      setDay(String(Number(value.slice(8, 10))));
    }
  }

  const today = new Date();
  const thisYear = today.getFullYear();
  const years = Array.from({ length: 120 }, (_, i) => String(thisYear - i));
  const maxMonth = !allowFuture && Number(year) === thisYear ? today.getMonth() + 1 : 12;
  const months = Array.from({ length: maxMonth }, (_, i) => String(i + 1));
  const daysInMonth = year && month ? new Date(Number(year), Number(month), 0).getDate() : 31;
  const isCurrentMonth = !allowFuture && Number(year) === thisYear && Number(month) === today.getMonth() + 1;
  const maxDay = isCurrentMonth ? Math.min(daysInMonth, today.getDate()) : daysInMonth;
  const days = Array.from({ length: maxDay }, (_, i) => String(i + 1));

  function emit(y: string, m: string, d: string) {
    // 월·연도를 바꿔서 기존 일이 범위를 벗어나면 일을 초기화
    const dim = y && m ? new Date(Number(y), Number(m), 0).getDate() : 31;
    const safeDay = d && Number(d) <= dim ? d : "";
    if (safeDay !== d) setDay(safeDay);
    onChange(y && m && safeDay ? `${y}-${m.padStart(2, "0")}-${safeDay.padStart(2, "0")}` : "");
  }

  const common = { "aria-invalid": invalid, "aria-describedby": describedBy, onBlur };
  return (
    <fieldset className="grid grid-cols-[1.3fr_1fr_1fr] gap-2" aria-describedby={describedBy}>
      <legend className="sr-only">연도, 월, 일 선택</legend>
      <NativeSelect id={id} aria-label="연도" value={year} {...common} onChange={(e) => { setYear(e.target.value); emit(e.target.value, month, day); }}>
        <option value="">연도</option>
        {years.map((y) => <option key={y} value={y}>{y}년</option>)}
      </NativeSelect>
      <NativeSelect aria-label="월" value={month} {...common} onChange={(e) => { setMonth(e.target.value); emit(year, e.target.value, day); }}>
        <option value="">월</option>
        {months.map((m) => <option key={m} value={m}>{m}월</option>)}
      </NativeSelect>
      <NativeSelect aria-label="일" value={day} {...common} onChange={(e) => { setDay(e.target.value); emit(year, month, e.target.value); }}>
        <option value="">일</option>
        {days.map((d) => <option key={d} value={d}>{d}일</option>)}
      </NativeSelect>
    </fieldset>
  );
}
