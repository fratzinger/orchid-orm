import {
  PickQueryQ,
  Query,
  queryTypeWithLimitOne,
  SetQueryKind,
  SetQueryKindResult,
  SetQueryReturnsAllKind,
  SetQueryReturnsAllKindResult,
  SetQueryReturnsColumnKind,
  SetQueryReturnsColumnKindResult,
  SetQueryReturnsColumnOptional,
  SetQueryReturnsOneKind,
  SetQueryReturnsOneKindResult,
  QueryTakeOptional,
  SetQueryReturnsPluckColumnKind,
  SetQueryReturnsPluckColumnKindResult,
  SetQueryReturnsRowCount,
  SetQueryReturnsRowCountMany,
} from '../../query/query';
import {
  InsertQueryDataObjectValues,
  OnConflictMerge,
  QueryData,
  ToSQLQuery,
} from '../../sql';
import { anyShape, VirtualColumn } from '../../columns';
import {
  Expression,
  ColumnSchemaConfig,
  RecordUnknown,
  PickQueryUniqueProperties,
  QueryColumn,
  FnUnknownToUnknown,
  isExpression,
  EmptyObject,
  IsQuery,
  QueryColumns,
  ColumnTypeBase,
  QueryOrExpression,
  RelationConfigDataForCreate,
  PickQueryMetaResultRelationsWithDataReturnTypeShape,
} from 'orchid-core';
import { isSelectingCount } from '../aggregate';
import { resolveSubQueryCallbackV2 } from '../../common/utils';
import { _clone } from '../../query/queryUtils';
import { Db } from '../../query';
import { moveQueryValueToWith } from '../with';
import { OrchidOrmInternalError } from 'orchid-core';

export interface CreateSelf
  extends IsQuery,
    PickQueryMetaResultRelationsWithDataReturnTypeShape,
    PickQueryUniqueProperties {
  inputType: RecordUnknown;
}

// Type of argument for `create`, `createMany`, optional argument for `createFrom`,
// `defaults` use a Partial of it.
//
// It maps `inputType` of the table into object to accept a corresponding type,
// or raw SQL per column, or a sub-query for a column.
//
// It allows to omit `belongsTo` foreign keys when a `belongsTo` record is provided by a relation name.
// For example, it allows to create with `db.book.create({ authorId: 123 })`
// or with `db.book.create({ author: authorData })`
//
// It enables all forms of relation operations such as nested `create`, `connect`, etc.
export type CreateData<
  T extends CreateSelf,
  BelongsToData = CreateBelongsToData<T>,
> = EmptyObject extends T['relations']
  ? // if no relations, don't load TS with extra calculations
    CreateDataWithDefaults<T, keyof T['meta']['defaults']>
  : CreateRelationsData<T, BelongsToData>;

type CreateDataWithDefaults<
  T extends CreateSelf,
  Defaults extends PropertyKey,
> = {
  [K in keyof T['inputType'] as K extends Defaults
    ? never
    : K]: K extends Defaults ? never : CreateColumn<T, K>;
} & {
  [K in Defaults]?: K extends keyof T['inputType'] ? CreateColumn<T, K> : never;
};

type CreateDataWithDefaultsForRelations<
  T extends CreateSelf,
  Defaults extends keyof T['inputType'],
  OmitFKeys extends PropertyKey,
> = {
  [K in keyof T['inputType'] as K extends Defaults | OmitFKeys
    ? never
    : K]: K extends Defaults | OmitFKeys ? never : CreateColumn<T, K>;
} & {
  [K in Defaults as K extends OmitFKeys ? never : K]?: CreateColumn<T, K>;
};

// Type of available variants to provide for a specific column when creating
export type CreateColumn<
  T extends CreateSelf,
  K extends keyof T['inputType'],
> = T['inputType'][K] | ((q: T) => QueryOrExpression<T['inputType'][K]>);

// Combine data of the table with data that can be set for relations
export type CreateRelationsData<T extends CreateSelf, BelongsToData> =
  // Data except `belongsTo` foreignKeys: { name: string, fooId: number } -> { name: string }
  CreateDataWithDefaultsForRelations<
    T,
    keyof T['meta']['defaults'],
    T['relations'][keyof T['relations']]['omitForeignKeyInCreate']
  > &
    ([BelongsToData] extends [never] ? EmptyObject : BelongsToData) &
    // Union of the rest relations objects, intersection is not needed here because there are no required properties:
    // { foo: object } | { bar: object }
    T['relations'][keyof T['relations']]['optionalDataForCreate'];

// Intersection of objects for `belongsTo` relations:
// ({ fooId: number } | { foo: object }) & ({ barId: number } | { bar: object })
export type CreateBelongsToData<T extends CreateSelf> = [
  T['relations'][keyof T['relations']]['dataForCreate'],
] extends [never]
  ? never
  : CreateRelationsDataOmittingFKeys<
      T,
      T['relations'][keyof T['relations']]['dataForCreate']
    >;

// Intersection of relations that may omit foreign key (belongsTo):
// ({ fooId: number } | { foo: object }) & ({ barId: number } | { bar: object })
export type CreateRelationsDataOmittingFKeys<
  T extends CreateSelf,
  // Collect a union of `belongsTo` relation objects.
  Union,
> =
  // Based on UnionToIntersection from here https://stackoverflow.com/a/50375286
  (
    Union extends RelationConfigDataForCreate
      ? (
          u: // omit relation columns if they are in defaults, is tested in factory.test.ts
          Union['columns'] extends keyof T['meta']['defaults']
            ? {
                [P in Exclude<
                  Union['columns'] & keyof T['inputType'],
                  keyof T['meta']['defaults']
                >]: CreateColumn<T, P>;
              } & {
                [P in keyof T['meta']['defaults'] &
                  Union['columns']]?: CreateColumn<T, P>;
              } & Partial<Union['nested']>
            :
                | {
                    [P in Union['columns'] &
                      keyof T['inputType']]: CreateColumn<T, P>;
                  }
                | Union['nested'],
        ) => void
      : never
  ) extends // must be handled as a function argument, belongsTo.test relies on this
  (u: infer Obj) => void
    ? Obj
    : never;

// `create` method output type
// - if `count` method is preceding `create`, will return 0 or 1 if created.
// - If the query returns multiple, forces it to return one record.
// - if it is a `pluck` query, forces it to return a single value
export type CreateResult<T extends CreateSelf, BT> = T extends { isCount: true }
  ? SetQueryKind<T, 'create'>
  : T['returnType'] extends undefined | 'all'
  ? SetQueryReturnsOneKindResult<T, 'create', NarrowCreateResult<T, BT>>
  : T['returnType'] extends 'pluck'
  ? SetQueryReturnsColumnKindResult<T, 'create', NarrowCreateResult<T, BT>>
  : SetQueryKindResult<T, 'create', NarrowCreateResult<T, BT>>;

type CreateRawOrFromResult<T extends CreateSelf> = T extends { isCount: true }
  ? SetQueryKind<T, 'create'>
  : T['returnType'] extends undefined | 'all'
  ? SetQueryReturnsOneKind<T, 'create'>
  : T['returnType'] extends 'pluck'
  ? SetQueryReturnsColumnKind<T, 'create'>
  : SetQueryKind<T, 'create'>;

// `insert` method output type
// - query returns inserted row count by default.
// - returns a record with selected columns if the query has a select.
// - if the query returns multiple, forces it to return one record.
// - if it is a `pluck` query, forces it to return a single value
type InsertResult<
  T extends CreateSelf,
  BT,
> = T['meta']['hasSelect'] extends true
  ? T['returnType'] extends undefined | 'all'
    ? SetQueryReturnsOneKindResult<T, 'create', NarrowCreateResult<T, BT>>
    : T['returnType'] extends 'pluck'
    ? SetQueryReturnsColumnKindResult<T, 'create', NarrowCreateResult<T, BT>>
    : SetQueryKindResult<T, 'create', NarrowCreateResult<T, BT>>
  : SetQueryReturnsRowCount<T, 'create'>;

type InsertRawOrFromResult<T extends CreateSelf> =
  T['meta']['hasSelect'] extends true
    ? T['returnType'] extends undefined | 'all'
      ? SetQueryReturnsOneKind<T, 'create'>
      : T['returnType'] extends 'pluck'
      ? SetQueryReturnsColumnKind<T, 'create'>
      : SetQueryKind<T, 'create'>
    : SetQueryReturnsRowCount<T, 'create'>;

// `createMany` method output type
// - if `count` method is preceding `create`, will return 0 or 1 if created.
// - If the query returns a single record, forces it to return multiple.
// - otherwise, query result remains as is.
type CreateManyResult<T extends CreateSelf, BT> = T extends { isCount: true }
  ? SetQueryKindResult<T, 'create', NarrowCreateResult<T, BT>>
  : T['returnType'] extends 'one' | 'oneOrThrow'
  ? SetQueryReturnsAllKindResult<T, 'create', NarrowCreateResult<T, BT>>
  : T['returnType'] extends 'value' | 'valueOrThrow'
  ? SetQueryReturnsPluckColumnKindResult<T, 'create', NarrowCreateResult<T, BT>>
  : SetQueryKindResult<T, 'create', NarrowCreateResult<T, BT>>;

type CreateManyFromResult<T extends CreateSelf> = T extends {
  isCount: true;
}
  ? SetQueryKind<T, 'create'>
  : T['returnType'] extends 'one' | 'oneOrThrow'
  ? SetQueryReturnsAllKind<T, 'create'>
  : T['returnType'] extends 'value' | 'valueOrThrow'
  ? SetQueryReturnsPluckColumnKind<T, 'create'>
  : SetQueryKind<T, 'create'>;

// `insertMany` method output type
// - query returns inserted row count by default.
// - returns records with selected columns if the query has a select.
// - if the query returns a single record, forces it to return multiple records.
type InsertManyResult<
  T extends CreateSelf,
  BT,
> = T['meta']['hasSelect'] extends true
  ? T['returnType'] extends 'one' | 'oneOrThrow'
    ? SetQueryReturnsAllKindResult<T, 'create', NarrowCreateResult<T, BT>>
    : T['returnType'] extends 'value' | 'valueOrThrow'
    ? SetQueryReturnsPluckColumnKindResult<
        T,
        'create',
        NarrowCreateResult<T, BT>
      >
    : SetQueryKindResult<T, 'create', NarrowCreateResult<T, BT>>
  : SetQueryReturnsRowCountMany<T, 'create'>;

type InsertManyFromResult<T extends CreateSelf> =
  T['meta']['hasSelect'] extends true
    ? T['returnType'] extends 'one' | 'oneOrThrow'
      ? SetQueryReturnsAllKind<T, 'create'>
      : T['returnType'] extends 'value' | 'valueOrThrow'
      ? SetQueryReturnsPluckColumnKind<T, 'create'>
      : SetQueryKind<T, 'create'>
    : SetQueryReturnsRowCountMany<T, 'create'>;

/**
 * When creating a record with a *belongs to* nested record,
 * un-nullify foreign key columns of the result.
 *
 * The same should work as well with any non-null columns passed to `create`, but it's to be implemented later.
 */
type NarrowCreateResult<
  T extends CreateSelf,
  Bt,
> = EmptyObject extends T['relations']
  ? T['result']
  : [
      {
        [K in keyof T['relations']]: T['relations'][K]['omitForeignKeyInCreate'];
      }[keyof T['relations'] & keyof Bt],
    ] extends [never]
  ? T['result']
  : {
      [K in keyof T['result']]: K extends T['relations'][keyof T['relations']]['omitForeignKeyInCreate']
        ? QueryColumn<
            Exclude<T['result'][K]['type'], null>,
            T['result'][K]['operators']
          >
        : T['result'][K];
    };

// `onConflictDoNothing()` method output type:
// overrides query return type from 'oneOrThrow' to 'one', from 'valueOrThrow' to 'value',
// because `ignore` won't return any data in case of a conflict.
type IgnoreResult<T extends CreateSelf> = T['returnType'] extends 'oneOrThrow'
  ? QueryTakeOptional<T>
  : T['returnType'] extends 'valueOrThrow'
  ? SetQueryReturnsColumnOptional<T, T['result']['value']>
  : T;

// Argument of `onConflict`, can be:
// - a unique column name
// - an array of unique column names
// - raw or other kind of Expression
type OnConflictArg<T extends PickQueryUniqueProperties> =
  | T['internal']['uniqueColumnNames']
  | T['internal']['uniqueColumnTuples']
  | Expression
  | { constraint: T['internal']['uniqueConstraints'] };

export type AddQueryDefaults<T extends CreateSelf, Defaults> = {
  [K in keyof T]: K extends 'meta'
    ? {
        [K in keyof T['meta']]: K extends 'defaults'
          ? T['meta']['defaults'] & Defaults
          : T['meta'][K];
      }
    : T[K];
};

/**
 * Used by ORM to access the context of current create query.
 * Is passed to the `create` method of a {@link VirtualColumn}
 */
export interface CreateCtx {
  columns: Map<string, number>;
  returnTypeAll?: true;
  resultAll: RecordUnknown[];
}

// Type of `encode` of columns.
interface RecordEncoder {
  [K: string]: FnUnknownToUnknown;
}

// Function called by all `create` methods to override query select.
// Clears select if query returning nothing or a count.
// Otherwise, selects all if query doesn't have select.
const createSelect = (q: Query) => {
  if (q.q.returnType === 'void' || isSelectingCount(q)) {
    q.q.select = undefined;
  } else if (!q.q.select) {
    q.q.select = ['*'];
    q.q.returning = true;
  }
};

/**
 * Processes arguments of data to create.
 * If the passed key is for a {@link VirtualColumn}, calls `create` of the virtual column.
 * Otherwise, ignores keys that aren't relevant to the table shape,
 * collects columns to the `ctx.columns` set, collects columns encoders.
 *
 * @param q - query object.
 * @param item - argument of data to create.
 * @param rowIndex - index of record's data in `createMany` args array.
 * @param ctx - context of create query to be shared with a {@link VirtualColumn}.
 * @param encoders - to collect `encode`s of columns.
 */
const processCreateItem = (
  q: CreateSelf,
  item: RecordUnknown,
  rowIndex: number,
  ctx: CreateCtx,
  encoders: RecordEncoder,
) => {
  const { shape } = (q as Query).q;
  for (const key in item) {
    const column = shape[key];
    if (!column) continue;

    if (column.data.virtual) {
      (column as VirtualColumn<ColumnSchemaConfig>).create?.(
        q,
        ctx,
        item,
        rowIndex,
      );
      continue;
    }

    throwOnReadOnly(q, column, key);

    let value = item[key];

    if (typeof value === 'function') {
      value = item[key] = resolveSubQueryCallbackV2(
        q as unknown as ToSQLQuery,
        value as (q: ToSQLQuery) => ToSQLQuery,
      );

      if (value && typeof value === 'object' && value instanceof Db) {
        moveQueryValueToWith(
          q as Query,
          ((q as Query).q.insertWith ??= {}),
          value,
          rowIndex,
          item,
          key,
        );
      }
    }

    if (
      !ctx.columns.has(key) &&
      ((column && !column.data.readOnly) || shape === anyShape) &&
      value !== undefined
    ) {
      ctx.columns.set(key, ctx.columns.size);
      encoders[key] = column?.data.encode as FnUnknownToUnknown;
    }
  }
};

const throwOnReadOnly = (q: unknown, column: ColumnTypeBase, key: string) => {
  if (column.data.appReadOnly || column.data.readOnly) {
    throw new OrchidOrmInternalError(
      q as Query,
      'Trying to insert a readonly column',
      { column: key },
    );
  }
};

// Creates a new context of create query.
const createCtx = (): CreateCtx => ({
  columns: new Map(),
  resultAll: undefined as unknown as RecordUnknown[],
});

/**
 * Processes arguments of `create`, `insert`, `createFrom` and `insertFrom` when it has data.
 * Apply defaults that may be present on a query object to the data.
 * Maps data object into array of values, encodes values when the column has an encoder.
 *
 * @param q - query object.
 * @param data - argument with data for create.
 * @param ctx - context of the create query.
 */
const handleOneData = (
  q: CreateSelf,
  data: RecordUnknown,
  ctx: CreateCtx,
): { columns: string[]; values: unknown[][] } => {
  const encoders: RecordEncoder = {};
  const defaults = (q as Query).q.defaults;

  if (defaults) {
    data = { ...defaults, ...data };
  }

  processCreateItem(q, data, 0, ctx, encoders);

  const columns = Array.from(ctx.columns.keys());
  const values = [
    columns.map((key) =>
      // undefined values were stripped and no need to check for them
      encoders[key] && !isExpression(data[key]) && data[key] !== null
        ? encoders[key](data[key])
        : data[key],
    ),
  ];

  return { columns, values };
};

/**
 * Processes arguments of `createMany`, `insertMany`.
 * Apply defaults that may be present on a query object to the data.
 * Maps data objects into array of arrays of values, encodes values when the column has an encoder.
 *
 * @param q - query object.
 * @param data - arguments with data for create.
 * @param ctx - context of the create query.
 */
const handleManyData = (
  q: CreateSelf,
  data: RecordUnknown[],
  ctx: CreateCtx,
): { columns: string[]; values: unknown[][] } => {
  const encoders: RecordEncoder = {};
  const defaults = (q as Query).q.defaults;

  if (defaults) {
    data = data.map((item) => ({ ...defaults, ...item }));
  }

  data.forEach((item, i) => {
    processCreateItem(q, item, i, ctx, encoders);
  });

  const values = Array(data.length);
  const columns = Array.from(ctx.columns.keys());

  data.forEach((item, i) => {
    (values as unknown[][])[i] = columns.map((key) =>
      encoders[key] && item[key] !== undefined && !isExpression(item[key])
        ? encoders[key](item[key])
        : item[key],
    );
  });

  return { columns, values };
};

/**
 * Core function that is used by all `create` and `insert` methods.
 * Sets query `type` to `insert` for `toSQL` to know it's for inserting.
 * Sets query columns and values.
 * Sets query kind, which is checked by `update` method when returning a query from callback.
 * Overrides query return type according to what is current create method supposed to return.
 *
 * @param self - query object.
 * @param columns - columns list of all values.
 * @param values - array of arrays matching columns, or can be an array of SQL expressions, or is a special object for `createFrom`.
 * @param many - whether it's for creating one or many.
 */
const insert = (
  self: CreateSelf,
  {
    columns,
    values,
  }: {
    columns: string[];
    values: QueryData['values'];
  },
  many?: boolean,
) => {
  const { q } = self as unknown as { q: QueryData };

  if (!q.select?.length) {
    q.returning = true;
  }

  delete q.and;
  delete q.or;
  delete q.scopes;

  q.type = 'insert';
  q.columns = columns;
  q.values = values;

  const { select, returnType } = q;

  if (!select) {
    if (returnType !== 'void') {
      q.returnType = 'valueOrThrow';
      if (many) q.returningMany = true;
    }
  } else if (many) {
    if (returnType === 'one' || returnType === 'oneOrThrow') {
      q.returnType = 'all';
    } else if (returnType === 'value' || returnType === 'valueOrThrow') {
      q.returnType = 'pluck';
    }
  } else if (!returnType || returnType === 'all') {
    q.returnType = 'from' in values ? values.from.q.returnType : 'one';
  } else if (returnType === 'pluck') {
    q.returnType = 'valueOrThrow';
  }

  return self;
};

/**
 * Function to collect column names from the inner query of create `from` methods.
 *
 * @param q - the creating query
 * @param from - inner query to grab the columns from.
 * @param obj - optionally passed object with specific data, only available when creating a single record.
 * @param many - whether it's for `createManyFrom`. If no, throws if the inner query returns multiple records.
 */
const getFromSelectColumns = (
  q: CreateSelf,
  from: CreateSelf,
  obj?: {
    columns: string[];
    values: QueryData['values'];
  },
  many?: boolean,
): {
  columns: string[];
  values: InsertQueryDataObjectValues;
} => {
  if (!many && !queryTypeWithLimitOne[(from as Query).q.returnType as string]) {
    throw new Error(
      'Cannot create based on a query which returns multiple records',
    );
  }

  const queryColumns = new Set<string>();
  (from as Query).q.select?.forEach((item) => {
    if (typeof item === 'string') {
      const index = item.indexOf('.');
      queryColumns.add(index === -1 ? item : item.slice(index + 1));
    } else if (item && 'selectAs' in item) {
      for (const column in item.selectAs) {
        queryColumns.add(column);
      }
    }
  });

  const values: unknown[] = [];
  if (obj?.columns) {
    const objectValues = (obj.values as InsertQueryDataObjectValues)[0];
    obj.columns.forEach((column, i) => {
      if (!queryColumns.has(column)) {
        queryColumns.add(column);
        values.push(objectValues[i]);
      }
    });
  }

  for (const key of queryColumns) {
    const column = q.shape[key] as ColumnTypeBase;
    if (column) throwOnReadOnly(from, column, key);
  }

  return {
    columns: [...queryColumns],
    values: [values],
  };
};

/**
 * Is used by all create from queries methods.
 * Collects columns and values from the inner query and optionally from the given data,
 * calls {@link insert} with a 'from' kind of create query.
 *
 * @param q - query object.
 * @param from - inner query from which to create new records.
 * @param many - whether creating many.
 * @param data - optionally passed custom data when creating a single record.
 */
const insertFromQuery = <
  T extends CreateSelf,
  Q extends IsQuery,
  Many extends boolean,
>(
  q: T,
  from: Q,
  many: Many,
  data?: RecordUnknown,
) => {
  const ctx = createCtx();

  const obj = data && handleOneData(q, data, ctx);

  const { columns, values } = getFromSelectColumns(q, from as never, obj, many);

  return insert(
    q,
    {
      columns,
      values: { from, values: values[0] } as never,
    },
    many,
  );
};

export const _queryCreate = <
  T extends CreateSelf,
  BT extends CreateBelongsToData<T>,
>(
  q: T,
  data: CreateData<T, BT>,
): CreateResult<T, BT> => {
  createSelect(q as unknown as Query);
  return _queryInsert(q, data) as never;
};

export const _queryInsert = <
  T extends CreateSelf,
  BT extends CreateBelongsToData<T>,
>(
  q: T,
  data: CreateData<T, BT>,
): InsertResult<T, BT> => {
  const ctx = createCtx();
  let obj = handleOneData(q, data, ctx) as {
    columns: string[];
    values: QueryData['values'];
  };

  const values = (q as unknown as Query).q.values;
  if (values && 'from' in values) {
    obj = getFromSelectColumns(q, values.from, obj);
    values.values = (obj.values as unknown[][])[0];
    obj.values = values;
  }

  return insert(q, obj) as never;
};

export const _queryCreateMany = <
  T extends CreateSelf,
  BT extends CreateBelongsToData<T>,
>(
  q: T,
  data: CreateData<T, BT>[],
): CreateManyResult<T, BT> => {
  createSelect(q as unknown as Query);
  return _queryInsertMany(q, data as never) as never;
};

export const _queryInsertMany = <
  T extends CreateSelf,
  BT extends CreateBelongsToData<T>,
>(
  q: T,
  data: CreateData<T, BT>[],
): InsertManyResult<T, BT> => {
  const ctx = createCtx();
  let result = insert(q, handleManyData(q, data, ctx), true) as never;
  if (!data.length) result = (result as Query).none() as never;
  return result;
};

interface QueryReturningOne extends IsQuery {
  result: QueryColumns;
  returnType: 'one' | 'oneOrThrow';
}

export const _queryCreateFrom = <
  T extends CreateSelf,
  Q extends QueryReturningOne,
>(
  q: T,
  query: Q,
  data?: Omit<CreateData<T, CreateBelongsToData<T>>, keyof Q['result']>,
): CreateRawOrFromResult<T> => {
  createSelect(q as unknown as Query);
  return insertFromQuery(q, query, false, data as never) as never;
};

export const _queryInsertFrom = <
  T extends CreateSelf,
  Q extends QueryReturningOne,
>(
  q: T,
  query: Q,
  data?: Omit<CreateData<T, CreateBelongsToData<T>>, keyof Q['result']>,
): InsertRawOrFromResult<T> => {
  return insertFromQuery(q, query, false, data as never) as never;
};

export const _queryCreateManyFrom = <T extends CreateSelf>(
  q: T,
  query: IsQuery,
): CreateManyFromResult<T> => {
  createSelect(q as unknown as Query);
  return insertFromQuery(q, query, true) as never;
};

export const _queryInsertManyFrom = <T extends CreateSelf>(
  q: T,
  query: IsQuery,
): InsertManyFromResult<T> => {
  return insertFromQuery(q, query, true) as never;
};

export const _queryDefaults = <
  T extends CreateSelf,
  Data extends Partial<CreateData<T, CreateBelongsToData<T>>>,
>(
  q: T,
  data: Data,
): AddQueryDefaults<T, { [K in keyof Data]: true }> => {
  (q as unknown as Query).q.defaults = data;
  return q as never;
};

/**
 * Names of all create methods,
 * is used in relational query to remove these methods if chained relation shouldn't have them,
 * for the case of has one/many through.
 */
export type CreateMethodsNames =
  | 'create'
  | 'insert'
  | 'createMany'
  | 'insertMany'
  | 'createFrom'
  | 'insertFrom'
  | 'createManyFrom'
  | 'insertManyFrom';

export class QueryCreate {
  /**
   * `create` and `insert` create a single record.
   *
   * Each column may accept a specific value, a raw SQL, or a query that returns a single value.
   *
   * ```ts
   * import { sql } from './baseTable';
   *
   * const oneRecord = await db.table.create({
   *   name: 'John',
   *   password: '1234',
   * });
   *
   * // When using `.onConflictDoNothing()`,
   * // the record may be not created and the `createdCount` will be 0.
   * const createdCount = await db.table.insert(data).onConflictDoNothing();
   *
   * await db.table.create({
   *   // raw SQL
   *   column1: () => sql`'John' || ' ' || 'Doe'`,
   *
   *   // query that returns a single value
   *   // returning multiple values will result in Postgres error
   *   column2: () => db.otherTable.get('someColumn'),
   *
   *   // nesting creates, updates, deletes produces a single SQL
   *   column4: () => db.otherTable.create(data).get('someColumn'),
   *   column5: (q) => q.relatedTable.find(id).update(data).get('someColumn'),
   * });
   * ```
   *
   * Creational methods can be used in {@link WithMethods.with} expressions:
   *
   * ```ts
   * db.$qb
   *   // create a record in one table
   *   .with('a', db.table.select('id').create(data))
   *   // create a record in other table using the first table record id
   *   .with('b', (q) =>
   *     db.otherTable.select('id').create({
   *       ...otherData,
   *       aId: () => q.from('a').get('id'),
   *     }),
   *   )
   *   .from('b');
   * ```
   *
   * @param data - data for the record, may have values, raw SQL, queries, relation operations.
   */
  create<T extends CreateSelf, BT extends CreateBelongsToData<T>>(
    this: T,
    data: CreateData<T, BT>,
  ): CreateResult<T, BT> {
    return _queryCreate(_clone(this), data) as never;
  }

  /**
   * Works exactly as {@link create}, except that it returns inserted row count by default.
   *
   * @param data - data for the record, may have values, raw SQL, queries, relation operations.
   */
  insert<T extends CreateSelf, BT extends CreateBelongsToData<T>>(
    this: T,
    data: CreateData<T, BT>,
  ): InsertResult<T, BT> {
    return _queryInsert(_clone(this), data) as never;
  }

  /**
   * `createMany` and `insertMany` will create a batch of records.
   *
   * Each column may be set with a specific value, a raw SQL, or a query, the same as in {@link create}.
   *
   * In case one of the objects has fewer fields, the `DEFAULT` SQL keyword will be placed in its place in the `VALUES` statement.
   *
   * ```ts
   * const manyRecords = await db.table.createMany([
   *   { key: 'value', otherKey: 'other value' },
   *   { key: 'value' }, // default will be used for `otherKey`
   * ]);
   *
   * // `createdCount` will be 3.
   * const createdCount = await db.table.insertMany([data, data, data]);
   * ```
   *
   * When nesting creates, a separate create query will be executed for every time it's used:
   *
   * ```ts
   * // will be performed twice, even though it is defined once
   * const nestedCreate = db.otherTable.create(data).get('column');
   *
   * await db.table.createMany([{ column: nestedCreate }, { column: nestedCreate }]);
   * ```
   *
   * Because of a limitation of Postgres protocol, queries having more than **65535** of values are going to fail in runtime.
   * To solve this seamlessly, `OrchidORM` will automatically batch such queries, and wrap them into a transaction, unless they are already in a transaction.
   *
   * ```ts
   * // OK: executes 2 inserts wrapped into a transaction
   * await db.table.createMany(
   *   Array.from({ length: 65536 }, () => ({ text: 'text' })),
   * );
   * ```
   *
   * However, this only works in the case shown above. This **won't** work if you're using the `createMany` in `with` statement,
   * or if the insert is used as a sub-query in other query part.
   *
   * @param data - array of records data, may have values, raw SQL, queries, relation operations
   */
  createMany<T extends CreateSelf, BT extends CreateBelongsToData<T>>(
    this: T,
    data: CreateData<T, BT>[],
  ): CreateManyResult<T, BT> {
    return _queryCreateMany(_clone(this), data) as never;
  }

  /**
   * Works exactly as {@link createMany}, except that it returns inserted row count by default.
   *
   * @param data - array of records data, may have values, raw SQL, queries, relation operations
   */
  insertMany<T extends CreateSelf, BT extends CreateBelongsToData<T>>(
    this: T,
    data: CreateData<T, BT>[],
  ): InsertManyResult<T, BT> {
    return _queryInsertMany(_clone(this), data) as never;
  }

  /**
   * These methods are for creating a single record, for batch creating see {@link createManyFrom}.
   *
   * `createFrom` is to perform the `INSERT ... SELECT ...` SQL statement, it does select and insert by performing a single query.
   *
   * The first argument is a query for a **single** record, it should have `find`, `take`, or similar.
   *
   * The second optional argument is a data which will be merged with columns returned from the select query.
   *
   * The data for the second argument is the same as in {@link create}.
   *
   * Columns with runtime defaults (defined with a callback) are supported here.
   * The value for such a column will be injected unless selected from a related table or provided in a data object.
   *
   * ```ts
   * const oneRecord = await db.table.createFrom(
   *   // In the select, key is a related table column, value is a column to insert as
   *   RelatedTable.select({ relatedId: 'id' }).findBy({ key: 'value' }),
   *   // optional argument:
   *   {
   *     key: 'value',
   *     // supports sql, nested select, create, update, delete queries
   *     fromSql: () => sql`custom sql`,
   *     fromQuery: () => db.otherTable.find(id).update(data).get('column'),
   *     fromRelated: (q) => q.relatedTable.create(data).get('column'),
   *   },
   * );
   * ```
   *
   * The query above will produce such SQL:
   *
   * ```sql
   * INSERT INTO "table"("relatedId", "key")
   * SELECT "relatedTable"."id" AS "relatedId", 'value'
   * FROM "relatedTable"
   * WHERE "relatedTable"."key" = 'value'
   * LIMIT 1
   * RETURNING *
   * ```
   *
   * @param query - query to create new records from
   * @param data - additionally you can set some columns
   */
  createFrom<T extends CreateSelf, Q extends QueryReturningOne>(
    this: T,
    query: Q,
    data?: Omit<CreateData<T, CreateBelongsToData<T>>, keyof Q['result']>,
  ): CreateRawOrFromResult<T> {
    return _queryCreateFrom(_clone(this) as never, query, data);
  }

  /**
   * Works exactly as {@link createFrom}, except that it returns inserted row count by default.
   *
   * @param query - query to create new records from
   * @param data - additionally you can set some columns
   */
  insertFrom<T extends CreateSelf, Q extends QueryReturningOne>(
    this: T,
    query: Q,
    data?: Omit<CreateData<T, CreateBelongsToData<T>>, keyof Q['result']>,
  ): InsertRawOrFromResult<T> {
    return _queryInsertFrom(_clone(this) as never, query, data);
  }

  /**
   * Similar to `createFrom`, but intended to create many records.
   *
   * Unlike `createFrom`, it doesn't accept second argument with data, and runtime defaults cannot work with it.
   *
   * ```ts
   * const manyRecords = await db.table.createManyFrom(
   *   RelatedTable.select({ relatedId: 'id' }).where({ key: 'value' }),
   * );
   * ```
   *
   * @param query - query to create new records from
   */
  createManyFrom<T extends CreateSelf>(
    this: T,
    query: IsQuery,
  ): CreateManyFromResult<T> {
    return _queryCreateManyFrom(_clone(this) as never, query);
  }

  /**
   * Works exactly as {@link createManyFrom}, except that it returns inserted row count by default.
   *
   * @param query - query to create new records from
   */
  insertManyFrom<T extends CreateSelf>(
    this: T,
    query: IsQuery,
  ): InsertManyFromResult<T> {
    return _queryInsertManyFrom(_clone(this) as never, query);
  }

  /**
   * `defaults` allows setting values that will be used later in `create`.
   *
   * Columns provided in `defaults` are marked as optional in the following `create`.
   *
   * Default data is the same as in {@link create} and {@link createMany},
   * so you can provide a raw SQL, or a query with a query.
   *
   * ```ts
   * // Will use firstName from defaults and lastName from create argument:
   * db.table
   *   .defaults({
   *     firstName: 'first name',
   *     lastName: 'last name',
   *   })
   *   .create({
   *     lastName: 'override the last name',
   *   });
   * ```
   *
   * @param data - default values for `create` and `createMany` which will follow `defaults`
   */
  defaults<
    T extends CreateSelf,
    Data extends Partial<CreateData<T, CreateBelongsToData<T>>>,
  >(this: T, data: Data): AddQueryDefaults<T, { [K in keyof Data]: true }> {
    return _queryDefaults(_clone(this) as never, data as never);
  }

  /**
   * By default, violating unique constraint will cause the creative query to throw,
   * you can define what to do on a conflict: to ignore it, or to merge the existing record with a new data.
   *
   * A conflict occurs when a table has a primary key or a unique index on a column,
   * or a composite primary key unique index on a set of columns,
   * and a row being created has the same value as a row that already exists in the table in this column(s).
   *
   * Use {@link onConflictDoNothing} to suppress the error and continue without updating the record,
   * or the `merge` to update the record with new values automatically,
   * or the `set` to specify own values for the update.
   *
   * `onConflict` only accepts column names that are defined in `primaryKey` or `unique` in the table definition.
   * To specify a constraint, its name also must be explicitly set in `primaryKey` or `unique` in the table code.
   *
   * Postgres has a limitation that a single `INSERT` query can have only a single `ON CONFLICT` clause that can target only a single unique constraint
   * for updating the record.
   *
   * If your table has multiple potential reasons for unique constraint violation, such as username and email columns in a user table,
   * consider using `upsert` instead.
   *
   * ```ts
   * // leave `onConflict` without argument to ignore or merge on any conflict
   * db.table.create(data).onConflictDoNothing();
   *
   * // single column:
   * // (this requires a composite primary key or unique index, see below)
   * db.table.create(data).onConflict('email').merge();
   *
   * // array of columns:
   * db.table.create(data).onConflict(['email', 'name']).merge();
   *
   * // constraint name
   * db.table.create(data).onConflict({ constraint: 'unique_index_name' }).merge();
   *
   * // raw SQL expression:
   * db.table
   *   .create(data)
   *   .onConflict(sql`(email) where condition`)
   *   .merge();
   * ```
   *
   * :::info
   * A primary key or a unique index for a **single** column can be fined on a column:
   *
   * ```ts
   * export class MyTable extends BaseTable {
   *   columns = this.setColumns((t) => ({
   *     pkey: t.uuid().primaryKey(),
   *     unique: t.string().unique(),
   *   }));
   * }
   * ```
   *
   * But for composite primary keys or indexes (having multiple columns), define it in a separate function:
   *
   * ```ts
   * export class MyTable extends BaseTable {
   *   columns = this.setColumns(
   *     (t) => ({
   *       one: t.integer(),
   *       two: t.string(),
   *       three: t.boolean(),
   *     }),
   *     (t) => [t.primaryKey(['one', 'two']), t.unique(['two', 'three'])],
   *   );
   * }
   * ```
   * :::
   *
   * You can use the `sql` function exported from your `BaseTable` file in onConflict.
   * It can be useful to specify a condition when you have a partial index:
   *
   * ```ts
   * db.table
   *   .create({
   *     email: 'ignore@example.com',
   *     name: 'John Doe',
   *     active: true,
   *   })
   *   // ignore only when having conflicting email and when active is true.
   *   .onConflict(sql`(email) where active`)
   *   .ignore();
   * ```
   *
   * For `merge` and `set`, you can append `where` to update data only for the matching rows:
   *
   * ```ts
   * const timestamp = Date.now();
   *
   * db.table
   *   .create(data)
   *   .onConflict('email')
   *   .set({
   *     name: 'John Doe',
   *     updatedAt: timestamp,
   *   })
   *   .where({ updatedAt: { lt: timestamp } });
   * ```
   *
   * @param arg - optionally provide an array of columns
   */
  onConflict<T extends CreateSelf, Arg extends OnConflictArg<T>>(
    this: T,
    arg: Arg,
  ): OnConflictQueryBuilder<T, Arg> {
    return new OnConflictQueryBuilder(this, arg as never);
  }

  /**
   * Use `onConflictDoNothing` to suppress unique constraint violation error when creating a record.
   *
   * Adds `ON CONFLICT (columns) DO NOTHING` clause to the insert statement, columns are optional.
   *
   * Can also accept a constraint name.
   *
   * ```ts
   * db.table
   *   .create({
   *     email: 'ignore@example.com',
   *     name: 'John Doe',
   *   })
   *   // on any conflict:
   *   .onConflictDoNothing()
   *   // or, for a specific column:
   *   .onConflictDoNothing('email')
   *   // or, for a specific constraint:
   *   .onConflictDoNothing({ constraint: 'unique_index_name' });
   * ```
   *
   * When there is a conflict, nothing can be returned from the database, so `onConflictDoNothing` adds `| undefined` part to the response type.
   *
   * ```ts
   * const maybeRecord: RecordType | undefined = await db.table
   *   .create(data)
   *   .onConflictDoNothing();
   *
   * const maybeId: number | undefined = await db.table
   *   .get('id')
   *   .create(data)
   *   .onConflictDoNothing();
   * ```
   *
   * When creating multiple records, only created records will be returned. If no records were created, array will be empty:
   *
   * ```ts
   * // array can be empty
   * const arr = await db.table.createMany([data, data, data]).onConflictDoNothing();
   * ```
   */
  onConflictDoNothing<T extends CreateSelf, Arg extends OnConflictArg<T>>(
    this: T,
    arg?: Arg,
  ): IgnoreResult<T> {
    const q = _clone(this);
    q.q.onConflict = {
      target: arg as never,
    };

    if (q.q.returnType === 'oneOrThrow') {
      q.q.returnType = 'one';
    } else if (q.q.returnType === 'valueOrThrow') {
      q.q.returnType = 'value';
    }

    return q as never;
  }
}

type OnConflictSet<T extends CreateSelf> = {
  [K in keyof T['inputType']]?:
    | T['inputType'][K]
    | (() => QueryOrExpression<T['inputType'][K]>);
};

export class OnConflictQueryBuilder<
  T extends CreateSelf,
  Arg extends OnConflictArg<T> | undefined,
> {
  constructor(private query: T, private onConflict: Arg) {}

  /**
   * Available only after `onConflict`.
   *
   * Updates the record with a given data when conflict occurs.
   *
   * ```ts
   * db.table
   *   .create(data)
   *   .onConflict('email')
   *   .set({
   *     // supports plain values and SQL expressions
   *     key: 'value',
   *     fromSql: () => sql`custom sql`,
   *   })
   *   // to update records only on certain conditions
   *   .where({ ...certainConditions });
   * ```
   *
   * @param set - object containing new column values
   */
  set(set: OnConflictSet<T>): T {
    let resolved: RecordUnknown | undefined;
    for (const key in set) {
      const column = this.query.shape[key] as ColumnTypeBase;
      if (column) throwOnReadOnly(this.query, column, key);

      if (typeof set[key] === 'function') {
        if (!resolved) resolved = { ...set };

        resolved[key] = (set[key] as () => unknown)();
      }
    }

    (this.query as unknown as Query).q.onConflict = {
      target: this.onConflict as never,
      set: resolved || set,
    };
    return this.query;
  }

  /**
   * Available only after `onConflict`.
   *
   * Use this method to merge all the data you have passed into `create` to update the existing record on conflict.
   *
   * If the table has columns with **dynamic** default values, such values will be applied as well.
   *
   * You can exclude certain columns from being merged by passing the `except` option.
   *
   * ```ts
   * // merge the full data
   * db.table.create(data).onConflict('email').merge();
   *
   * // merge only a single column
   * db.table.create(data).onConflict('email').merge('name');
   *
   * // merge multiple columns
   * db.table.create(data).onConflict('email').merge(['name', 'quantity']);
   *
   * // merge all columns except some
   * db.table
   *   .create(data)
   *   .onConflict('email')
   *   .merge({ except: ['name', 'quantity'] });
   *
   * // merge can be applied also for batch creates
   * db.table.createMany([data1, data2, data2]).onConflict('email').merge();
   *
   * // update records only on certain conditions
   * db.table
   *   .create(data)
   *   .onConflict('email')
   *   .merge()
   *   .where({ ...certainConditions });
   * ```
   *
   * @param merge - no argument will merge all data, or provide a column(s) to merge, or provide `except` to update all except some.
   */
  merge(
    merge?:
      | keyof T['shape']
      | (keyof T['shape'])[]
      | { except: keyof T['shape'] | (keyof T['shape'])[] },
  ): T {
    (this.query as unknown as PickQueryQ).q.onConflict = {
      target: this.onConflict as never,
      merge: merge as OnConflictMerge,
    };
    return this.query;
  }
}
