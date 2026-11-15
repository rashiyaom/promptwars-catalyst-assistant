import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { SessionMemory } from '../src/core/memory';
import { loadConfig } from '../src/config';
import { SANJEEVANI_PERSONA } from '../src/core/persona';
import { elderProfileInputSchema } from '../shared/schemas/profile';
import { runAgent } from '../src/core/agent';
import { MockAssistantTool } from '../src/tools/mock_tools';

function collectFiles(dir: string, exts: string[] = ['.ts', '.tsx']): string[] {
  let files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (item !== 'node_modules' && item !== 'dist' && item !== 'lib') {
        files = files.concat(collectFiles(full, exts));
      }
    } else if (exts.some((ext) => item.endsWith(ext))) {
      files.push(full);
    }
  }
  return files;
}

describe('Core Behavioral and Safety Boundaries', () => {
  it('isolates session history, bounds turns, returns copies and clears it', () => {
    const m = new SessionMemory();
    expect(m.get('a')).toEqual([]);
    m.add('a', 'one', 2);
    m.add('a', 'two', 2);
    m.add('a', 'three', 2);
    m.add('b', 'other', 2);
    expect(m.get('a')).toEqual(['two', 'three']);
    expect(m.get('b')).toEqual(['other']);
    const copy = m.get('a') as string[];
    copy.push('mutated');
    expect(m.get('a')).toHaveLength(2);
    m.clear('a');
    expect(m.get('a')).toEqual([]);
  });

  it('retains safe defaults without Node globals and never implies treatment authority', () => {
    expect(loadConfig({ MOCK_MODE: 'false' }).mockMode).toBe(false);
    vi.stubGlobal('process', undefined);
    try {
      expect(loadConfig().mockMode).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
    expect(SANJEEVANI_PERSONA).toContain('do not diagnose');
  });

  it('accepts IANA zones and rejects bogus zones and extra profile privileges', () => {
    const input = { elderName: 'Demo', timezone: 'Asia/Kolkata', relationship: 'self' };
    expect(elderProfileInputSchema.safeParse(input).success).toBe(true);
    expect(elderProfileInputSchema.safeParse({ ...input, timezone: 'Fake/Zone' }).success).toBe(
      false,
    );
    expect(elderProfileInputSchema.safeParse({ ...input, role: 'admin' }).success).toBe(false);
  });

  it('returns structured failure when a response tool fails', async () => {
    const spy = vi
      .spyOn(MockAssistantTool.prototype, 'respond')
      .mockRejectedValueOnce(new Error('offline'));
    try {
      expect((await runAgent({ sessionId: 'failure', message: 'Hello' })).error?.code).toBe(
        'AGENT_FAILURE',
      );
    } finally {
      spy.mockRestore();
    }
  });

  it('rejects malformed and oversized agent requests without throwing', async () => {
    expect((await runAgent(null as never)).error?.code).toBe('INPUT_REJECTED');
    expect((await runAgent({ sessionId: 'test', message: 'x'.repeat(2001) })).success).toBe(false);
  });
});

describe('Architectural Layer Boundaries', () => {
  const root = path.resolve(__dirname, '..');

  it('enforces web imports src via public @sanjeevani/core index only', () => {
    const webFiles = collectFiles(path.join(root, 'web', 'src'));
    const deepImports: string[] = [];

    for (const file of webFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        // Disallow deep imports into src/ internals
        if (
          /from\s+['"][^'"]*src\/(core|guardrails|tools|models)/.test(line) ||
          /from\s+['"]@sanjeevani\/core\/.+['"]/.test(line)
        ) {
          deepImports.push(`${file}:${index + 1} -> ${line.trim()}`);
        }
      });
    }

    expect(
      deepImports,
      `Disallowed deep imports into src internals: ${deepImports.join('\n')}`,
    ).toEqual([]);
  });

  it('enforces src/core never imports from web', () => {
    const coreFiles = collectFiles(path.join(root, 'src', 'core'));
    const violations: string[] = [];

    for (const file of coreFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        if (/from\s+['"][^'"]*web\//.test(line) || /from\s+['"]@sanjeevani\/web/.test(line)) {
          violations.push(`${file}:${index + 1} -> ${line.trim()}`);
        }
      });
    }

    expect(violations, `Prohibited core -> web imports: ${violations.join('\n')}`).toEqual([]);
  });

  it('enforces guardrails never import tools', () => {
    const guardrailFiles = collectFiles(path.join(root, 'src', 'guardrails'));
    const violations: string[] = [];

    for (const file of guardrailFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        if (/from\s+['"][^'"]*tools\//.test(line)) {
          violations.push(`${file}:${index + 1} -> ${line.trim()}`);
        }
      });
    }

    expect(violations, `Prohibited guardrails -> tools imports: ${violations.join('\n')}`).toEqual(
      [],
    );
  });

  it('enforces shared imports nothing from src, web, or functions', () => {
    const sharedFiles = collectFiles(path.join(root, 'shared'));
    const violations: string[] = [];

    for (const file of sharedFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        if (
          /from\s+['"][^'"]*(src|web|functions)\//.test(line) ||
          /from\s+['"]@sanjeevani\/(core|web|functions)/.test(line)
        ) {
          violations.push(`${file}:${index + 1} -> ${line.trim()}`);
        }
      });
    }

    expect(violations, `Prohibited shared imports: ${violations.join('\n')}`).toEqual([]);
  });
});
