import { AdapterTransactionOptions } from './adapter';
import { RecordStringOrNumber } from 'pqb/internal';

export const mergeLocals = (
  locals: RecordStringOrNumber,
  options?: AdapterTransactionOptions,
): RecordStringOrNumber =>
  options?.locals ? { ...locals, ...options.locals } : locals;

export const getSetLocalsSql = (
  options?: AdapterTransactionOptions,
): string | undefined => {
  if (!options?.locals) return;

  return Object.entries(options.locals)
    .map(([key, value]) => `SET LOCAL ${key}=${value}`)
    .join('; ');
};

export const getResetLocalsSql = (
  parentLocals: RecordStringOrNumber,
  options?: AdapterTransactionOptions,
): string | undefined => {
  if (!options?.locals) return;

  return Object.entries(options.locals)
    .reduce<string[]>((acc, [key, value]) => {
      if (parentLocals[key] !== value) {
        acc.push(`SET LOCAL ${key}=${parentLocals[key]}`);
      }
      return acc;
    }, [])
    .join('; ');
};
