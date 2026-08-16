export class HttpResult {
  constructor(data, status = 200) {
    this.data = data;
    this.status = status;
  }
}

export function routeParts(path) {
  return path.split('/').filter(Boolean);
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
