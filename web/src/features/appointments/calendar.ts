import type { Appointment } from '@sanjeevani/shared/types/appointment';

/** Escape RFC 5545 TEXT values, preventing user notes from injecting properties. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
}

/** Fold content lines at 75 UTF-8 octets without splitting a Unicode character. */
function foldLine(value: string): string {
  const encoder = new TextEncoder();
  let result = '';
  let length = 0;
  for (const character of value) {
    const size = encoder.encode(character).length;
    if (length + size > 75) {
      result += '\r\n ';
      length = 1;
    }
    result += character;
    length += size;
  }
  return result;
}

/** UTC calendar timestamps preserve the appointment instant across timezones. */
function timestamp(value: string | Date): string {
  return new Date(value)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

/** Build a portable calendar event with an explicitly assumed 30-minute duration. */
export function appointmentIcs(appointment: Appointment, now = new Date()): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Sanjeevani//Care Appointments//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${encodeURIComponent(appointment.id)}@sanjeevani`,
    `DTSTAMP:${timestamp(now)}`,
    `DTSTART:${timestamp(appointment.dateTime)}`,
    `DTEND:${timestamp(new Date(Date.parse(appointment.dateTime) + 30 * 60_000))}`,
    `SUMMARY:${escapeText(`Visit with ${appointment.doctorName}`)}`,
    `LOCATION:${escapeText(appointment.location)}`,
    `DESCRIPTION:${escapeText(`${appointment.specialty}\n${appointment.notes}\nCalendar duration: 30 minutes (estimate).`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ]
    .map(foldLine)
    .join('\r\n');
}

/** Google Calendar's compose page; opening it does not create an event. */
export function googleCalendarUrl(appointment: Appointment): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Visit with ${appointment.doctorName}`,
    dates: `${timestamp(appointment.dateTime)}/${timestamp(new Date(Date.parse(appointment.dateTime) + 30 * 60_000))}`,
    location: appointment.location,
    details: `${appointment.specialty}\n${appointment.notes}\nDuration: 30 minutes (estimate).`,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

/** Generate and download a small .ics file entirely on the device. */
export function downloadAppointment(appointment: Appointment): void {
  const url = URL.createObjectURL(
    new Blob([appointmentIcs(appointment)], { type: 'text/calendar;charset=utf-8' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = 'sanjeevani-appointment.ics';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
