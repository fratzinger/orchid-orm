import {
  Query,
  SetQueryKind,
  SetQueryReturnsRowCount,
  SetQueryReturnsRowCountMany,
} from '../../query/query';
import { _clone, throwIfNoWhere } from '../../query/queryUtils';
import { _queryWhereIn, WhereResult } from '../where/where';
import { ToSQLQuery } from '../../sql';
import { anyShape, VirtualColumn } from '../../columns';
import { Db } from '../../query/db';
import {
  isExpression,
  callWithThis,
  RecordUnknown,
  EmptyObject,
  ColumnTypeBase,
  pushQueryValueImmutable,
  QueryOrExpression,
  ColumnSchemaConfig,
  requirePrimaryKeys,
  QueryBase,
  RelationConfigBase,
  PickQueryMetaResultRelationsWithDataReturnTypeShape,
} from 'orchid-core';
import { QueryResult } from '../../adapter';
import { resolveSubQueryCallbackV2 } from '../../common/utils';
import { OrchidOrmInternalError } from 'orchid-core';
import { moveQueryValueToWith } from '../with';

export interface UpdateSelf
  extends PickQueryMetaResultRelationsWithDataReturnTypeShape {
  inputType: RecordUnknown;
}

// Type of argument for `update` and `updateOrThrow`
//
// It maps the `inputType` of a table into object with column values.
// The column value may be a specific value, or raw SQL, or a query returning a single value,
// or a callback with a relation query that is returning a single value,
// or a callback with JSON methods.
//
// It enables all forms of relation operations such as nested `create`, `connect`, etc.
export type UpdateData<T extends UpdateSelf> =
  EmptyObject extends T['relations']
    ? {
        [K in keyof T['inputType']]?: UpdateColumn<T, K>;
      }
    : {
        [K in
          | keyof T['inputType']
          | keyof T['relations']]?: K extends keyof T['inputType']
          ? UpdateColumn<T, K>
          : UpdateRelationData<T, T['relations'][K]>;
      };

// Type of available variants to provide for a specific column when updating.
// The column value may be a specific value, or raw SQL, or a query returning a single value,
// or a callback with a relation query that is returning a single value,
// or a callback with JSON methods.
type UpdateColumn<T extends UpdateSelf, Key extends keyof T['inputType']> =
  | T['inputType'][Key]
  | ((q: {
      [K in keyof T['relations'] | keyof T]: K extends keyof T['relations']
        ? T['relations'][K]['query']
        : K extends keyof T
        ? T[K]
        : never;
    }) => QueryOrExpression<T['inputType'][Key]>);

// Add relation operations to the update argument.
type UpdateRelationData<
  T extends UpdateSelf,
  Rel extends RelationConfigBase,
> = T['returnType'] extends undefined | 'all'
  ? Rel['dataForUpdate']
  : Rel['dataForUpdateOne'];

// Type of argument for `update`.
// not available when there are no conditions on the query.
export type UpdateArg<T extends UpdateSelf> = T['meta']['hasWhere'] extends true
  ? UpdateData<T>
  : never;

// `update` and `updateOrThrow` methods output type.
// Unless something was explicitly selected on the query, it's returning the count of updated records.
type UpdateResult<T extends UpdateSelf> = T['meta']['hasSelect'] extends true
  ? SetQueryKind<T, 'update'>
  : T['returnType'] extends undefined | 'all'
  ? SetQueryReturnsRowCountMany<T, 'update'>
  : SetQueryReturnsRowCount<T, 'update'>;

export type NumericColumns<T extends UpdateSelf> = {
  [K in keyof T['inputType']]: Exclude<
    T['shape'][K]['queryType'],
    string
  > extends number | bigint | null
    ? K
    : never;
}[keyof T['inputType']];

// `increment` and `decrement` methods argument type.
// Accepts a column name to change, or an object with column names and number values to increment or decrement with.
export type ChangeCountArg<T extends UpdateSelf> =
  | NumericColumns<T>
  | {
      [K in NumericColumns<T>]?: T['shape'][K]['type'] extends number | null
        ? number
        : number | string | bigint;
    };

// Context object for `update` logic used internally.
// It's being used by relations logic in the ORM.
export interface UpdateCtx {
  queries?: ((queryResult: QueryResult) => Promise<void>)[];
  collect?: UpdateCtxCollect;
}

export interface UpdateCtxCollect {
  data: RecordUnknown;
}

const throwOnReadOnly = (q: unknown, column: ColumnTypeBase, key: string) => {
  if (column.data.appReadOnly || column.data.readOnly) {
    throw new OrchidOrmInternalError(
      q as Query,
      'Trying to update a readonly column',
      { column: key },
    );
  }
};

// apply `increment` or a `decrement`,
// mutates the `queryData` of a query.
export const _queryChangeCounter = <T extends UpdateSelf>(
  self: T,
  op: string,
  data: ChangeCountArg<T>,
) => {
  const q = (self as unknown as Query).q;
  q.type = 'update';

  if (!q.select) {
    if (q.returnType === 'oneOrThrow' || q.returnType === 'valueOrThrow') {
      q.throwOnNotFound = true;
    }
    q.returningMany = !q.returnType || q.returnType === 'all';
    q.returnType = 'valueOrThrow';
    q.returning = true;
  }

  let map: { [K: string]: { op: string; arg: number } };
  if (typeof data === 'object') {
    map = {};
    for (const key in data) {
      map[key] = { op, arg: data[key as never] as number };

      const column = self.shape[key];
      if (column) {
        throwOnReadOnly(self, column as ColumnTypeBase, key);
      }
    }
  } else {
    map = { [data as string]: { op, arg: 1 } };

    const column = self.shape[data as string];
    if (column) {
      throwOnReadOnly(self, column as ColumnTypeBase, data as string);
    }
  }

  pushQueryValueImmutable(self as unknown as Query, 'updateData', map);
  return self as never;
};

export const _queryUpdate = <T extends UpdateSelf>(
  query: T,
  arg: UpdateArg<T>,
): UpdateResult<T> => {
  const { q } = query as unknown as Query;

  q.type = 'update';
  const returnCount = !q.select;

  const set: RecordUnknown = { ...arg };
  pushQueryValueImmutable(query as unknown as Query, 'updateData', set);

  const { shape } = q;

  const ctx: UpdateCtx = {};

  for (const key in arg) {
    const item = shape[key];
    if (!item && shape !== anyShape) {
      delete set[key];
    } else if (item.data.virtual) {
      (item as VirtualColumn<ColumnSchemaConfig>).update?.(query, ctx, set);
      delete set[key];
    } else {
      if (item) throwOnReadOnly(query, item, key);

      let value = set[key];
      if (typeof value === 'function') {
        value = resolveSubQueryCallbackV2(
          (query as unknown as Query).baseQuery,
          value as (q: ToSQLQuery) => ToSQLQuery,
        );
        if (value instanceof Db && value.q.type && value.q.subQuery) {
          throw new OrchidOrmInternalError(
            value,
            `Only selecting queries are allowed inside a callback of update, ${value.q.type} is given instead.`,
          );
        }

        set[key] = value;
      }

      if (value !== null && value !== undefined && !isExpression(value)) {
        if (value instanceof Db) {
          moveQueryValueToWith(
            query as unknown as Query,
            q,
            value,
            'with',
            set,
            key,
          );
        } else {
          // encode if not a query object
          const encode = item?.data.encode;
          if (encode) set[key] = encode(value);
        }
      }
    }
  }

  const { queries } = ctx;
  if (queries) {
    const primaryKeys = requirePrimaryKeys(
      query as unknown as QueryBase,
      'Cannot perform complex update on a table without primary keys',
    );
    const hookSelect = (q.hookSelect = new Map(q.hookSelect));
    for (const column of primaryKeys) {
      hookSelect.set(column, { select: column });
    }

    q.patchResult = async (_, _h, queryResult) => {
      await Promise.all(queries.map(callWithThis, queryResult));

      if (ctx.collect) {
        const t = (query as unknown as Query).baseQuery.clone();

        _queryWhereIn(
          t,
          true,
          primaryKeys,
          queryResult.rows.map((item) => primaryKeys.map((key) => item[key])),
        );

        await _queryUpdate(
          t as WhereResult<Query>,
          ctx.collect.data as UpdateData<WhereResult<Query>>,
        );

        for (const row of queryResult.rows) {
          Object.assign(row, ctx.collect.data);
        }
      }
    };
  }

  if (returnCount) {
    q.returningMany = !q.returnType || q.returnType === 'all';
    q.returnType = 'valueOrThrow';
    q.returning = true;
  }

  throwIfNoWhere(query as unknown as Query, 'update');

  return query as never;
};

export const _queryUpdateOrThrow = <T extends UpdateSelf>(
  q: T,
  arg: UpdateArg<T>,
): UpdateResult<T> => {
  (q as unknown as Query).q.throwOnNotFound = true;
  return _queryUpdate(q, arg);
};

export class Update {
  /**
   * `update` takes an object with columns and values to update records.
   *
   * By default, `update` will return a count of updated records.
   *
   * Place `select`, `selectAll`, or `get` before `update` to specify returning columns.
   *
   * You need to provide `where`, `findBy`, or `find` conditions before calling `update`.
   * To ensure that the whole table won't be updated by accident, updating without where conditions will result in TypeScript and runtime errors.
   *
   * Use `all()` to update ALL records without conditions:
   *
   * ```ts
   * await db.table.all().update({ name: 'new name' });
   * ```
   *
   * If `select` and `where` were specified before the update it will return an array of updated records.
   *
   * If `select` and `take`, `find`, or similar were specified before the update it will return one updated record.
   *
   * For a column value you can provide a specific value, raw SQL, a query object that returns a single value, or a callback with a sub-query.
   *
   * The callback is allowed to select a single value from a relation (see `fromRelation` column below),
   * or to use a [jsonSet](/guide/advanced-queries.html#jsonset),
   * [jsonInsert](/guide/advanced-queries.html#jsoninsert),
   * and [jsonRemove](/guide/advanced-queries.html#jsonremove) for a JSON column (see `jsonColumn` below).
   *
   * ```ts
   * import { sql } from './baseTable';
   *
   * // returns number of updated records by default
   * const updatedCount = await db.table
   *   .where({ name: 'old name' })
   *   .update({ name: 'new name' });
   *
   * // returning only `id`
   * const id = await db.table.find(1).get('id').update({ name: 'new name' });
   *
   * // `selectAll` + `find` will return a full record
   * const oneFullRecord = await db.table
   *   .selectAll()
   *   .find(1)
   *   .update({ name: 'new name' });
   *
   * // `selectAll` + `where` will return array of full records
   * const recordsArray = await db.table
   *   .select('id', 'name')
   *   .where({ id: 1 })
   *   .update({ name: 'new name' });
   *
   * await db.table.where({ ...conditions }).update({
   *   // set the column to a specific value
   *   value: 123,
   *
   *   // use custom SQL to update the column
   *   fromSql: () => sql`2 + 2`,
   *
   *   // use query that returns a single value
   *   // returning multiple values will result in Postgres error
   *   fromQuery: () => db.otherTable.get('someColumn'),
   *
   *   // select a single value from a related record
   *   fromRelation: (q) => q.relatedTable.get('someColumn'),
   *
   *   // set a new value to the `.foo.bar` path into a JSON column
   *   jsonColumn: (q) => q.jsonSet('jsonColumn', ['foo', 'bar'], 'new value'),
   * });
   * ```
   *
   * `update` can be used in [with](/guide/advanced-queries#with) expressions:
   *
   * ```ts
   * db.$qb
   *   // update record in one table
   *   .with('a', db.table.find(1).select('id').update(data))
   *   // update record in other table using the first table record id
   *   .with('b', (q) =>
   *     db.otherTable
   *       .find(1)
   *       .select('id')
   *       .update({
   *         ...otherData,
   *         aId: () => q.from('a').get('id'),
   *       }),
   *   )
   *   .from('b');
   *
   * `update` can be used in {@link WithMethods.with} expressions:
   *
   * ```ts
   * db.$qb
   *   // update record in one table
   *   .with('a', db.table.find(1).select('id').update(data))
   *   // update record in other table using the first table record id
   *   .with('b', (q) =>
   *     db.otherTable
   *       .find(1)
   *       .select('id')
   *       .update({
   *         ...otherData,
   *         aId: () => q.from('a').get('id'),
   *       }),
   *   )
   *   .from('b');
   * ```
   *
   * ### sub-queries
   *
   * In all `create`, `update`, `upsert` methods,
   * you can use sub queries that are either selecting a single value,
   * or creating/updating/deleting a record and return a single value.
   *
   * ```ts
   * await db.table.where({ ...conditions }).update({
   *   // `column` will be set to a value of the `otherColumn` of the created record.
   *   column: () => db.otherTable.get('otherColumn').create({ ...data }),
   *
   *   // `column2` will be set to a value of the `otherColumn` of the updated record.
   *   column2: () =>
   *     db.otherTable
   *       .get('otherColumn')
   *       .findBy({ ...conditions })
   *       .update({ key: 'value' }),
   *
   *   // `column3` will be set to a value of the `otherColumn` of the deleted record.
   *   column3: () =>
   *     db.otherTable
   *       .get('otherColumn')
   *       .findBy({ ...conditions })
   *       .delete(),
   * });
   * ```
   *
   * This is achieved by defining a `WITH` clause under the hood, it produces such a query:
   *
   * ```sql
   * WITH q AS (
   *   INSERT INTO "otherTable"(col1, col2, col3)
   *   VALUES ('val1', 'val2', 'val3')
   *   RETURNING "otherTable"."selectedColumn"
   * )
   * -- In a case of create
   * INSERT INTO "table"("column") VALUES ((SELECT * FROM "q"))
   * -- In a case of update
   * UPDATE "table"
   * SET "column" = (SELECT * FROM "q")
   * ```
   *
   * The query is atomic.
   * No changes will persist in the database if the sub-query fails, or if the top-level query fails, or if multiple rows are returned from a sub-query.
   *
   * [//]: # 'not supported in create because cannot query related records for a thing that is not created yet'
   * [//]: # 'modificational sub queries are not allowed in update because it would be too hard to join a with statement to the update query'
   *
   * Only selective sub-queries are supported in `update` queries when the sub-query is using a relation:
   *
   * ```ts
   * db.book.update({
   *   authorName: (q) => q.author.get('name'),
   * });
   * ```
   *
   * ### null, undefined, unknown columns
   *
   * - `null` value will set a column to `NULL`
   * - `undefined` value will be ignored
   * - unknown columns will be ignored
   *
   * ```ts
   * db.table.findBy({ id: 1 }).update({
   *   name: null, // updates to null
   *   age: undefined, // skipped, no effect
   *   lalala: 123, // skipped
   * });
   * ```
   *
   * ### empty set
   *
   * When trying to query update with an empty object, it will be transformed seamlessly to a `SELECT` query:
   *
   * ```ts
   * // imagine the data is an empty object
   * const data = req.body;
   *
   * // query is transformed to `SELECT count(*) WHERE key = 'value'`
   * const count = await db.table.where({ key: 'value' }).update(data);
   *
   * // will select a full record by id
   * const record = await db.table.find(1).selectAll().update(data);
   *
   * // will select a single column by id
   * const name = await db.table.find(1).get('name').update(data);
   * ```
   *
   * If the table has `updatedAt` [timestamp](/guide/common-column-methods.html#timestamps), it will be updated even for an empty data.
   *
   * @param arg - data to update records with, may have specific values, raw SQL, queries, or callbacks with sub-queries.
   */
  update<T extends UpdateSelf>(this: T, arg: UpdateArg<T>): UpdateResult<T> {
    return _queryUpdate(_clone(this), arg as never) as never;
  }

  /**
   * To make sure that at least one row was updated use `updateOrThrow`:
   *
   * ```ts
   * import { NotFoundError } from 'orchid-orm';
   *
   * try {
   *   // updatedCount is guaranteed to be greater than 0
   *   const updatedCount = await db.table
   *     .where(conditions)
   *     .updateOrThrow({ name: 'name' });
   *
   *   // updatedRecords is guaranteed to be a non-empty array
   *   const updatedRecords = await db.table
   *     .where(conditions)
   *     .select('id')
   *     .updateOrThrow({ name: 'name' });
   * } catch (err) {
   *   if (err instanceof NotFoundError) {
   *     // handle error
   *   }
   * }
   * ```
   *
   * @param arg - data to update records with, may have specific values, raw SQL, queries, or callbacks with sub-queries.
   */
  updateOrThrow<T extends UpdateSelf>(
    this: T,
    arg: UpdateArg<T>,
  ): UpdateResult<T> {
    return _queryUpdateOrThrow(_clone(this), arg as never) as never;
  }

  /**
   * Increments a column by `1`, returns a count of updated records by default.
   *
   * ```ts
   * const updatedCount = await db.table
   *   .where(...conditions)
   *   .increment('numericColumn');
   * ```
   *
   * When using `find` or `get` it will throw `NotFoundError` when no records found.
   *
   * ```ts
   * // throws when not found
   * const updatedCount = await db.table.find(1).increment('numericColumn');
   *
   * // also throws when not found
   * const updatedCount2 = await db.table
   *   .where(...conditions)
   *   .get('columnName')
   *   .increment('numericColumn');
   * ```
   *
   * Provide an object to increment multiple columns with different values.
   * Use `select` to specify columns to return.
   *
   * ```ts
   * // increment someColumn by 5 and otherColumn by 10, return updated records
   * const result = await db.table
   *   .selectAll()
   *   .where(...conditions)
   *   .increment({
   *     someColumn: 5,
   *     otherColumn: 10,
   *   });
   * ```
   *
   * @param data - name of the column to increment, or an object with columns and values to add
   */
  increment<T extends UpdateSelf>(
    this: T,
    data: ChangeCountArg<T>,
  ): UpdateResult<T> {
    return _queryChangeCounter(_clone(this), '+', data as never);
  }

  /**
   * Decrements a column by `1`, returns a count of updated records by default.
   *
   * ```ts
   * const updatedCount = await db.table
   *   .where(...conditions)
   *   .decrement('numericColumn');
   * ```
   *
   * When using `find` or `get` it will throw `NotFoundError` when no records found.
   *
   * ```ts
   * // throws when not found
   * const updatedCount = await db.table.find(1).decrement('numericColumn');
   *
   * // also throws when not found
   * const updatedCount2 = await db.table
   *   .where(...conditions)
   *   .get('columnName')
   *   .decrement('numericColumn');
   * ```
   *
   * Provide an object to decrement multiple columns with different values.
   * Use `select` to specify columns to return.
   *
   * ```ts
   * // decrement someColumn by 5 and otherColumn by 10, return updated records
   * const result = await db.table
   *   .selectAll()
   *   .where(...conditions)
   *   .decrement({
   *     someColumn: 5,
   *     otherColumn: 10,
   *   });
   * ```
   *
   * @param data - name of the column to decrement, or an object with columns and values to subtract
   */
  decrement<T extends UpdateSelf>(
    this: T,
    data: ChangeCountArg<T>,
  ): UpdateResult<T> {
    return _queryChangeCounter(_clone(this), '-', data as never);
  }
}
