interface GridItem {
  subjectName: string | null;
  completed: boolean;
}

interface GridDay {
  date: string;
  label: string;
  dayNumber: string;
  isToday: boolean;
  items: GridItem[];
}

export default function PlannerWeekGrid({ days }: { days: GridDay[] }) {
  return (
    <div className="card planner-week-grid no-print">
      {days.map((day) => (
        <a key={day.date} href={`#day-${day.date}`} className={`planner-grid-day${day.isToday ? ' today' : ''}`}>
          <div className="planner-grid-day-head">
            <span className="planner-grid-day-label">{day.label.slice(0, 3)}</span>
            <span className="planner-grid-day-number">{day.dayNumber}</span>
          </div>
          <div className="planner-grid-dots">
            {day.items.map((item, i) => (
              <span
                key={i}
                className={`planner-grid-dot ${item.completed ? 'done' : 'pending'}`}
                title={`${item.subjectName ?? 'General'}${item.completed ? ' — completed' : ' — not started'}`}
              />
            ))}
          </div>
        </a>
      ))}
    </div>
  );
}
