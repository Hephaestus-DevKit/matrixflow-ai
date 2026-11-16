import test from 'node:test';
import assert from 'node:assert/strict';
import {
  splitTextIntoChunks,
  distinctKnowledgeChunks,
  retrieveKnowledgeContext,
} from '../src/features.js';
import { buildContentPrompt } from '../src/content-prompts.js';

const handbook = `PR92 acceptance fixture. Fictional product; not for sale.
Product: MF92 Trail Bag.
Confirmed capacity: 23 liters.
Confirmed empty weight: 640 grams.
Material: recycled polyester.
Care: hand wash only; do not machine wash.
Waterproof certification: not supplied. Do not claim waterproof certification.
Warranty and discounts: not supplied. Mark as unconfirmed.
`;

test('short multiline handbook is one complete chunk, including final facts', () => {
  for (const text of [handbook, handbook.trimEnd(), handbook + '\n\n']) {
    const chunks = splitTextIntoChunks(text);
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].content, text.trim());
    assert.equal(chunks[0].charEnd, text.length);
  }
});
test('long multiline sources advance with bounded overlap and retain all text', () => {
  const text = handbook.repeat(50);
  const chunks = splitTextIntoChunks(text, 1200);
  assert.ok(chunks.length > 1 && chunks.length < 40);
  assert.equal(chunks.at(-1).charEnd, text.length);
  chunks.forEach((chunk, i) => {
    assert.ok(Buffer.byteLength(chunk.content) <= 1200);
    if (i) {
      assert.ok(chunk.charStart > chunks[i - 1].charStart);
      assert.ok(chunk.charStart <= chunks[i - 1].charEnd);
    }
  });
});
test('legacy shifted citations collapse while separate passages and documents survive', () => {
  const chunk = (start, value, id = 'doc') => ({ start, value, document: { id } });
  const entries = [
    chunk(0, handbook),
    ...Array.from({ length: 8 }, (_, i) => chunk(i + 1, handbook.slice(i + 1))),
    chunk(1000, 'Additional warranty facts'),
    chunk(0, handbook, 'another-doc'),
  ];
  const selected = distinctKnowledgeChunks(entries);
  assert.equal(selected.length, 3);
  assert.equal(selected[1].start, 1000);
});
test('retrieval removes historical overlapping windows before assigning source numbers', async () => {
  const services = {
    tables: {
      getRow: async () => ({ $id: 'kb', organizationId: 'team' }),
      listRows: async ({ tableId }) => ({
        total: 1,
        rows:
          tableId === 'knowledge_documents'
            ? [{ $id: 'doc', title: 'Handbook', indexVersion: 'v1' }]
            : Array.from({ length: 8 }, (_, i) => ({
                $id: `chunk-${i}`,
                documentId: 'doc',
                indexVersion: 'v1',
                charStart: i,
                content: handbook.slice(i),
              })),
      }),
    },
  };
  const result = await retrieveKnowledgeContext(
    services,
    { teamId: 'team' },
    { knowledgeBaseId: 'kb', question: 'MF92 capacity' },
  );
  assert.equal(result.citations.length, 1);
  assert.equal(result.citations[0].reference, 1);
  assert.match(result.contextText, /23 liters/);
  assert.equal((result.contextText.match(/\[Source /g) || []).length, 1);
});
test('English content instructions do not prescribe Chinese boilerplate', () => {
  for (const type of ['listing', 'faq', 'customer_service', 'product_title']) {
    const result = buildContentPrompt(
      type,
      { language: 'en' },
      { title: 'MF92' },
      '[Source 1: handbook] 23 liters',
    );
    assert.match(result.system, /Output language: English/);
    assert.match(
      result.system,
      /headings, introductions, caveats, missing-information labels and source notes/,
    );
    assert.match(result.system, /To be confirmed/);
    assert.doesNotMatch(result.system + result.prompt, /[\u3400-\u9fff]/u);
    assert.match(result.prompt, /23 liters/);
  }
});
test('language preference survives Chinese source text and multilingual mode keeps its explicit exception', () => {
  const english = buildContentPrompt(
    'listing',
    { language: 'en' },
    { title: '中文品牌' },
    '容量为23升',
  );
  assert.match(english.system, /Output language: English/);
  assert.match(english.prompt, /容量为23升/);
  assert.match(
    buildContentPrompt('faq', { language: 'zh-TW' }, {}, '').system,
    /Traditional Chinese/,
  );
  assert.match(
    buildContentPrompt('faq', { variables: { language: 'de' } }, {}, '').system,
    /Output language: German/,
  );
  const multi = buildContentPrompt('multilingual', { language: 'en' }, {}, '');
  assert.match(multi.system, /four language sections/);
  assert.match(multi.prompt, /English, German, French and Spanish/);
});

test('overlapping passages with different end facts are both retained', () => {
  const shared = 'Common product facts. '.repeat(20);
  const selected = distinctKnowledgeChunks([
    { document: { id: 'doc' }, start: 0, value: 'Warranty: one year. ' + shared },
    { document: { id: 'doc' }, start: 19, value: shared + 'Care: hand wash only.' },
  ]);
  assert.equal(selected.length, 2);
});
