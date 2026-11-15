import { expect, it, vi } from 'vitest';
import { SessionMemory } from '../src/core/memory';
import { loadConfig } from '../src/config';
import { SANJEEVANI_PERSONA } from '../src/core/persona';
import { elderProfileInputSchema } from '../shared/schemas/profile';
import { runAgent } from '../src/core/agent';
import { MockAssistantTool } from '../src/tools/mock_tools';

it('isolates session history, bounds turns, returns copies and clears it', () => {
  const m = new SessionMemory(); expect(m.get('a')).toEqual([]);
  m.add('a', 'one', 2); m.add('a', 'two', 2); m.add('a', 'three', 2); m.add('b', 'other', 2);
  expect(m.get('a')).toEqual(['two', 'three']); expect(m.get('b')).toEqual(['other']);
  const copy = m.get('a') as string[]; copy.push('mutated'); expect(m.get('a')).toHaveLength(2);
  m.clear('a'); expect(m.get('a')).toEqual([]);
});
it('retains safe defaults without Node globals and never implies treatment authority', () => {
  expect(loadConfig({ MOCK_MODE: 'false' }).mockMode).toBe(false);
  vi.stubGlobal('process', undefined);
  try { expect(loadConfig().mockMode).toBe(true); } finally { vi.unstubAllGlobals(); }
  expect(SANJEEVANI_PERSONA).toContain('do not diagnose');
});
it('accepts IANA zones and rejects bogus zones and extra profile privileges', () => {
  const input = { elderName: 'Demo', timezone: 'Asia/Kolkata', relationship: 'self' };
  expect(elderProfileInputSchema.safeParse(input).success).toBe(true);
  expect(elderProfileInputSchema.safeParse({ ...input, timezone: 'Fake/Zone' }).success).toBe(false);
  expect(elderProfileInputSchema.safeParse({ ...input, role: 'admin' }).success).toBe(false);
});
it('returns structured failure when a response tool fails', async () => {
  const spy = vi.spyOn(MockAssistantTool.prototype, 'respond').mockRejectedValueOnce(new Error('offline'));
  try { expect((await runAgent({ sessionId: 'failure', message: 'Hello' })).error?.code).toBe('AGENT_FAILURE'); } finally { spy.mockRestore(); }
});

it('rejects malformed and oversized agent requests without throwing', async () => {
  expect((await runAgent(null as never)).error?.code).toBe('INPUT_REJECTED');
  expect((await runAgent({sessionId: 'test', message: 'x'.repeat(2001)})).success).toBe(false);
});
