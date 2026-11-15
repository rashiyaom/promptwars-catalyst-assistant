import { describe, expect, it } from 'vitest';
import { loadFunctionConfig } from '../functions/src/config.js';

describe('Cloud Functions Configuration', () => {
  it('loads safe defaults when environment variables are omitted', () => {
    const config = loadFunctionConfig({});
    expect(config.mockMode).toBe(true);
    expect(config.graceMinutes).toBe(30);
    expect(config.emailFrom).toBeNull();
  });

  it('respects valid configured grace period and mock mode', () => {
    const config = loadFunctionConfig({
      MOCK_MODE: 'false',
      GRACE_MINUTES: '45',
      EMAIL_FROM: 'reminders@sanjeevani.care',
    });
    expect(config.mockMode).toBe(false);
    expect(config.graceMinutes).toBe(45);
    expect(config.emailFrom).toBe('reminders@sanjeevani.care');
  });

  it('throws an error if GRACE_MINUTES is out of range', () => {
    expect(() => loadFunctionConfig({ GRACE_MINUTES: '2' })).toThrow(
      'GRACE_MINUTES must be an integer between 5 and 240.',
    );
    expect(() => loadFunctionConfig({ GRACE_MINUTES: '300' })).toThrow(
      'GRACE_MINUTES must be an integer between 5 and 240.',
    );
    expect(() => loadFunctionConfig({ GRACE_MINUTES: 'invalid' })).toThrow(
      'GRACE_MINUTES must be an integer between 5 and 240.',
    );
  });
});
