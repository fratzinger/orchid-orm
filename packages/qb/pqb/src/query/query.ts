import { GetStringArg, QueryMetaHasWhere, QueryMethods } from '../queryMethods';
import { QueryData } from '../sql';
import { QueryBuilder } from './db';
import {
  ColumnShapeOutput,
  EmptyObject,
  Expression,
  IsQueries,
  OperatorsNullable,
  PickOutputType,
  PickQueryMeta,
  PickQueryMetaResult,
  PickQueryMetaReturnType,
  PickQueryResult,
  PickQueryResultReturnType,
  PickType,
  QueryBase,
  QueryCatch,
  QueryColumn,
  QueryColumns,
  QueryError,
  QueryErrorName,
  QueryInternalBase,
  QueryMetaBase,
  QueryOrExpression,
  QueryReturnType,
  QueryThen,
  QueryThenByQuery,
  QueryThenShallowSimplify,
  QueryThenShallowSimplifyArr,
  QueryThenShallowSimplifyOptional,
  RecordKeyTrue,
  RecordUnknown,
  RelationsBase,
  WithDataItems,
} from 'orchid-core';
import { ColumnType } from '../columns';
import { TableData } from '../tableData';

export interface DbExtension {
  name: string;
  version?: string;
}

export interface GeneratorIgnore {
  schemas?: string[];
  enums?: string[];
  domains?: string[];
  extensions?: string[];
  tables?: string[];
}

export interface DbDomainArg<ColumnTypes> {
  (columnTypes: ColumnTypes): ColumnType;
}

export interface DbDomainArgRecord {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [K: string]: DbDomainArg<any>;
}

export interface QueryInternal<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SinglePrimaryKey = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  UniqueColumns = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  UniqueColumnNames = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  UniqueColumnTuples = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  UniqueConstraints = any,
> extends QueryInternalBase {
  singlePrimaryKey: SinglePrimaryKey;
  uniqueColumns: UniqueColumns;
  uniqueColumnNames: UniqueColumnNames;
  uniqueColumnTuples: UniqueColumnTuples;
  uniqueConstraints: UniqueConstraints;
  extensions?: DbExtension[];
  domains?: DbDomainArgRecord;
  generatorIgnore?: GeneratorIgnore;
  tableData: TableData;
  // For customizing `now()` sql
  nowSQL?: string;
  // for select, where, join callbacks: memoize a query extended with relations, so query.relName is a relation query
  callbackArg?: Query;
}

export type SelectableFromShape<
  Shape extends QueryColumns,
  Table extends string | undefined,
> = { [K in keyof Shape]: { as: K; column: Shape[K] } } & {
  [K in keyof Shape & string as `${Table}.${K}`]: {
    as: K;
    column: Shape[K];
  };
};

export interface Query extends QueryBase, QueryMethods<unknown> {
  __isQuery: true;
  result: QueryColumns;
  withData: WithDataItems;
  baseQuery: Query;
  internal: QueryInternal;
  meta: QueryMetaBase<EmptyObject>;
  returnType: QueryReturnType;
  qb: QueryBuilder;
  columnTypes: unknown;
  inputType: RecordUnknown;
  q: QueryData;
  then: QueryThen<unknown>;
  catch: QueryCatch;
  windows: EmptyObject;
  relations: RelationsBase;
  relationQueries: IsQueries;
  error: new (
    message: string,
    length: number,
    name: QueryErrorName,
  ) => QueryError;
}

export interface PickQueryQ {
  q: QueryData;
}

export interface PickQueryInternal {
  internal: QueryInternal;
}

export interface PickQueryBaseQuery {
  baseQuery: Query;
}

export interface PickQueryQAndInternal extends PickQueryQ, PickQueryInternal {}

export interface PickQueryQAndBaseQuery
  extends PickQueryQ,
    PickQueryBaseQuery {}

export type SelectableOfType<T extends PickQueryMeta, Type> = {
  [K in keyof T['meta']['selectable']]: T['meta']['selectable'][K]['column']['type'] extends Type | null
    ? K
    : never;
}[keyof T['meta']['selectable']];

export type SelectableOrExpressionOfType<
  T extends PickQueryMeta,
  C extends PickType,
> = SelectableOfType<T, C['type']> | Expression<QueryColumn<C['type'] | null>>;

export const queryTypeWithLimitOne: RecordKeyTrue = {
  one: true,
  oneOrThrow: true,
  value: true,
  valueOrThrow: true,
};

export const isQueryReturnsAll = (q: Query) =>
  !q.q.returnType || q.q.returnType === 'all';

// Merge { hasSelect: true } into 'meta' if it's not true yet.
export interface QueryMetaHasSelect {
  meta: {
    hasSelect: true;
  };
}

// Change the query type to return multiple object records.
// It wraps the query with `WhereResult` to allow updating and deleting all records when the `all` method is used.
export type SetQueryReturnsAll<T extends PickQueryResult> = {
  [K in keyof T]: K extends 'returnType'
    ? 'all'
    : K extends 'then'
    ? QueryThenShallowSimplifyArr<ColumnShapeOutput<T['result']>>
    : T[K];
} & QueryMetaHasWhere;

export type SetQueryReturnsAllKind<
  T extends PickQueryMetaResult,
  Kind extends string,
> = {
  [K in keyof T]: K extends 'meta'
    ? {
        [K in keyof T['meta']]: K extends 'kind' ? Kind : T['meta'][K];
      }
    : K extends 'returnType'
    ? 'all'
    : K extends 'then'
    ? QueryThenShallowSimplifyArr<ColumnShapeOutput<T['result']>>
    : T[K];
} & QueryMetaHasWhere;

export type SetQueryReturnsAllKindResult<
  T extends PickQueryMetaResult,
  Kind extends string,
  Result extends QueryColumns,
> = {
  [K in keyof T]: K extends 'meta'
    ? {
        [K in keyof T['meta']]: K extends 'kind' ? Kind : T['meta'][K];
      }
    : K extends 'returnType'
    ? 'all'
    : K extends 'result'
    ? Result
    : K extends 'then'
    ? QueryThenShallowSimplifyArr<T['result']>
    : T[K];
} & QueryMetaHasWhere;

export type QueryTakeOptional<T extends PickQueryResultReturnType> =
  T['returnType'] extends 'value' | 'pluck' | 'void'
    ? T
    : T['returnType'] extends 'valueOrThrow'
    ? {
        [K in keyof T]: K extends 'returnType'
          ? 'value'
          : K extends 'then'
          ? QueryThen<T['result']['value']['outputType'] | undefined>
          : T[K];
      }
    : {
        [K in keyof T]: K extends 'returnType'
          ? 'one'
          : K extends 'then'
          ? QueryThenShallowSimplifyOptional<ColumnShapeOutput<T['result']>>
          : T[K];
      };

export type QueryTake<T extends PickQueryResultReturnType> =
  T['returnType'] extends 'valueOrThrow' | 'pluck' | 'void'
    ? T
    : T['returnType'] extends 'value'
    ? {
        [K in keyof T]: K extends 'returnType'
          ? 'valueOrThrow'
          : K extends 'then'
          ? QueryThen<Exclude<T['result']['value']['outputType'], undefined>>
          : T[K];
      }
    : {
        [K in keyof T]: K extends 'returnType'
          ? 'oneOrThrow'
          : K extends 'then'
          ? QueryThenShallowSimplify<ColumnShapeOutput<T['result']>>
          : T[K];
      };

export type SetQueryReturnsOneKind<
  T extends PickQueryMetaResult,
  Kind extends string,
> = {
  [K in keyof T]: K extends 'meta'
    ? {
        [K in keyof T['meta']]: K extends 'kind' ? Kind : T['meta'][K];
      }
    : K extends 'returnType'
    ? 'oneOrThrow'
    : K extends 'then'
    ? QueryThenShallowSimplify<ColumnShapeOutput<T['result']>>
    : T[K];
};

export type SetQueryReturnsOneKindResult<
  T extends PickQueryMetaResult,
  Kind extends string,
  Result extends QueryColumns,
> = {
  [K in keyof T]: K extends 'meta'
    ? {
        [K in keyof T['meta']]: K extends 'kind' ? Kind : T['meta'][K];
      }
    : K extends 'returnType'
    ? 'oneOrThrow'
    : K extends 'result'
    ? Result
    : K extends 'then'
    ? QueryThenShallowSimplify<ColumnShapeOutput<Result>>
    : T[K];
};

export type SetQueryReturnsRows<T extends PickQueryResult> = {
  [K in keyof T]: K extends 'returnType'
    ? 'rows'
    : K extends 'then'
    ? QueryThen<ColumnShapeOutput<T['result']>[keyof T['result']][][]>
    : T[K];
};

export type SetQueryReturnsPluck<
  T extends PickQueryMeta,
  S extends keyof T['meta']['selectable'] | Expression,
> = SetQueryReturnsPluckColumn<
  T,
  S extends keyof T['meta']['selectable']
    ? T['meta']['selectable'][S]['column']
    : S extends Expression
    ? S['result']['value']
    : never
>;

export type SetQueryReturnsPluckColumn<T, C extends QueryColumn> = {
  [K in keyof T]: K extends 'result'
    ? { pluck: C }
    : K extends 'returnType'
    ? 'pluck'
    : K extends 'then'
    ? QueryThen<C['outputType'][]>
    : T[K];
} & QueryMetaHasSelect;

export type SetQueryReturnsPluckColumnKind<
  T extends PickQueryMetaResult,
  Kind extends string,
> = {
  [K in keyof T]: K extends 'meta'
    ? {
        [K in keyof T['meta']]: K extends 'kind' ? Kind : T['meta'][K];
      }
    : K extends 'result'
    ? { pluck: T['result']['value'] }
    : K extends 'returnType'
    ? 'pluck'
    : K extends 'then'
    ? QueryThen<T['result']['value']['outputType'][]>
    : T[K];
} & QueryMetaHasSelect;

export type SetQueryReturnsPluckColumnKindResult<
  T extends PickQueryMetaResult,
  Kind extends string,
  Result extends QueryColumns,
> = {
  [K in keyof T]: K extends 'meta'
    ? {
        [K in keyof T['meta']]: K extends 'kind' ? Kind : T['meta'][K];
      }
    : K extends 'result'
    ? { pluck: T['result']['value'] }
    : K extends 'returnType'
    ? 'pluck'
    : K extends 'result'
    ? Result
    : K extends 'then'
    ? QueryThen<T['result']['value']['outputType'][]>
    : T[K];
} & QueryMetaHasSelect;

export type SetQueryReturnsValueOrThrow<
  T extends PickQueryMeta,
  Arg extends keyof T['meta']['selectable'],
> = SetQueryReturnsColumnOrThrow<T, T['meta']['selectable'][Arg]['column']> &
  T['meta']['selectable'][Arg]['column']['operators'];

export type SetQueryReturnsValueOrThrowKind<
  T extends PickQueryMetaResult,
  Kind extends string,
> = {
  [K in keyof T]: K extends 'meta'
    ? {
        [K in keyof T['meta']]: K extends 'kind' ? Kind : T['meta'][K];
      }
    : K extends 'returnType'
    ? 'valueOrThrow'
    : K extends 'then'
    ? QueryThen<T['result']['value']['outputType']>
    : T[K];
};

export type SetQueryReturnsValueOptional<
  T extends PickQueryMeta,
  Arg extends GetStringArg<T>,
> = SetQueryReturnsColumnOptional<
  T,
  {
    [K in keyof T['meta']['selectable'][Arg]['column']]: K extends 'outputType'
      ? T['meta']['selectable'][Arg]['column'][K] | undefined
      : T['meta']['selectable'][Arg]['column'][K];
  }
> &
  Omit<T['meta']['selectable'][Arg]['column']['operators'], 'equals' | 'not'> &
  OperatorsNullable<T['meta']['selectable'][Arg]['column']>;

export type SetQueryReturnsColumnOrThrow<T, Column extends PickOutputType> = {
  [K in keyof T]: K extends 'result'
    ? { value: Column }
    : K extends 'returnType'
    ? 'valueOrThrow'
    : K extends 'then'
    ? QueryThen<Column['outputType']>
    : T[K];
} & QueryMetaHasSelect;

export type SetQueryReturnsColumnOptional<T, Column extends PickOutputType> = {
  [K in keyof T]: K extends 'result'
    ? { value: Column }
    : K extends 'returnType'
    ? 'value'
    : K extends 'then'
    ? QueryThen<Column['outputType'] | undefined>
    : T[K];
} & QueryMetaHasSelect;

export type SetQueryReturnsColumnKind<
  T extends PickQueryMetaResult,
  Kind extends string,
> = {
  [K in keyof T]: K extends 'meta'
    ? {
        [K in keyof T['meta']]: K extends 'kind' ? Kind : T['meta'][K];
      }
    : K extends 'result'
    ? { value: T['result']['pluck'] }
    : K extends 'returnType'
    ? 'valueOrThrow'
    : K extends 'then'
    ? QueryThen<T['result']['pluck']['outputType']>
    : T[K];
} & QueryMetaHasSelect;

export type SetQueryReturnsColumnKindResult<
  T extends PickQueryMetaResult,
  Kind extends string,
  Result extends QueryColumns,
> = {
  [K in keyof T]: K extends 'meta'
    ? {
        [K in keyof T['meta']]: K extends 'kind' ? Kind : T['meta'][K];
      }
    : K extends 'result'
    ? { value: T['result']['pluck'] }
    : K extends 'returnType'
    ? 'valueOrThrow'
    : K extends 'result'
    ? Result
    : K extends 'then'
    ? QueryThen<Result['pluck']['outputType']>
    : T[K];
} & QueryMetaHasSelect;

export type SetQueryReturnsRowCount<
  T extends PickQueryMetaResult,
  Kind extends string,
> = {
  [K in keyof T]: K extends 'meta'
    ? {
        [K in keyof T['meta']]: K extends 'kind' ? Kind : T['meta'][K];
      }
    : K extends 'returnType'
    ? 'valueOrThrow'
    : K extends 'result'
    ? { value: QueryColumn<number> }
    : K extends 'then'
    ? QueryThen<number>
    : T[K];
};

export type SetQueryReturnsRowCountMany<
  T extends PickQueryMetaResult,
  Kind extends string,
> = {
  [K in keyof T]: K extends 'meta'
    ? {
        [K in keyof T['meta']]: K extends 'kind' ? Kind : T['meta'][K];
      }
    : K extends 'returnType'
    ? 'pluck'
    : K extends 'result'
    ? { pluck: QueryColumn<number> }
    : K extends 'then'
    ? QueryThen<number>
    : T[K];
};

export type SetQueryReturnsVoid<T> = {
  [K in keyof T]: K extends 'returnType'
    ? 'void'
    : K extends 'then'
    ? QueryThen<void>
    : T[K];
};

export type SetQueryReturnsVoidKind<
  T extends PickQueryMeta,
  Kind extends string,
> = {
  [K in keyof T]: K extends 'meta'
    ? {
        [K in keyof T['meta']]: K extends 'kind' ? Kind : T['meta'][K];
      }
    : K extends 'returnType'
    ? 'void'
    : K extends 'then'
    ? QueryThen<void>
    : T[K];
};

// Set the kind of the query, can be 'select', 'update', 'create', etc.
// `update` method is using the kind of query to allow only 'select' as a callback return for a column.
export type SetQueryKind<T extends PickQueryMeta, Kind extends string> = {
  [K in keyof T]: K extends 'meta'
    ? {
        [K in keyof T['meta']]: K extends 'kind' ? Kind : T['meta'][K];
      }
    : T[K];
};

export type SetQueryKindResult<
  T extends PickQueryMetaReturnType,
  Kind extends string,
  Result extends QueryColumns,
> = {
  [K in keyof T]: K extends 'meta'
    ? {
        [K in keyof T['meta']]: K extends 'kind' ? Kind : T['meta'][K];
      }
    : K extends 'result'
    ? Result
    : K extends 'then'
    ? QueryThenByQuery<T, Result>
    : T[K];
};

export interface ReturnsQueryOrExpression<T> {
  (): QueryOrExpression<T>;
}

export interface QueryOrExpressionBooleanOrNullResult {
  result: { value: QueryColumn<boolean | null> };
}
