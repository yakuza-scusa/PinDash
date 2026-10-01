import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { AppShell } from "../../components/app-shell";
import { PageHeader } from "../../components/page-header";

const days = ["Mon 29", "Tue 30", "Wed 1", "Thu 2", "Fri 3", "Sat 4", "Sun 5"];
const events = [
  {
    day: 2,
    time: "18:30",
    title: "Small balcony garden checklist",
    tone: "blue",
  },
  { day: 4, time: "20:00", title: "Seven calm corners", tone: "coral" },
  { day: 5, time: "11:00", title: "Weekend brunch board", tone: "gold" },
];

export default function CalendarPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Publishing"
        title="Calendar"
        description="Plan, review, and track every scheduled Pin."
        action={
          <a className="button button-primary" href="/pins/new">
            <Plus size={17} /> Schedule Pin
          </a>
        }
      />
      <section className="panel calendar-panel">
        <div className="calendar-toolbar">
          <div>
            <button className="icon-button" aria-label="Previous week">
              <ChevronLeft size={18} />
            </button>
            <button className="icon-button" aria-label="Next week">
              <ChevronRight size={18} />
            </button>
          </div>
          <h2>September 29 – October 5</h2>
          <button className="button button-secondary">Today</button>
        </div>
        <div className="week-grid">
          {days.map((day, index) => (
            <div
              className={`calendar-day ${index === 1 ? "today" : ""}`}
              key={day}
            >
              <strong>{day}</strong>
              <div className="day-events">
                {events
                  .filter((event) => event.day === index)
                  .map((event) => (
                    <article
                      className={`calendar-event ${event.tone}`}
                      key={event.title}
                    >
                      <span>{event.time}</span>
                      <b>{event.title}</b>
                    </article>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
