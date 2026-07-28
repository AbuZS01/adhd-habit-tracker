import Link from 'next/link';
import type { DayStatus } from '@/lib/planner';

const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SUBJECT_COLOR_COUNT = 6;
const MAX_VISIBLE_CHIPS = 3;

const STATUS_LABEL: Record<Exclude<DayStatus, null>, string> = {
  completed: 'Completed',
  partial: 'Partially completed',
  missed: 'Missed',
};

export interface GridChipItem {
  subjectIndex: number; // -1 for general/cross-curricular
  subjectName: string | null;
  completed: boolean;
}

export interface GridDay {
  date: string;
  dayNumber: number;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  status: DayStatus;
  items: GridChipItem[];
}

function colorClass(subjectIndex: number): string {
  return subjectIndex >= 0 ? `subject-color-${subjectIndex % SUBJECT_COLOR_COUNT}` : 'subject-color-general';
}

export default function PlannerMonthGrid({
  childId,
  monthIso,
  days,
}: {
  childId: string;
  monthIso: string;
  days: GridDay[];
}) {
  return (
    <div className="card planner-month-grid no-print">
      <div className="planner-month-weekdays">
        {WEEKDAY_HEADERS.map((label) => (
          <span key={label} className="planner-month-weekday">
            {label}
          </span>
        ))}
      </div>
      <div className="planner-month-days">
        {days.map((day) => {
          const visibleItems = day.items.slice(0, MAX_VISIBLE_CHIPS);
          const hiddenCount = day.items.length - visibleItems.length;
          return (
            <Link
              key={day.date}
              href={`/children/${childId}/planner?month=${monthIso}&day=${day.date}`}
              className={`planner-month-day${day.inMonth ? '' : ' outside'}${day.isSelected ? ' selected' : ''}`}
            >
              <span className={`planner-month-day-number${day.isToday ? ' today' : ''}`}>{day.dayNumber}</span>
              {day.status && (
                <span className={`planner-month-day-status dot ${day.status}`} title={STATUS_LABEL[day.status]} />
              )}
              <div className="planner-month-chips">
                {visibleItems.map((item, i) => (
                  <span
                    key={i}
                    className={`planner-month-chip ${colorClass(item.subjectIndex)}${item.completed ? ' done' : ''}`}
                    title={`${item.subjectName ?? 'General'}${item.completed ? ' — completed' : ' — not started'}`}
                  >
                    {item.completed ? '✓ ' : ''}
                    {item.subjectName ?? 'General'}
                  </span>
                ))}
                {hiddenCount > 0 && <span className="planner-month-more">+{hiddenCount} more</span>}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
