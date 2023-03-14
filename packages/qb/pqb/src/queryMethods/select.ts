import {
  AddQuerySelect,
  ColumnParser,
  ColumnsParsers,
  Query,
  QueryBase,
  QueryReturnsAll,
  QuerySelectAll,
} from '../query';
import {
  ArrayOfColumnsObjects,
  ColumnsObject,
  JSONTextColumn,
  PluckResultColumnType,
} from '../columns';
import { pushQueryArray } from '../queryDataUtils';
import { QueryData, SelectItem, SelectQueryData } from '../sql';
import { isRequiredRelationKey, Relation } from '../relations';
import { getValueKey } from './get';
import { QueryResult } from '../adapter';
import { UnknownColumn } from '../columns/unknown';
import {
  emptyObject,
  FilterTuple,
  SimpleSpread,
  StringKey,
  isRaw,
  RawExpression,
  ColumnsShapeBase,
  NullableColumn,
  ColumnTypeBase,
} from 'orchid-core';
import { parseResult } from './then';

export type SelectArg<T extends QueryBase> =
  | StringKey<keyof T['selectable']>
  | (T['relations'] extends Record<string, Relation>
      ? StringKey<keyof T['relations']>
      : never)
  | SelectAsArg<T>;

type SelectAsArg<T extends QueryBase> = Record<
  string,
  StringKey<keyof T['selectable']> | RawExpression | ((q: T) => Query)
>;

type SelectResult<
  T extends Query,
  Args extends SelectArg<T>[],
  SelectAsArgs = SimpleSpread<FilterTuple<Args, SelectAsArg<T>>>,
> = AddQuerySelect<
  T,
  {
    [Arg in Args[number] as Arg extends keyof T['selectable']
      ? T['selectable'][Arg]['as']
      : Arg extends keyof T['relations']
      ? Arg
      : never]: Arg extends keyof T['selectable']
      ? T['selectable'][Arg]['column']
      : T['relations'] extends Record<string, Relation>
      ? Arg extends keyof T['relations']
        ? T['relations'][Arg]['returns'] extends 'many'
          ? ArrayOfColumnsObjects<T['relations'][Arg]['table']['result']>
          : T['relations'][Arg]['options']['required'] extends true
          ? ColumnsObject<T['relations'][Arg]['table']['result']>
          : NullableColumn<
              ColumnsObject<T['relations'][Arg]['table']['result']>
            >
        : never
      : never;
  } & {
    [K in keyof SelectAsArgs]: SelectAsArgs[K] extends keyof T['selectable']
      ? T['selectable'][SelectAsArgs[K]]['column']
      : SelectAsArgs[K] extends RawExpression
      ? SelectAsArgs[K]['__column']
      : SelectAsArgs[K] extends (q: T) => Query
      ? SelectSubQueryResult<ReturnType<SelectAsArgs[K]>>
      : SelectAsArgs[K] extends ((q: T) => Query) | RawExpression
      ?
          | SelectSubQueryResult<
              ReturnType<Exclude<SelectAsArgs[K], RawExpression>>
            >
          | Exclude<SelectAsArgs[K], (q: T) => Query>['__column']
      : never;
  }
>;

type SelectSubQueryResult<
  Arg extends Query & { [isRequiredRelationKey]?: boolean },
> = QueryReturnsAll<Arg['returnType']> extends true
  ? ArrayOfColumnsObjects<Arg['result']>
  : Arg['returnType'] extends 'valueOrThrow'
  ? Arg['result']['value']
  : Arg['returnType'] extends 'pluck'
  ? PluckResultColumnType<Arg['result']['pluck']>
  : Arg[isRequiredRelationKey] extends true
  ? ColumnsObject<Arg['result']>
  : NullableColumn<ColumnsObject<Arg['result']>>;

export const addParserForRawExpression = (
  q: Query,
  key: string | getValueKey,
  raw: RawExpression,
) => {
  const parser = raw.__column?.parseFn;
  if (parser) addParserToQuery(q.query, key, parser);
};

// these are used as a wrapper to pass sub query result to `parseRecord`
const subQueryResult: QueryResult = {
  // sub query can't return a rowCount, use -1 as for impossible case
  rowCount: -1,
  rows: [],
};

export const addParserForSelectItem = <T extends Query>(
  q: T,
  as: string | getValueKey | undefined,
  key: string,
  arg: StringKey<keyof T['selectable']> | RawExpression | ((q: T) => Query),
): string | RawExpression | Query => {
  if (typeof arg === 'object') {
    addParserForRawExpression(q, key, arg);
    return arg;
  } else if (typeof arg === 'function') {
    q.isSubQuery = true;
    const rel = arg(q);
    q.isSubQuery = false;
    const { parsers } = rel.query;
    if (parsers) {
      addParserToQuery(q.query, key, (item) => {
        const t = rel.query.returnType || 'all';
        subQueryResult.rows =
          t === 'all' || t === 'rows' || t === 'pluck'
            ? (item as unknown[])
            : [item];
        return parseResult(rel, t, subQueryResult, true);
      });
    }
    return rel;
  } else {
    const index = arg.indexOf('.');
    if (index !== -1) {
      const table = arg.slice(0, index);
      const column = arg.slice(index + 1);

      if (table === as) {
        const parser = q.query.parsers?.[column];
        if (parser) addParserToQuery(q.query, key, parser);
      } else {
        const parser = q.query.joinedParsers?.[table]?.[column];
        if (parser) addParserToQuery(q.query, key, parser);
      }
    } else {
      const parser = q.query.parsers?.[arg];
      if (parser) addParserToQuery(q.query, key, parser);
    }
    return arg;
  }
};

export const addParserToQuery = (
  query: QueryData,
  key: string | getValueKey,
  parser: ColumnParser,
) => {
  if (query.parsers) query.parsers[key] = parser;
  else query.parsers = { [key]: parser } as ColumnsParsers;
};

export const processSelectArg = <T extends Query>(
  q: T,
  as: string | undefined,
  arg: SelectArg<T>,
  columnAs?: string | getValueKey,
): SelectItem => {
  if (typeof arg === 'string') {
    if ((q.relations as Record<string, Relation>)[arg]) {
      const rel = (q.relations as Record<string, Relation>)[arg];
      arg = {
        [arg]: () => rel.joinQuery(q, rel.query),
      };
    } else {
      return processSelectColumnArg(q, arg, as, columnAs);
    }
  }

  return processSelectAsArg(q, arg, as);
};

const processSelectColumnArg = <T extends Query>(
  q: T,
  arg: string,
  as?: string,
  columnAs?: string | getValueKey,
): SelectItem => {
  const index = arg.indexOf('.');
  if (index !== -1) {
    const table = arg.slice(0, index);
    const column = arg.slice(index + 1);

    if (table === as) {
      const parser = q.query.parsers?.[column];
      if (parser) addParserToQuery(q.query, columnAs || column, parser);
    } else {
      const parser = q.query.joinedParsers?.[table]?.[column];
      if (parser) addParserToQuery(q.query, columnAs || column, parser);
    }
  } else {
    const parser = q.query.parsers?.[arg];
    if (parser) addParserToQuery(q.query, columnAs || arg, parser);
  }
  return arg;
};

const processSelectAsArg = <T extends Query>(
  q: T,
  arg: SelectAsArg<T>,
  as?: string,
): SelectItem => {
  const selectAs: Record<string, string | Query | RawExpression> = {};
  for (const key in arg) {
    selectAs[key] = addParserForSelectItem(q, as, key, arg[key]);
  }
  return { selectAs };
};

// is mapping result of a query into a columns shape
// in this way, result of a sub query becomes available outside of it for using in WHERE and other methods
export const getShapeFromSelect = (q: Query, isSubQuery?: boolean) => {
  const query = q.query as SelectQueryData;
  const { select, shape } = query;
  if (!select) {
    return shape;
  }

  const result: ColumnsShapeBase = {};
  for (const item of select) {
    if (typeof item === 'string') {
      addColumnToShapeFromSelect(q, item, shape, query, result, isSubQuery);
    } else if ('selectAs' in item) {
      for (const key in item.selectAs) {
        const it = item.selectAs[key];
        if (typeof it === 'string') {
          addColumnToShapeFromSelect(
            q,
            it,
            shape,
            query,
            result,
            isSubQuery,
            key,
          );
        } else if (isRaw(it)) {
          result[key] = it.__column || new UnknownColumn(emptyObject);
        } else {
          const { returnType } = it.query;
          if (returnType === 'value' || returnType === 'valueOrThrow') {
            const type = (it.query as SelectQueryData)[getValueKey];
            if (type) result[key] = type;
          } else {
            result[key] = new JSONTextColumn(emptyObject);
          }
        }
      }
    }
  }

  return result;
};

const addColumnToShapeFromSelect = (
  q: Query,
  arg: string,
  shape: ColumnsShapeBase,
  query: SelectQueryData,
  result: ColumnsShapeBase,
  isSubQuery?: boolean,
  key?: string,
) => {
  if ((q.relations as Record<string, Relation>)[arg]) {
    result[key || arg] = new JSONTextColumn(emptyObject);
    return;
  }

  const index = arg.indexOf('.');
  if (index !== -1) {
    const table = arg.slice(0, index);
    const column = arg.slice(index + 1);
    if (table === (q.query.as || q.table)) {
      result[key || column] = shape[column];
    } else {
      const it = query.joinedShapes?.[table]?.[column];
      if (it) result[key || column] = maybeUnNameColumn(it, isSubQuery);
    }
  } else if (arg === '*') {
    for (const key in shape) {
      result[key] = maybeUnNameColumn(shape[key], isSubQuery);
    }
  } else {
    result[key || arg] = maybeUnNameColumn(shape[arg], isSubQuery);
  }
};

const maybeUnNameColumn = (column: ColumnTypeBase, isSubQuery?: boolean) => {
  if (!isSubQuery || !column.data.name) return column;

  const cloned = Object.create(column);
  cloned.data = { ...column.data };
  delete cloned.data.name;
  return cloned;
};

export class Select {
  select<T extends Query, K extends SelectArg<T>[]>(
    this: T,
    ...args: K
  ): SelectResult<T, K> {
    return this.clone()._select(...args) as unknown as SelectResult<T, K>;
  }

  _select<T extends Query, K extends SelectArg<T>[]>(
    this: T,
    ...args: K
  ): SelectResult<T, K> {
    if (!args.length) {
      return this as unknown as SelectResult<T, K>;
    }

    const as = this.query.as || this.table;
    const selectArgs = args.map((item) => processSelectArg(this, as, item));

    return pushQueryArray(
      this,
      'select',
      selectArgs,
    ) as unknown as SelectResult<T, K>;
  }

  selectAll<T extends Query>(this: T): QuerySelectAll<T> {
    return this.clone()._selectAll();
  }

  _selectAll<T extends Query>(this: T): QuerySelectAll<T> {
    this.query.select = ['*'];
    return this as unknown as QuerySelectAll<T>;
  }
}