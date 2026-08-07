import { Prisma } from '@matrixflow/db';

export type JsonRecord = Record<string, unknown>;

export function toInputJson(value: unknown, label = 'value'): Prisma.InputJsonValue {
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(value);
  } catch (error) {
    throw new TypeError(`${label} must be JSON serializable`, { cause: error });
  }
  if (serialized === undefined) throw new TypeError(`${label} must be JSON serializable`);
  return JSON.parse(serialized) as Prisma.InputJsonValue;
}

export function asJsonRecord(value: unknown): JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

export function jsonString(value: unknown, key: string): string | undefined {
  const candidate = asJsonRecord(value)[key];
  return typeof candidate === 'string' ? candidate : undefined;
}
