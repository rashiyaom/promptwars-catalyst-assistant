import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Test Suite Discovery Guard', () => {
  it('discovers at least 15 test suites and prevents vacuous test execution', () => {
    const testDir = path.resolve(__dirname);
    const testFiles = fs.readdirSync(testDir).filter((file) => file.endsWith('.test.ts'));
    expect(testFiles.length).toBeGreaterThanOrEqual(15);
  });
});
