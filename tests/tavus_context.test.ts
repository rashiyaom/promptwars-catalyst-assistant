import { expect, it } from 'vitest';
import { buildTavusContext } from '../web/src/features/taus/tavusContext';
import {
  INITIAL_MEDICATIONS,
  INITIAL_APPOINTMENTS,
  DEFAULT_PROFILE,
} from '../web/src/context/demoData';

it('supplies only the selected patient context and preserves read-only safety instructions', () => {
  const context = buildTavusContext({
    profile: { ...DEFAULT_PROFILE, elderName: 'Demo Elder', ownerUid: 'private-owner' },
    medications: INITIAL_MEDICATIONS,
    appointments: INITIAL_APPOINTMENTS.map((a) => ({ ...a, dateTime: '2099-01-01T10:00:00Z' })),
    doses: [
      {
        id: 'd',
        medicationId: INITIAL_MEDICATIONS[0].id,
        scheduledFor: '2026-11-15T08:00:00Z',
        status: 'taken',
      },
    ],
    language: 'hi',
    now: '2026-11-15T00:00:00Z',
  });
  expect(context).toContain('Demo Elder');
  expect(context).toContain('Hindi');
  expect(context).toContain(INITIAL_MEDICATIONS[0].name);
  expect(context).toContain('taken');
  expect(context).toContain('READ-ONLY');
  expect(context).not.toContain('private-owner');
});
it('bounds large schedules, omits past appointments, handles missing medicine and English', () => {
  const context = buildTavusContext({
    profile: DEFAULT_PROFILE,
    medications: Array.from({ length: 30 }, (_, i) => ({
      ...INITIAL_MEDICATIONS[0],
      id: String(i),
    })),
    appointments: [{ ...INITIAL_APPOINTMENTS[0], dateTime: '2000-01-01T00:00:00Z' }],
    doses: [
      {
        id: 'd',
        medicationId: 'missing',
        scheduledFor: '2026-11-15T08:00:00Z',
        status: 'pending',
        nextReminderAt: '2026-11-15T08:10:00Z',
      },
    ],
    language: 'en',
    now: '2026-11-15T00:00:00Z',
  });
  const data = JSON.parse(context.split('\n').at(-1)!);
  expect(context).toContain('English');
  expect(data.medicines).toHaveLength(20);
  expect(data.appointments).toHaveLength(0);
  expect(data.todayDoses[0].medicine).toBe('Unavailable medicine');
});
