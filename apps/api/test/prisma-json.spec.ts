import { asJsonRecord, jsonString, toInputJson } from '../src/common/prisma-json';

describe('Prisma JSON boundary', () => {
  it('creates a detached JSON value', () => {
    const source = { nested: { value: 1 }, omitted: undefined };
    expect(toInputJson(source)).toEqual({ nested: { value: 1 } });
  });

  it('rejects values that cannot be represented as JSON', () => {
    expect(() => toInputJson(undefined)).toThrow('JSON serializable');
    expect(() => toInputJson({ value: BigInt(1) })).toThrow('JSON serializable');
  });

  it('narrows records and string fields safely', () => {
    expect(asJsonRecord(null)).toEqual({});
    expect(asJsonRecord([])).toEqual({});
    expect(jsonString({ key: 'value' }, 'key')).toBe('value');
    expect(jsonString({ key: 1 }, 'key')).toBeUndefined();
  });
});
