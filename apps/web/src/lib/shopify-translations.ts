export function parseTranslationCsv(source: string) {
  const text = source.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [],
    field = '',
    quoted = false,
    closed = false;
  const invalid = () => new Error('CSV_FORMAT');
  function endRow() {
    row.push(field);
    if (row.length > 1 || row[0] !== '') rows.push(row);
    row = [];
    field = '';
    closed = false;
  }
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char !== '"') field += char;
      else if (text[index + 1] === '"') {
        field += '"';
        index++;
      } else {
        quoted = false;
        closed = true;
      }
    } else if (char === ',') {
      row.push(field);
      field = '';
      closed = false;
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && text[index + 1] === '\n') index++;
      endRow();
    } else if (char === '"' && !field && !closed) quoted = true;
    else if (char === '"' || closed) throw invalid();
    else field += char;
  }
  if (quoted) throw invalid();
  endRow();
  const headers = rows.shift() ?? [];
  const required = [
    'Type',
    'Identification',
    'Field',
    'Locale',
    'Market',
    'Status',
    'Default content',
    'Translated content',
  ];
  if (
    required.some((key) => !headers.includes(key)) ||
    new Set(headers).size !== headers.length ||
    rows.some((row) => row.length !== headers.length)
  )
    throw invalid();
  const allowed = new Set(['title', 'body_html', 'meta_title', 'meta_description']);
  const supported = rows.filter(
    (row) =>
      /^products?$/i.test(row[headers.indexOf('Type')]) &&
      allowed.has(row[headers.indexOf('Field')]) &&
      row[headers.indexOf('Default content')].trim(),
  );
  return { headers, rows: supported, skipped: rows.length - supported.length };
}

export function translationCsv(headers: string[], rows: string[][]) {
  return (
    '\uFEFF' +
    [headers, ...rows]
      .map((row) => row.map((cell) => '"' + cell.replaceAll('"', '""') + '"').join(','))
      .join('\r\n') +
    '\r\n'
  );
}

export function downloadFile(text: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
