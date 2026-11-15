import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
const files = execFileSync('git', ['ls-files', '-z']).toString().split('\0').filter(Boolean);
let bytes = 0;
for (const file of files) {
  if (!existsSync(file)) continue;
  if (
    /(^|\/)(node_modules|dist|coverage)\//.test(file) ||
    /(^|\/)\.env($|\.(?!example|emulator\.example))/.test(file)
  )
    throw Error(`Forbidden tracked file: ${file}`);
  bytes += statSync(file).size;
  if (!/\.(jpg|png|webp)$/.test(file)) {
    const text = readFileSync(file, 'utf8');
    if (
      /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----|\bsk_[A-Za-z0-9_-]{28,}|\bgsk_[A-Za-z0-9_-]{20,}|\bgh[pousr]_[A-Za-z0-9]{25,}/.test(
        text,
      )
    )
      throw Error(`Possible secret in: ${file}`);
  }
}

// Security audit: If web/dist is built, assert zero provider secrets in client assets.
const distAssets = 'web/dist/assets';
if (existsSync(distAssets)) {
  for (const asset of readdirSync(distAssets)) {
    if (asset.endsWith('.js')) {
      const code = readFileSync(join(distAssets, asset), 'utf8');
      if (/gsk_[A-Za-z0-9_-]{20,}|TAVUS_API_KEY|SARVAM_API_KEY/.test(code)) {
        throw Error(`Secret leak detected in web/dist/assets/${asset}`);
      }
    }
  }
}

if (bytes >= 10_000_000) throw Error(`Tracked source exceeds 10 MB: ${bytes}`);
console.log(
  `${files.length} tracked files; ${(bytes / 1_000_000).toFixed(2)} MB; no forbidden files or recognized secret patterns.`,
);
