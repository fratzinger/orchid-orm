import { BelongsTo, BelongsToParams, makeBelongsToMethod } from './belongsTo';
import { HasOne, HasOneParams, makeHasOneMethod } from './hasOne';
import {
  ORMTableInputToQueryBuilder,
  ORMTableInput,
  TableClass,
  TableInfo,
} from '../baseTable';
import { OrchidORM } from '../orm';
import {
  _queryTake,
  _queryTakeOptional,
  CreateData,
  Query,
  RelationJoinQuery,
  RelationsBase,
  VirtualColumn,
  WhereArg,
} from 'pqb';
import {
  ColumnSchemaConfig,
  ColumnsShapeBase,
  IsQuery,
  RecordUnknown,
} from 'orchid-core';
import { HasMany, makeHasManyMethod } from './hasMany';
import {
  HasAndBelongsToMany,
  HasAndBelongsToManyParams,
  makeHasAndBelongsToManyMethod,
} from './hasAndBelongsToMany';
import { getSourceRelation, getThroughRelation } from './common/utils';

// `belongsTo` and `hasOne` relation data available for create. It supports:
// - `create` to create a related record
// - `connect` to find existing record and use its primary key
// - `connectOrCreate` to first try connecting to an existing record, and create it if not found
export type RelationToOneDataForCreate<
  Rel extends { nestedCreateQuery: unknown; table: Query },
> =
  | {
      create: Rel['nestedCreateQuery'];
      connect?: never;
      connectOrCreate?: never;
    }
  | {
      create?: never;
      connect: WhereArg<Rel['table']>;
      connectOrCreate?: never;
    }
  | {
      create?: never;
      connect?: never;
      connectOrCreate: {
        where: WhereArg<Rel['table']>;
        create: Rel['nestedCreateQuery'];
      };
    };

export type RelationToOneDataForCreateSameQuery<Q extends Query> =
  | {
      create: CreateData<Q>;
      connect?: never;
      connectOrCreate?: never;
    }
  | {
      create?: never;
      connect: WhereArg<Q>;
      connectOrCreate?: never;
    }
  | {
      create?: never;
      connect?: never;
      connectOrCreate: {
        where: WhereArg<Q>;
        create: CreateData<Q>;
      };
    };

export interface RelationThunkBase {
  type: string;
  fn(): TableClass;
  options: unknown;
}

export type RelationThunk = BelongsTo | HasOne | HasMany | HasAndBelongsToMany;

export interface RelationThunks {
  [K: string]: RelationThunk;
}

export interface RelationData {
  returns: 'one' | 'many';
  queryRelated(params: RecordUnknown): Query;
  virtualColumn?: VirtualColumn<ColumnSchemaConfig>;
  joinQuery: RelationJoinQuery;
  reverseJoin: RelationJoinQuery;
  modifyRelatedQuery?(relatedQuery: IsQuery): (query: IsQuery) => void;
}

export type RelationTableToQuery<Relation extends RelationThunkBase> =
  ORMTableInputToQueryBuilder<InstanceType<ReturnType<Relation['fn']>>>;

export interface RelationConfigSelf {
  columns: { shape: ColumnsShapeBase };
  relations: RelationThunks;
}

export type RelationConfigParams<
  T extends RelationConfigSelf,
  Relation extends RelationThunk,
> = Relation extends BelongsTo
  ? BelongsToParams<T, Relation>
  : Relation extends HasOne | HasMany
  ? HasOneParams<T, Relation>
  : Relation extends HasAndBelongsToMany
  ? HasAndBelongsToManyParams<T, Relation>
  : never;

interface ApplyRelationData {
  relationName: string;
  relation: RelationThunk;
  dbTable: Query;
  otherDbTable: Query;
}

type DelayedRelations = Map<Query, Record<string, ApplyRelationData[]>>;

export const applyRelations = (
  qb: Query,
  tables: Record<string, ORMTableInput>,
  result: OrchidORM,
) => {
  const tableEntries = Object.entries(tables);

  const delayedRelations: DelayedRelations = new Map();

  for (const name in tables) {
    const table = tables[name] as ORMTableInput & {
      relations?: RelationThunks;
    };
    if (!('relations' in table) || typeof table.relations !== 'object')
      continue;

    const dbTable = result[name];
    for (const relationName in table.relations) {
      const relation = table.relations[relationName];
      const otherTableClass = relation.fn();
      const otherTable = tableEntries.find(
        (pair) => pair[1] instanceof otherTableClass,
      );
      if (!otherTable) {
        throw new Error(
          `Cannot find table class for class ${otherTableClass.name}`,
        );
      }
      const otherTableName = otherTable[0];
      const otherDbTable = result[otherTableName];
      if (!otherDbTable)
        throw new Error(`Cannot find table class by name ${otherTableName}`);

      const data: ApplyRelationData = {
        relationName,
        relation,
        dbTable,
        otherDbTable,
      };

      const options = relation.options as { through?: string; source?: string };
      if (
        typeof options.through === 'string' &&
        typeof options.source === 'string'
      ) {
        const throughRelation = getThroughRelation(dbTable, options.through);
        if (!throughRelation) {
          delayRelation(delayedRelations, dbTable, options.through, data);
          continue;
        }

        const sourceRelation = getSourceRelation(
          throughRelation,
          options.source,
        );
        if (!sourceRelation) {
          delayRelation(
            delayedRelations,
            (throughRelation as unknown as { table: Query }).table,
            options.source,
            data,
          );
          continue;
        }
      }

      applyRelation(table, qb, data, delayedRelations);
    }
  }

  if (delayedRelations.size) {
    const { value } = delayedRelations.values().next() as {
      value: Record<string, ApplyRelationData[]>;
    };
    for (const key in value) {
      for (const item of value[key]) {
        const { relation } = item;

        if (item.dbTable.relations[item.relationName] as never) continue;

        const as = (item.dbTable as unknown as TableInfo).definedAs;
        let message = `Cannot define a \`${item.relationName}\` relation on \`${as}\``;
        const table = result[as];

        const { through, source } = relation.options as {
          through: string;
          source: string;
        };
        const throughRel = (table.relations as RelationsBase)[
          through
        ] as unknown as { table: Query } | undefined;

        if (through && !throughRel) {
          message += `: cannot find \`${through}\` relation required by the \`through\` option`;
        } else if (
          source &&
          throughRel &&
          !throughRel.table.relations[source as never]
        ) {
          message += `: cannot find \`${source}\` relation in \`${
            (throughRel.table as unknown as TableInfo).definedAs
          }\` required by the \`source\` option`;
        }

        throw new Error(message);
      }
    }
  }
};

const delayRelation = (
  delayedRelations: DelayedRelations,
  table: Query,
  relationName: string,
  data: ApplyRelationData,
) => {
  let tableRelations = delayedRelations.get(table);
  if (!tableRelations) {
    tableRelations = {};
    delayedRelations.set(table, tableRelations);
  }
  if (tableRelations[relationName]) {
    tableRelations[relationName].push(data);
  } else {
    tableRelations[relationName] = [data];
  }
};

const applyRelation = (
  table: ORMTableInput,
  qb: Query,
  { relationName, relation, dbTable, otherDbTable }: ApplyRelationData,
  delayedRelations: DelayedRelations,
) => {
  const baseQuery = Object.create(otherDbTable);
  baseQuery.baseQuery = baseQuery;

  const query = baseQuery.as(relationName);

  const definedAs = (query as unknown as { definedAs?: string }).definedAs;
  if (!definedAs) {
    throw new Error(
      `Table class for table ${query.table} is not attached to db instance`,
    );
  }

  const { type } = relation;
  let data;
  if (type === 'belongsTo') {
    data = makeBelongsToMethod(table, dbTable, relation, relationName, query);
  } else if (type === 'hasOne') {
    data = makeHasOneMethod(table, dbTable, relation, relationName, query);
  } else if (type === 'hasMany') {
    data = makeHasManyMethod(table, dbTable, relation, relationName, query);
  } else if (type === 'hasAndBelongsToMany') {
    data = makeHasAndBelongsToManyMethod(
      table,
      dbTable,
      qb,
      relation,
      relationName,
      query,
    );
  } else {
    throw new Error(`Unknown relation type ${type}`);
  }

  if (data.returns === 'one') {
    if (relation.options.required) {
      _queryTake(query);
    } else {
      _queryTakeOptional(query);
    }

    query.q.returnsOne = true;
  }

  if (data.virtualColumn) {
    dbTable.shape[relationName] = dbTable.q.shape[relationName] =
      data.virtualColumn;
  }

  baseQuery.joinQuery = data.joinQuery;

  const { join: originalJoin } = baseQuery;
  baseQuery.join = function (...args: unknown[]) {
    if (args.length) {
      return originalJoin.apply(this, args);
    } else {
      const q = this.clone();
      q.q.innerJoinLateral = true;
      return q;
    }
  };

  (dbTable.relations as RecordUnknown)[relationName] = {
    table: otherDbTable,
    query,
    queryRelated: data.queryRelated,
    joinQuery: data.joinQuery,
    reverseJoin: data.reverseJoin,
    modifyRelatedQuery: data.modifyRelatedQuery,
  };

  (dbTable.relationQueries ??= {})[relationName] = query;

  const tableRelations = delayedRelations.get(dbTable);
  if (!tableRelations) return;

  tableRelations[relationName]?.forEach((data) => {
    applyRelation(table, qb, data, delayedRelations);
  });
};
