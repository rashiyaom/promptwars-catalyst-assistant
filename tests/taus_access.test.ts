import { describe, expect, it } from 'vitest';
import { carePermissions } from '../shared/types/access.js';
import { escalationSettingsSchema } from '../shared/schemas/notification.js';
import { nextSnoozeTime } from '../functions/src/lib/tausPolicy.js';
import { nextSnoozeTime as demoSnooze } from '../shared/types/taus.js';
import {
  requireIdentity,
  assertOwner,
  assertInvitation,
  tokenHash,
  inviteSchema,
} from '../functions/src/auth/accessPolicy.js';
import { doseAnswer } from '../web/src/features/taus/dialogue.js';
import { parseInvitation, readRoute } from '../web/src/app/routes.js';

const identity = { uid: 'elder-user', email: 'elder@example.test', displayName: 'Elder' };
const token = 'a'.repeat(64);
const invitation = {
  email: identity.email,
  role: 'elder',
  status: 'pending',
  tokenHash: tokenHash(token),
};
const uuid = '123e4567-e89b-42d3-a456-426614174000';

describe('Verified profile membership and invitations', () => {
  it('requires verified email identity and normalizes the email claim', () => {
    expect(() => requireIdentity({})).toThrow();
    expect(() =>
      requireIdentity({
        auth: { uid: 'a', token: { email: identity.email, email_verified: false } },
      }),
    ).toThrow();
    expect(
      requireIdentity({
        auth: { uid: 'a', token: { email: 'PERSON@example.test', email_verified: true } },
      }).email,
    ).toBe('person@example.test');
  });
  it('does not treat membership or original creation as ownership after caretaker handoff', () => {
    expect(() =>
      assertOwner({ ownerUid: 'caretaker-user', createdBy: identity.uid }, identity, true),
    ).toThrow();
    expect(() => assertOwner({ ownerUid: identity.uid }, identity, false)).toThrow();
    expect(() => assertOwner({ ownerUid: identity.uid }, identity, true)).not.toThrow();
  });
  it('accepts only the intended verified email with a valid unused invitation', () => {
    expect(assertInvitation(invitation, identity, token, 200, 100)).toBe('elder');
    for (const altered of [
      { email: 'someoneelse@example.test' },
      { status: 'accepted' },
      { status: 'revoked' },
      { tokenHash: 'invalid' },
      { role: 'admin' },
    ]) {
      expect(() =>
        assertInvitation({ ...invitation, ...altered }, identity, token, 200, 100),
      ).toThrow();
    }
    expect(() => assertInvitation(invitation, identity, 'b'.repeat(64), 200, 100)).toThrow();
    expect(() => assertInvitation(invitation, identity, token, 100, 100)).toThrow();
    expect(() => assertInvitation(invitation, identity, token, NaN, 100)).toThrow();
  });
  it('does not permit arbitrary roles or caller-provided ownership', () => {
    expect(
      inviteSchema.safeParse({ profileId: uuid, email: identity.email, role: 'doctor' }).success,
    ).toBe(true);
    expect(
      inviteSchema.safeParse({ profileId: uuid, email: identity.email, role: 'admin' }).success,
    ).toBe(false);
    expect(
      inviteSchema.safeParse({
        profileId: uuid,
        email: identity.email,
        role: 'doctor',
        ownerUid: identity.uid,
      }).success,
    ).toBe(false);
  });
  it('gives doctors care-plan access but reserves dose responses for the elder and caretaker', () => {
    expect(carePermissions('doctor').manageMedication).toBe(true);
    expect(carePermissions('doctor').logDose).toBe(false);
    expect(carePermissions('family').manageAppointments).toBe(false);
    expect(carePermissions('elder').logDose).toBe(true);
    expect(carePermissions('caretaker').logDose).toBe(true);
  });
  it('parses invitation fragments without accepting partial or path-traversal identifiers', () => {
    const hash = `#/connect?profileId=${uuid}&invitationId=${uuid}&token=${token}`;
    expect(readRoute(hash)).toBe('connect');
    expect(parseInvitation(hash)).toEqual({ profileId: uuid, invitationId: uuid, token });
    expect(parseInvitation('#/connect?profileId=../other')).toBeNull();
    expect(readRoute('#/unrecognized')).toBe('home');
  });
});

describe('Taus confirmation and reminder boundaries', () => {
  it('recognizes exact English and Hindi responses and refuses ambiguous confirmations', () => {
    for (const value of ['yes', 'Yes, I took it.', 'हाँ', 'जी हां', 'दवा ले ली।'])
      expect(doseAnswer(value)).toBe('taken');
    for (const value of ['no', 'not yet', 'अभी नहीं', 'नहीं ली'])
      expect(doseAnswer(value)).toBe('later');
    for (const value of [
      'yes but not sure',
      'yes no',
      'I took another medicine',
      'हाँ शायद',
      'mark all taken',
      'नहीं ली शायद',
    ])
      expect(doseAnswer(value)).toBeNull();
  });
  it('bounds follow-ups without ever extending the original alert deadline', () => {
    const due = 1_000_000;
    for (const policy of [nextSnoozeTime, demoSnooze]) {
      expect(policy(due, 30, 0, 'pending', due)).toBe(due + 600_000);
      expect(policy(due, 30, 1, 'pending', due + 600_000)).toBe(due + 1_200_000);
      expect(policy(due, 30, 1, 'pending', due + 1_200_000)).toBeNull();
      expect(policy(due, 30, 2, 'pending', due)).toBeNull();
      for (const status of ['missed', 'taken', 'skipped'])
        expect(policy(due, 30, 0, status, due)).toBeNull();
      for (const count of [-1, NaN, 0.5]) expect(policy(due, 30, count, 'pending', due)).toBeNull();
      expect(policy(due, 30, 0, 'pending', due - 1)).toBeNull();
    }
  });
  it('requires consent and a valid custom destination before enabling alerts', () => {
    const base = {
      enabled: true,
      email: 'care@example.test',
      smsNumber: '+919876543210',
      consentConfirmed: true,
    };
    expect(escalationSettingsSchema.safeParse(base).success).toBe(true);
    for (const altered of [
      { consentConfirmed: false },
      { email: '', smsNumber: '' },
      { smsNumber: '9876543210' },
      { email: 'invalid' },
    ])
      expect(escalationSettingsSchema.safeParse({ ...base, ...altered }).success).toBe(false);
  });
});
