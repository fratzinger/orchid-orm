import {
  Query,
  GetQueryResult,
  PickQueryMetaResultReturnTypeWithDataWindows,
} from '../query/query';
import { UnionSet } from '../sql';
import {
  PickQueryMetaResult,
  QueryThen,
  RecordBoolean,
  RecordUnknown,
} from 'orchid-core';

export type MergeQuery<
  T extends PickQueryMetaResultReturnTypeWithDataWindows,
  Q extends PickQueryMetaResultReturnTypeWithDataWindows,
> = {
  [K in keyof T]: K extends 'meta'
    ? {
        [K in keyof T['meta'] | keyof Q['meta']]: K extends 'selectable'
          ? Q['meta']['selectable'] &
              Omit<T['meta']['selectable'], keyof Q['meta']['selectable']>
          : K extends keyof Q['meta']
          ? Q['meta'][K]
          : T['meta'][K];
      }
    : K extends 'result'
    ? MergeQueryResult<T, Q>
    : K extends 'returnType'
    ? Q['returnType'] extends undefined
      ? T['returnType']
      : Q['returnType']
    : K extends 'then'
    ? QueryThen<
        GetQueryResult<
          Q['returnType'] extends undefined ? T : Q,
          MergeQueryResult<T, Q>
        >
      >
    : K extends 'windows'
    ? Q['windows'] & Omit<T['windows'], keyof Q['windows']>
    : K extends 'withData'
    ? Q['withData'] & Omit<T['withData'], keyof Q['withData']>
    : T[K];
};

type MergeQueryResult<
  T extends PickQueryMetaResult,
  Q extends PickQueryMetaResult,
> = T['meta']['hasSelect'] extends true
  ? Q['meta']['hasSelect'] extends true
    ? {
        [K in
          | keyof T['result']
          | keyof Q['result']]: K extends keyof Q['result']
          ? Q['result'][K]
          : T['result'][K];
      }
    : T['result']
  : Q['result'];

const mergableObjects: RecordBoolean = {
  shape: true,
  withShapes: true,
  parsers: true,
  defaults: true,
  joinedShapes: true,
  joinedParsers: true,
  joinedBatchParsers: true,
  selectedComputeds: true,
};

export class MergeQueryMethods {
  merge<T extends Query, Q extends Query>(this: T, q: Q): MergeQuery<T, Q> {
    const query = this.clone();
    const a = query.q as never as RecordUnknown;
    const b = q.q as never as RecordUnknown;

    for (const key in b) {
      const value = b[key];
      switch (typeof value) {
        case 'boolean':
        case 'string':
        case 'number':
          a[key] = value;
          break;
        case 'object':
          if (Array.isArray(value)) {
            a[key] = a[key] ? [...(a[key] as unknown[]), ...value] : value;
          } else if (mergableObjects[key]) {
            a[key] = a[key]
              ? { ...(a[key] as RecordUnknown), ...value }
              : value;
          } else if (key === 'union') {
            a[key] = a[key]
              ? {
                  b: (a[key] as UnionSet).b,
                  u: [...(a[key] as UnionSet).u, ...(value as UnionSet).u],
                }
              : value;
          } else if (value instanceof Set) {
            a[key] = a[key]
              ? new Set([...(a[key] as Set<unknown>), ...value])
              : value;
          } else {
            a[key] = value;
          }
          break;
      }
    }

    if (b.returnType) a.returnType = b.returnType;

    return query as never;
  }
}
