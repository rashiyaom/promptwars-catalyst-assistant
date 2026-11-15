import { describe, expect, it } from 'vitest';
import type { Medication } from '../shared/types/medication.js';
import type { Appointment } from '../shared/types/appointment.js';
import { addDays, adherenceWeek, dayPeriod, isScheduled, localDate, scheduledDoses, zonedInstant } from '../web/src/features/medications/schedule.js';
import { appointmentIcs, googleCalendarUrl } from '../web/src/features/appointments/calendar.js';
import { generateRoleCodes, joinSchema, profileSchema } from '../web/src/features/profiles/profileInput.js';

const medication: Medication = { id: 'med-1', name: 'Example prescription', dosage: 'As prescribed', times: ['08:00', '20:00'], frequency: { type: 'daily' }, startDate: '2026-11-01', endDate: null, notes: '', active: true };
const appointment: Appointment = { id: 'appointment-1', doctorName: 'Dr. Example', specialty: 'Review', dateTime: '2026-11-20T10:30:00+05:30', location: 'Clinic, Floor 2', notes: 'Bring ECG report\nFollow clinician’s preparation instructions.' };

describe('Profile-local schedules and adherence', () => {
  it('uses the profile calendar date even across a UTC day boundary', () => {
    expect(localDate(new Date('2026-11-14T23:30:00Z'), 'Asia/Kolkata')).toBe('2026-11-15');
    expect(localDate(new Date('2026-11-15T01:00:00Z'), 'America/New_York')).toBe('2026-11-14');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('creates independent IDs matching the backend for each dose', () => {
    const doses = scheduledDoses([medication], '2026-11-15', 'Asia/Kolkata');
    expect(doses.map((dose) => dose.id)).toEqual(['med-1_20261115023000000', 'med-1_20261115143000000']);
    const recorded = doses.map((dose, index) => index === 0 ? { ...dose, status: 'taken' as const } : dose);
    expect(adherenceWeek(recorded, '2026-11-15', 'Asia/Kolkata')[6]).toMatchObject({ taken: 1, pending: 1, total: 2 });
  });
  it('deduplicates time slots and sorts doses across medications', () => {
    const doses = scheduledDoses([{ ...medication, times: ['20:00', '08:00', '08:00'] }, { ...medication, id: 'med-2', times: ['07:00'] }], '2026-11-15', 'UTC');
    expect(doses).toHaveLength(3);
    expect(doses[0].medicationId).toBe('med-2');
  });
  it('honors start/end limits and paused schedules', () => {
    expect(isScheduled(medication, '2026-10-31')).toBe(false);
    expect(isScheduled({ ...medication, endDate: '2026-11-15' }, '2026-11-15')).toBe(true);
    expect(isScheduled({ ...medication, endDate: '2026-11-15' }, '2026-11-16')).toBe(false);
    expect(isScheduled({ ...medication, active: false }, '2026-11-15')).toBe(false);
  });
  it('handles default weekdays and custom weekend schedules', () => {
    expect(isScheduled({ ...medication, frequency: { type: 'weekdays' } }, '2026-11-15')).toBe(false);
    expect(isScheduled({ ...medication, frequency: { type: 'weekdays', days: [0, 6] } }, '2026-11-15')).toBe(true);
    expect(isScheduled({ ...medication, frequency: { type: 'weekdays' } }, '2026-11-16')).toBe(true);
  });
  it('anchors interval schedules to start date without DST drift', () => {
    const alternate: Medication = { ...medication, startDate: '2026-03-07', frequency: { type: 'interval', everyNDays: 2 } };
    expect(isScheduled(alternate, '2026-03-08')).toBe(false);
    expect(isScheduled(alternate, '2026-03-09')).toBe(true);
  });
  it('skips nonexistent DST wall times instead of silently shifting medication', () => {
    expect(zonedInstant('2026-03-08', '02:30', 'America/New_York')).toBeNull();
    expect(zonedInstant('2026-03-08', '03:30', 'America/New_York')?.toISOString()).toBe('2026-03-08T07:30:00.000Z');
    expect(zonedInstant('invalid', 'invalid', 'UTC')).toBeNull();
    expect(zonedInstant('2026-02-31', '08:00', 'UTC')).toBeNull();
    expect(zonedInstant('2026-11-15', '25:00', 'UTC')).toBeNull();
    expect(zonedInstant('2026-11-15', '08:00', 'Not/AZone')).toBeNull();
  });
  it('produces one dose for an ambiguous fall-back wall time', () => {
    const doses = scheduledDoses([{ ...medication, times: ['01:30'] }], '2026-11-01', 'America/New_York');
    expect(doses).toHaveLength(1);
    expect(localDate(new Date(doses[0].scheduledFor), 'America/New_York')).toBe('2026-11-01');
  });
  it('groups all period boundaries including midnight', () => {
    const periods = ['00:00', '04:59', '05:00', '11:59', '12:00', '16:59', '17:00', '20:59', '21:00'].map((time) => dayPeriod(`2026-11-15T${time}:00Z`, 'UTC'));
    expect(periods).toEqual(['Night', 'Night', 'Morning', 'Morning', 'Afternoon', 'Afternoon', 'Evening', 'Evening', 'Night']);
  });
  it('distinguishes missing history, missed, skipped, pending, and taken doses', () => {
    const doses = scheduledDoses([{ ...medication, times: ['01:00', '02:00', '03:00', '04:00'] }], '2026-11-15', 'UTC');
    const statuses = ['taken', 'missed', 'skipped', 'pending'] as const;
    const week = adherenceWeek(doses.map((dose, index) => ({ ...dose, status: statuses[index] })), '2026-11-15', 'UTC');
    expect(week).toHaveLength(7);
    expect(week[0]).toMatchObject({ date: '2026-11-09', total: 0, missed: 0 });
    expect(week[6]).toEqual({ date: '2026-11-15', total: 4, taken: 1, missed: 1, skipped: 1, pending: 1 });
  });
});

describe('Calendar export', () => {
  it('exports the correct UTC instant, stable ID and a 30-minute estimate', () => {
    const text = appointmentIcs(appointment, new Date('2026-11-15T00:00:00Z'));
    expect(text).toContain('DTSTART:20261120T050000Z\r\nDTEND:20261120T053000Z');
    expect(text).toContain('UID:appointment-1@sanjeevani');
    expect(text).toContain('DTSTAMP:20261115T000000Z');
    expect(text.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });
  it('escapes text and blocks CRLF property injection', () => {
    const text = appointmentIcs({ ...appointment, doctorName: 'Test\r\nATTENDEE:evil@example.com', notes: 'a;b,c\\d\rnext' });
    expect(text).not.toContain('\r\nATTENDEE:');
    expect(text.replace(/\r\n /g, '')).toContain('a\\;b\\,c\\\\d\\nnext');
    expect(text).toContain('LOCATION:Clinic\\, Floor 2');
  });
  it('folds long multilingual text at 75 UTF-8 bytes without losing content', () => {
    const notes = 'रिपोर्ट 💊 '.repeat(25);
    const text = appointmentIcs({ ...appointment, notes });
    for (const line of text.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(text.replace(/\r\n /g, '')).toContain(notes);
  });
  it('encodes Google Calendar parameters without changing appointment time or notes', () => {
    const url = new URL(googleCalendarUrl({ ...appointment, location: 'Clinic & Ward #3' }));
    expect(url.origin).toBe('https://calendar.google.com');
    expect(url.searchParams.get('dates')).toBe('20261120T050000Z/20261120T053000Z');
    expect(url.searchParams.get('location')).toBe('Clinic & Ward #3');
    expect(url.searchParams.get('details')).toContain(appointment.notes);
  });
});

describe('Profile form boundaries', () => {
  it('generates three distinct ten-digit numeric codes', () => {
    const codes = Object.values(generateRoleCodes());
    expect(new Set(codes).size).toBe(3);
    codes.forEach((code) => expect(code).toMatch(/^\d{10}$/));
  });
  it('validates IANA timezones and trims profile names', () => {
    expect(profileSchema.parse({ elderName: ' Elder ', displayName: ' Member ', timezone: 'Asia/Kolkata' }).elderName).toBe('Elder');
    expect(profileSchema.safeParse({ elderName: 'Elder', displayName: 'Member', timezone: 'Not/AZone' }).success).toBe(false);
    expect(profileSchema.safeParse({ elderName: ' ', displayName: 'Member', timezone: 'UTC' }).success).toBe(false);
  });
  it('rejects invalid profile IDs and malformed join codes before network calls', () => {
    const valid = { profileId: 'fe338d91-cf2f-4207-a76d-5748741def60', displayName: 'Member', passcode: '123456' };
    expect(joinSchema.safeParse(valid).success).toBe(true);
    expect(joinSchema.safeParse({ ...valid, profileId: '../profiles/other' }).success).toBe(false);
    expect(joinSchema.safeParse({ ...valid, passcode: '12345' }).success).toBe(false);
    expect(joinSchema.safeParse({ ...valid, passcode: 'abcdef' }).success).toBe(false);
  });
});
