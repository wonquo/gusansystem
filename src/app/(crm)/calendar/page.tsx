import { CompanyCalendar } from "@/components/erp/company-calendar";
import { requireAppUser } from "@/lib/auth";
import { listCalendarAttendeeOptions, listCalendarEvents } from "@/lib/calendar";

export default async function CalendarPage() {
  await requireAppUser();
  const [events, attendeeOptions] = await Promise.all([
    listCalendarEvents(),
    listCalendarAttendeeOptions(),
  ]);

  return <CompanyCalendar attendeeOptions={attendeeOptions} initialEvents={events} />;
}
