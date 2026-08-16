import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'apps', 'web', 'src', 'lib', 'i18n.tsx');
const source = fs.readFileSync(sourcePath, 'utf8');
const locales = ['zh-CN', 'zh-TW', 'en'];

function extractKeys(locale) {
  const marker = locale === 'en' ? 'en' : `'${locale}'`;
  const block = source.match(
    new RegExp(
      `  ${marker}: \\{([\\s\\S]*?)\\n  \\},\\n(?=  (?:'[^']+'|en):|\\} ?(?:as const)?;)`,
      'm',
    ),
  )?.[1];
  if (!block) throw new Error(`Locale block not found: ${locale}`);
  const keys = [...block.matchAll(/^\s{4}'([^']+)':/gm)].map((match) => match[1]);
  const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
  if (duplicates.length) throw new Error(`${locale} has duplicate keys: ${duplicates.join(', ')}`);
  return new Set(keys);
}

const keySets = Object.fromEntries(locales.map((locale) => [locale, extractKeys(locale)]));
const baseline = keySets.en;
const failures = [];
for (const locale of locales) {
  for (const key of baseline)
    if (!keySets[locale].has(key)) failures.push(`${locale} missing ${key}`);
  for (const key of keySets[locale])
    if (!baseline.has(key)) failures.push(`${locale} extra ${key}`);
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`i18n keys valid: ${baseline.size} keys across ${locales.length} locales`);
}
