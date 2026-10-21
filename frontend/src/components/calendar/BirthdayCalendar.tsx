"use client";

/**
 * BirthdayCalendar — 월별 생일 달력 (FullCalendar, F-15)
 *
 * 생일은 매년 반복되므로, 화면에 보이는 기간(연도들)에 맞춰 각 생일 일정을 그 해의 날짜로 펼쳐서 보여준다.
 * 2월 29일 생일은 평년에 2월 28일로 표시한다.
 * 사용 위치: 생일 캘린더(UI-28). SSR 없이 브라우저에서만 그린다(next/dynamic, ssr: false).
 */
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import koLocale from "@fullcalendar/core/locales/ko";
import type { EventInput, EventSourceFuncArg } from "@fullcalendar/core";
import { toDateString } from "@/lib/format";
import type { BirthdayEvent } from "@/types";

interface BirthdayCalendarProps {
  events: BirthdayEvent[];
  onSelectEvent: (event: BirthdayEvent) => void;
}

function occurrencesInRange(events: BirthdayEvent[], start: Date, end: Date): EventInput[] {
  const result: EventInput[] = [];
  for (let year = start.getFullYear(); year <= end.getFullYear(); year += 1) {
    for (const e of events) {
      const month = Number(e.birthday.slice(5, 7)) - 1;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const day = Math.min(Number(e.birthday.slice(8, 10)), lastDay);
      const date = new Date(year, month, day);
      if (date >= start && date < end) {
        result.push({ id: `${e.id}-${year}`, title: `🎂 ${e.friendName}`, start: toDateString(date), allDay: true, extendedProps: { eventId: e.id } });
      }
    }
  }
  return result;
}

export default function BirthdayCalendar({ events, onSelectEvent }: BirthdayCalendarProps) {
  return (
    <div className="birthday-calendar">
      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        locale={koLocale}
        height="auto"
        fixedWeekCount={false}
        headerToolbar={{ left: "prev", center: "title", right: "today next" }}
        buttonHints={{ prev: "이전 달", next: "다음 달", today: "오늘로 이동" }}
        dayMaxEventRows={2}
        events={(info: EventSourceFuncArg, success: (events: EventInput[]) => void) => success(occurrencesInRange(events, info.start, info.end))}
        eventClick={(arg) => {
          const found = events.find((e) => e.id === arg.event.extendedProps.eventId);
          if (found) onSelectEvent(found);
        }}
      />
    </div>
  );
}
