import { parseTranslationCsv, translationCsv } from '../src/lib/shopify-translations';
const headers = [
  'Type',
  'Identification',
  'Field',
  'Locale',
  'Market',
  'Status',
  'Default content',
  'Translated content',
  'extra',
];
const row = [
  'PRODUCT',
  '0009007199254740993',
  'title',
  'de',
  '',
  '',
  'A "bag", 23 L\r\n蓝',
  'Tasche',
  '0',
];
test('Shopify identifiers, UTF-8, carriage returns, quotes and extra columns survive delivery', () => {
  expect(parseTranslationCsv(translationCsv(headers, [row]))).toEqual({
    headers,
    rows: [row],
    skipped: 0,
  });
  expect(
    parseTranslationCsv(translationCsv(headers, [row, ['PAGE', ...row.slice(1)]])).skipped,
  ).toBe(1);
});
test('malformed quotes, missing columns and truncated rows cannot be imported', () => {
  for (const source of [
    'A,B\nx,y',
    translationCsv(headers, []) + '"unfinished',
    translationCsv(headers, [row.slice(1)]),
  ])
    expect(() => parseTranslationCsv(source)).toThrow('CSV_FORMAT');
});
