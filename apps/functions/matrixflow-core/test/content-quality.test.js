import test from 'node:test';
import assert from 'node:assert/strict';
import {
  splitTextIntoChunks,
  distinctKnowledgeChunks,
  commerceEvidence,
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

test('multiline index chunks stay near their byte budget without splitting Unicode characters', () => {
  const multiline = 'row\n'.repeat(25_000);
  assert.equal(splitTextIntoChunks(multiline).length, 5);
  const text = `${'a'.repeat(23_997)}🙂${'㐀'.repeat(20_000)}`;
  for (const { content } of splitTextIntoChunks(text)) {
    assert.ok(content.isWellFormed());
    assert.ok(Buffer.byteLength(content) <= 24_000);
  }
  assert.ok(splitTextIntoChunks(text).some(({ content }) => content.includes('🙂')));
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

for (const fullPreview of [true, false]) {
  test(`historical partial overlap preserves final facts; complete preview=${fullPreview}`, async () => {
    const text = handbook;
    const services = {
      tables: {
        getRow: async () => ({ $id: 'kb', organizationId: 'team' }),
        listRows: async ({ tableId }) => ({
          total: 2,
          rows:
            tableId === 'knowledge_documents'
              ? [
                  {
                    $id: 'doc',
                    title: 'Handbook',
                    indexVersion: 'old',
                    extractedText: fullPreview ? text : 'x'.repeat(2000),
                  },
                ]
              : [
                  {
                    $id: 'a',
                    documentId: 'doc',
                    indexVersion: 'old',
                    charStart: 0,
                    content: text.slice(0, 300),
                  },
                  {
                    $id: 'b',
                    documentId: 'doc',
                    indexVersion: 'old',
                    charStart: 140,
                    content: text.slice(140),
                  },
                ],
        }),
      },
    };
    const result = await retrieveKnowledgeContext(
      services,
      { teamId: 'team' },
      { knowledgeBaseId: 'kb', question: 'confirmed' },
    );
    assert.equal(result.citations.length, fullPreview ? 1 : 2);
    assert.match(result.contextText, /Warranty and discounts/);
    assert.doesNotMatch(result.contextText, /x{2000}/);
  });
}

function knowledgeServices(documents, chunks) {
  return {
    tables: {
      getRow: async () => ({ $id: 'kb', organizationId: 'team' }),
      listRows: async ({ tableId }) => {
        const rows = tableId === 'knowledge_documents' ? documents : chunks;
        return { total: rows.length, rows };
      },
    },
  };
}

test('retrieval searches the tail of long stored chunks and cites only passages in the prompt', async () => {
  const documents = Array.from({ length: 8 }, (_, index) => ({
    $id: `document-${index}`,
    title: `Handbook ${index}`,
    indexVersion: 'current',
  }));
  const chunks = documents.map((document, index) => ({
    $id: `chunk-${index}`,
    documentId: document.$id,
    indexVersion: 'current',
    content: `${'General product information. '.repeat(730)}\nSpecial warranty: ${index + 12} years.`,
  }));
  const result = await retrieveKnowledgeContext(
    knowledgeServices(documents, chunks),
    { teamId: 'team' },
    { knowledgeBaseId: 'kb', question: 'Special warranty' },
  );
  assert.match(result.contextText, /Special warranty: 12 years\./);
  assert.ok(result.contextText.length <= 12_000);
  const suppliedSources = result.contextText.split(/\n\n(?=\[Source )/);
  assert.equal(result.retrieval.selected, suppliedSources.length);
  assert.equal(result.citations.length, suppliedSources.length);
  assert.ok(result.citations.length > 1);
  for (const { reference, title, snippet } of result.citations) {
    const source = suppliedSources[reference - 1];
    assert.ok(source.startsWith(`[Source ${reference}: ${title}]\n`));
    assert.ok(source.includes(snippet));
    assert.match(snippet, /Special warranty/);
    assert.match(source, /Special warranty/);
  }
});

test('a knowledge base can retrieve legacy documents alongside versioned documents', async () => {
  const documents = [
    { $id: 'current-doc', title: 'Current handbook', indexVersion: 'current' },
    { $id: 'legacy-doc', title: 'Earlier policy', extractedText: 'Warranty lasts two years.' },
  ];
  const chunks = [
    { $id: 'old', documentId: 'current-doc', indexVersion: 'old', content: 'Warranty: stale.' },
    {
      $id: 'active',
      documentId: 'current-doc',
      indexVersion: 'current',
      content: 'Warranty is transferable.',
    },
  ];
  const result = await retrieveKnowledgeContext(
    knowledgeServices(documents, chunks),
    { teamId: 'team' },
    { knowledgeBaseId: 'kb', question: 'Warranty' },
  );
  assert.match(result.contextText, /Warranty lasts two years/);
  assert.match(result.contextText, /Warranty is transferable/);
  assert.doesNotMatch(result.contextText, /stale/);
  assert.deepEqual(
    new Set(result.citations.map(({ docId }) => docId)),
    new Set(['current-doc', 'legacy-doc']),
  );
});

test('retrieval rereads when an index is published and retired between its row reads', async () => {
  let version = 'old';
  let documentReads = 0;
  const services = {
    tables: {
      getRow: async () => ({ $id: 'kb', organizationId: 'team' }),
      listRows: async ({ tableId }) => {
        if (tableId === 'knowledge_documents') {
          documentReads++;
          return {
            total: 1,
            rows: [{ $id: 'doc', title: 'Policy', indexVersion: version, chunkCount: 1 }],
          };
        }
        version = 'current';
        return {
          total: 1,
          rows: [
            {
              $id: 'updated',
              documentId: 'doc',
              indexVersion: version,
              content: 'Returns are accepted for 30 days.',
            },
          ],
        };
      },
    },
  };
  const result = await retrieveKnowledgeContext(
    services,
    { teamId: 'team' },
    {
      knowledgeBaseId: 'kb',
      question: 'Returns',
    },
  );
  assert.equal(documentReads, 2);
  assert.equal(result.citations[0].chunkId, 'updated');
  assert.match(result.contextText, /30 days/);
});

test('a handbook with no relevant passage or a different explicit model cannot supply evidence', async () => {
  const services = knowledgeServices(
    [{ $id: 'bag', title: 'A17 旅行包', extractedText: 'A17 旅行包容量为 23 升，保修一年。' }],
    [],
  );
  for (const question of ['电热水壶功率', 'K88 电热水壶保修期限', 'A170 旅行包容量']) {
    await assert.rejects(
      retrieveKnowledgeContext(services, { teamId: 'team' }, { knowledgeBaseId: 'kb', question }),
      { code: 'KNOWLEDGE_NO_MATCH' },
    );
  }
  const match = await retrieveKnowledgeContext(
    services,
    { teamId: 'team' },
    { knowledgeBaseId: 'kb', question: 'A17 旅行包容量' },
  );
  assert.equal(match.citations[0].docId, 'bag');
});

test('commerce drafts reject conflicting labelled specs and accept equivalent metric values', async () => {
  const services = knowledgeServices(
    [{ $id: 'doc', title: 'A17', extractedText: 'Capacity: 23 liters. Empty weight: 640 grams.' }],
    [],
  );
  const get = (question) => commerceEvidence(services, { teamId: 'team' }, 'kb', question);
  await assert.rejects(get('A17 容量: 22 升'), { code: 'CONTENT_SPEC_CONFLICT' });
  assert.ok((await get('A17 容量: 23000 毫升，空包重: 0.64 公斤')).citations.length);
});
