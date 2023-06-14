import { RelationData, RelationThunkBase } from './relations';
import { Table } from '../baseTable';
import {
  ColumnType,
  CreateCtx,
  getQueryAs,
  HasAndBelongsToManyRelation,
  NotFoundError,
  OrchidOrmInternalError,
  Query,
  QueryBase,
  toSqlCacheKey,
  UpdateCtx,
  VirtualColumn,
  WhereArg,
  WhereResult,
} from 'pqb';
import { MaybeArray } from 'orchid-core';
import { hasRelationHandleCreate, hasRelationHandleUpdate } from './utils';
import { HasManyNestedInsert, HasManyNestedUpdate } from './hasMany';

export interface HasAndBelongsToMany extends RelationThunkBase {
  type: 'hasAndBelongsToMany';
  returns: 'many';
  options: HasAndBelongsToManyRelation['options'];
}

export type HasAndBelongsToManyInfo<
  T extends Table,
  Relation extends HasAndBelongsToMany,
> = {
  params: Record<
    Relation['options']['primaryKey'],
    T['columns']['shape'][Relation['options']['primaryKey']]['type']
  >;
  populate: never;
  chainedCreate: true;
  chainedDelete: true;
};

type State = {
  relatedTableQuery: Query;
  joinTableQuery: Query;
  primaryKey: string;
  foreignKey: string;
  associationPrimaryKey: string;
  associationForeignKey: string;
  foreignKeyFull: string;
  associationPrimaryKeyFull: string;
  associationForeignKeyFull: string;
};

class HasAndBelongsToManyVirtualColumn extends VirtualColumn {
  private readonly nestedInsert: HasManyNestedInsert;
  private readonly nestedUpdate: HasManyNestedUpdate;

  constructor(private key: string, private state: State) {
    super();
    this.nestedInsert = nestedInsert(state);
    this.nestedUpdate = nestedUpdate(state);
  }

  create(
    q: Query,
    ctx: CreateCtx,
    item: Record<string, unknown>,
    rowIndex: number,
  ) {
    hasRelationHandleCreate(
      q,
      ctx,
      item,
      rowIndex,
      this.key,
      this.state.primaryKey,
      this.nestedInsert,
    );
  }

  update(q: Query, _: UpdateCtx, set: Record<string, unknown>) {
    hasRelationHandleUpdate(
      q,
      set,
      this.key,
      this.state.primaryKey,
      this.nestedUpdate,
    );
  }
}

const removeColumnName = (column: ColumnType) => {
  if (!column.data.name) return column;

  const cloned = Object.create(column);
  cloned.data = { ...column.data, name: undefined };
  return cloned;
};

export const makeHasAndBelongsToManyMethod = (
  table: Query,
  qb: Query,
  relation: HasAndBelongsToMany,
  relationName: string,
  query: Query,
): RelationData => {
  const {
    primaryKey: pk,
    foreignKey: fk,
    associationPrimaryKey: apk,
    associationForeignKey: afk,
    joinTable,
  } = relation.options;

  const foreignKeyFull = `${joinTable}.${fk}`;
  const associationForeignKeyFull = `${joinTable}.${afk}`;
  const associationPrimaryKeyFull = `${getQueryAs(query)}.${apk}`;

  const baseQuery = Object.create(qb.baseQuery);
  baseQuery.baseQuery = baseQuery;
  baseQuery.table = joinTable;
  baseQuery.shape = {
    [fk]: removeColumnName(table.shape[pk]),
    [afk]: removeColumnName(query.shape[apk]),
  };
  baseQuery.query = {
    ...baseQuery.query,
    shape: baseQuery.shape,
  };
  const subQuery = Object.create(baseQuery);

  const state: State = {
    relatedTableQuery: query,
    joinTableQuery: subQuery,
    primaryKey: pk,
    foreignKey: fk,
    associationPrimaryKey: apk,
    associationForeignKey: afk,
    foreignKeyFull,
    associationForeignKeyFull,
    associationPrimaryKeyFull,
  };

  return {
    returns: 'many',
    method(params: Record<string, unknown>) {
      return query.whereExists(subQuery, (q) =>
        q.on(associationForeignKeyFull, associationPrimaryKeyFull).where({
          [foreignKeyFull]: params[pk],
        }),
      );
    },
    virtualColumn: new HasAndBelongsToManyVirtualColumn(relationName, state),
    // joinQuery can be a property of RelationQuery and be used by whereExists and other stuff which needs it
    // and the chained query itself may be a query around this joinQuery
    joinQuery(fromQuery, toQuery) {
      const join = toQuery.whereExists(subQuery, (q) =>
        q
          ._on(associationForeignKeyFull, `${getQueryAs(toQuery)}.${apk}`)
          ._on(foreignKeyFull, `${getQueryAs(fromQuery)}.${pk}`),
      );
      join.query.joinedShapes = {
        ...join.query.joinedShapes,
        [(fromQuery.query.as || fromQuery.table) as string]:
          fromQuery.query.shape,
      };
      return join;
    },
    reverseJoin(fromQuery, toQuery) {
      return fromQuery.whereExists(subQuery, (q) =>
        q
          ._on(associationForeignKeyFull, `${getQueryAs(toQuery)}.${apk}`)
          ._on(foreignKeyFull, `${getQueryAs(fromQuery)}.${pk}`),
      );
    },
    primaryKey: pk,
    modifyRelatedQuery(relationQuery) {
      const ref = {} as { query: Query };

      relationQuery._afterCreate([], async (result: unknown[]) => {
        if (result.length > 1) {
          // TODO: currently this relies on `INSERT ... SELECT` that works only for 1 record
          // consider using `WITH` to reuse id of main table for multiple related ids
          throw new OrchidOrmInternalError(
            relationQuery,
            'Creating multiple `hasAndBelongsToMany` records is not yet supported',
          );
        }

        const fromQuery = ref.query.clone();
        fromQuery.query.select = [{ selectAs: { [fk]: pk } }];

        const createdCount = await subQuery.count()._createFrom(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          fromQuery as any,
          {
            [afk]: (result[0] as Record<string, unknown>)[apk],
          } as never,
        );

        if (createdCount === 0) {
          throw new NotFoundError(fromQuery);
        }
      });

      return (q) => {
        ref.query = q;
      };
    },
  };
};

const queryJoinTable = (
  state: State,
  data: Record<string, unknown>[],
  conditions?: MaybeArray<WhereArg<Query>>,
) => {
  const t = state.joinTableQuery.clone();
  const where: WhereArg<Query> = {
    [state.foreignKey]: { in: data.map((item) => item[state.primaryKey]) },
  };

  if (conditions) {
    where[state.associationForeignKey] = {
      in: state.relatedTableQuery
        .where<Query>(
          Array.isArray(conditions) ? { OR: conditions } : conditions,
        )
        ._select(state.associationPrimaryKey),
    };
  }

  return t._where(where);
};

const queryRelatedTable = (
  query: Query,
  conditions: MaybeArray<WhereArg<Query>>,
) => {
  return query.where<Query>(
    Array.isArray(conditions) ? { OR: conditions } : conditions,
  );
};

const insertToJoinTable = (
  state: State,
  joinTableTransaction: Query,
  data: Record<string, unknown>[],
  ids: unknown[],
) => {
  return joinTableTransaction._count()._createMany(
    data.flatMap((item) =>
      ids.map((id) => ({
        [state.foreignKey]: item[state.primaryKey],
        [state.associationForeignKey]: id,
      })),
    ),
  );
};

const nestedInsert = ({
  relatedTableQuery,
  joinTableQuery,
  primaryKey,
  foreignKey,
  associationPrimaryKey,
  associationForeignKey,
}: State) => {
  return (async (_, data) => {
    const connect = data.filter(
      (
        item,
      ): item is [
        selfData: Record<string, unknown>,
        relationData: {
          connect: WhereArg<QueryBase>[];
        },
      ] => Boolean(item[1].connect),
    );

    const t = relatedTableQuery.clone();

    let connected: Record<string, unknown>[];
    if (connect.length) {
      connected = (await Promise.all(
        connect.flatMap(([, { connect }]) =>
          connect.map((item) =>
            t.select(associationPrimaryKey)._findBy(item)._take(),
          ),
        ),
      )) as Record<string, unknown[]>[];
    } else {
      connected = [];
    }

    const connectOrCreate = data.filter(
      (
        item,
      ): item is [
        Record<string, unknown>,
        {
          connectOrCreate: {
            where: WhereArg<QueryBase>;
            create: Record<string, unknown>;
          }[];
        },
      ] => Boolean(item[1].connectOrCreate),
    );

    let connectOrCreated: (Record<string, unknown> | undefined)[];
    if (connectOrCreate.length) {
      connectOrCreated = await Promise.all(
        connectOrCreate.flatMap(([, { connectOrCreate }]) =>
          connectOrCreate.map((item) =>
            t.select(associationPrimaryKey)._findBy(item.where)._takeOptional(),
          ),
        ),
      );
    } else {
      connectOrCreated = [];
    }

    let connectOrCreateI = 0;
    const create = data.filter(
      (
        item,
      ): item is [
        Record<string, unknown>,
        {
          create?: Record<string, unknown>[];
          connectOrCreate?: {
            where: WhereArg<QueryBase>;
            create: Record<string, unknown>;
          }[];
        },
      ] => {
        if (item[1].connectOrCreate) {
          const length = item[1].connectOrCreate.length;
          connectOrCreateI += length;
          for (let i = length; i > 0; i--) {
            if (!connectOrCreated[connectOrCreateI - i]) return true;
          }
        }
        return Boolean(item[1].create);
      },
    );

    connectOrCreateI = 0;
    let created: Record<string, unknown>[];
    if (create.length) {
      created = (await t
        .select(associationPrimaryKey)
        ._createMany(
          create.flatMap(([, { create = [], connectOrCreate = [] }]) => [
            ...create,
            ...connectOrCreate
              .filter(() => !connectOrCreated[connectOrCreateI++])
              .map((item) => item.create),
          ]),
        )) as Record<string, unknown>[];
    } else {
      created = [];
    }

    const allKeys = data as unknown as [
      selfData: Record<string, unknown>,
      relationKeys: Record<string, unknown>[],
    ][];

    let createI = 0;
    let connectI = 0;
    connectOrCreateI = 0;
    data.forEach(([, data], index) => {
      if (data.create || data.connectOrCreate) {
        if (data.create) {
          const len = data.create.length;
          allKeys[index][1] = created.slice(createI, createI + len);
          createI += len;
        }
        if (data.connectOrCreate) {
          const arr: Record<string, unknown>[] = [];
          allKeys[index][1] = arr;

          const len = data.connectOrCreate.length;
          for (let i = 0; i < len; i++) {
            const item = connectOrCreated[connectOrCreateI++];
            if (item) {
              arr.push(item);
            } else {
              arr.push(created[createI++]);
            }
          }
        }
      }

      if (data.connect) {
        const len = data.connect.length;
        allKeys[index][1] = connected.slice(connectI, connectI + len);
        connectI += len;
      }
    });

    await joinTableQuery.count()._createMany(
      allKeys.flatMap(([selfData, relationKeys]) => {
        const selfKey = selfData[primaryKey];
        return relationKeys.map((relationData) => ({
          [foreignKey]: selfKey,
          [associationForeignKey]: relationData[associationPrimaryKey],
        }));
      }),
    );
  }) as HasManyNestedInsert;
};

const nestedUpdate = (state: State) => {
  return (async (_, data, params) => {
    if (params.create) {
      const ids = await state.relatedTableQuery
        .pluck(state.associationPrimaryKey)
        ._createMany(params.create);

      await state.joinTableQuery.createMany(
        data.flatMap((item) =>
          ids.map((id) => ({
            [state.foreignKey]: item[state.primaryKey],
            [state.associationForeignKey]: id,
          })),
        ),
      );
    }

    if (params.update) {
      await (
        state.relatedTableQuery
          .whereExists(state.joinTableQuery, (q) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (q as any)
              ._on(
                state.associationForeignKeyFull,
                state.associationPrimaryKeyFull,
              )
              ._where({
                IN: {
                  columns: [state.foreignKeyFull],
                  values: [data.map((item) => item[state.primaryKey])],
                },
              }),
          )
          ._where(
            Array.isArray(params.update.where)
              ? { OR: params.update.where }
              : params.update.where,
          ) as WhereResult<Query>
      )._update<WhereResult<Query>>(params.update.data);
    }

    if (params.disconnect) {
      await queryJoinTable(state, data, params.disconnect)._delete();
    }

    if (params.delete) {
      const j = queryJoinTable(state, data, params.delete);

      const ids = await j._pluck(state.associationForeignKey)._delete();

      await queryRelatedTable(state.relatedTableQuery, {
        [state.associationPrimaryKey]: { in: ids },
      })._delete();
    }

    if (params.set) {
      const j = queryJoinTable(state, data);
      await j._delete();
      delete j.query[toSqlCacheKey];

      const ids = await queryRelatedTable(
        state.relatedTableQuery,
        params.set,
      )._pluck(state.associationPrimaryKey);

      await insertToJoinTable(state, j, data, ids);
    }
  }) as HasManyNestedUpdate;
};
