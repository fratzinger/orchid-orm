import { DeleteQueryData } from '../sql';
import {
  emptyObject,
  getValueKey,
  IsQuery,
  PickQueryResult,
  pushOrNewArrayToObjectImmutable,
  RecordUnknown,
} from 'orchid-core';
import { OrchidOrmInternalError } from '../errors';
import {
  PickQueryQ,
  PickQueryQAndBaseQuery,
  Query,
  SetQueryReturnsAll,
  SetQueryReturnsOne,
  SetQueryReturnsOneOptional,
  SetQueryReturnsRows,
} from './query';
import { getClonedQueryData } from '../common/utils';

/**
 * Call `.clone()` on a supposed query object
 */
export const _clone = (q: unknown): Query => (q as unknown as Query).clone();

/**
 * Push all elements of given array into the array in the query data,
 * set given array if there is no array yet in the query data.
 * Not mutating the array.
 *
 * @param q - query
 * @param key - key to get the array
 * @param value - array with values
 */
export const pushQueryArrayImmutable = <T extends PickQueryQ>(
  q: T,
  key: string,
  value: unknown[],
): T => {
  const arr = (q.q as unknown as RecordUnknown)[key] as unknown[];
  (q.q as unknown as RecordUnknown)[key] = arr ? [...arr, ...value] : value;
  return q;
};

/**
 * Push a new element into an array in the query data - immutable version
 *
 * @param q - query
 * @param key - key to get the array
 * @param value - new element to push
 */
export const pushQueryValueImmutable = <T extends PickQueryQ>(
  q: T,
  key: string,
  value: unknown,
): T => {
  pushOrNewArrayToObjectImmutable(q.q, key, value);
  return q;
};

/**
 * Set value into the object in query data, create the object if it doesn't yet exist.
 * Does not mutate the object.
 *
 * @param q - query
 * @param object - query data key to get the object
 * @param key - object key to set the value into
 * @param value - value to set by the key
 */
export const setQueryObjectValueImmutable = <T extends PickQueryQ>(
  q: T,
  object: string,
  key: string,
  value: unknown,
): T => {
  (q.q as unknown as RecordUnknown)[object] = {
    ...((q.q as unknown as RecordUnknown)[object] as RecordUnknown),
    [key]: value,
  };
  return q as unknown as T;
};

/**
 * Throw runtime error when delete or update has no where conditions
 *
 * @param q - query
 * @param method - 'update' or 'delete'
 */
export const throwIfNoWhere = (q: PickQueryQ, method: string): void => {
  if (!q.q.or && !q.q.and && !q.q.scopes && !q.q.all) {
    throw new OrchidOrmInternalError(
      q as Query,
      `Dangerous ${method} without conditions`,
    );
  }
};

export const throwIfJoinLateral = (q: PickQueryQ, method: string): void => {
  if (
    (q.q as DeleteQueryData).join?.some(
      (x) => Array.isArray(x) || ('s' in x.args && x.args.s),
    )
  ) {
    throw new OrchidOrmInternalError(
      q as Query,
      `Cannot join a complex query in ${method}`,
    );
  }
};

// Pick an alias for a search query to reference it later in WHERE, in ORDER BY, in headline.
// If the alias is taken, it tries "@q", "@q1", "@q2" and so on.
export const saveSearchAlias = (
  q: IsQuery,
  as: string,
  key: 'joinedShapes' | 'withShapes',
): string => {
  const shapes = (q as Query).q[key];
  if (shapes?.[as]) {
    let suffix = 2;
    while (shapes[(as = `${as}${suffix}`)]) {
      suffix++;
    }
  }

  setQueryObjectValueImmutable(q as Query, key, as, emptyObject);

  return as;
};

/**
 * Extend query prototype with new methods.
 * The query and its data are cloned (with Object.create).
 *
 * @param q - query object to extend from
 * @param methods - methods to add
 */
export const extendQuery = <
  T extends PickQueryQAndBaseQuery,
  Methods extends RecordUnknown,
>(
  q: T,
  methods: Methods,
): T & Methods => {
  const base = Object.create(q.baseQuery);
  base.baseQuery = base;

  Object.assign(base, methods);

  const cloned = Object.create(base);
  cloned.q = getClonedQueryData(q.q);

  return cloned as T & Methods;
};

export const getPrimaryKeys = (q: IsQuery) => {
  return ((q as Query).internal.primaryKeys ??= collectPrimaryKeys(q));
};

const collectPrimaryKeys = (q: IsQuery): string[] => {
  const primaryKeys = [];
  const { shape } = (q as unknown as PickQueryQ).q;
  for (const key in shape) {
    if (shape[key].data.primaryKey) {
      primaryKeys.push(key);
    }
  }

  const pKeys = (q as Query).internal.primaryKeys;
  if (pKeys) {
    primaryKeys.push(...pKeys);
  }

  return primaryKeys;
};

export const _queryAll = <T extends PickQueryResult>(
  q: T,
): SetQueryReturnsAll<T> => {
  (q as unknown as PickQueryQ).q.returnType = 'all';
  (q as unknown as PickQueryQ).q.all = true;
  return q as never;
};

export const _queryTake = <T extends PickQueryResult>(
  q: T,
): SetQueryReturnsOne<T> => {
  (q as unknown as PickQueryQ).q.returnType = 'oneOrThrow';
  return q as never;
};

export const _queryTakeOptional = <T extends PickQueryResult>(
  q: T,
): SetQueryReturnsOneOptional<T> => {
  (q as unknown as PickQueryQ).q.returnType = 'one';
  return q as never;
};

export const _queryExec = <T extends IsQuery>(q: T) => {
  (q as unknown as PickQueryQ).q.returnType = 'void';
  return q as never;
};

export const _queryRows = <T extends PickQueryResult>(
  q: T,
): SetQueryReturnsRows<T> => {
  (q as unknown as PickQueryQ).q.returnType = 'rows';
  return q as never;
};

export const getFullColumnTable = (
  q: IsQuery,
  column: string,
  index: number,
  as: string | getValueKey | undefined,
) => {
  const table = column.slice(0, index);
  return as &&
    table !== as &&
    (q as unknown as PickQueryQ).q.aliases?.[table] === as
    ? as
    : table;
};
