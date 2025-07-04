import { quoteSchemaAndTable, rawOrColumnToSql, columnToSql } from './common';
import { JoinItem, JoinItemArgs, SimpleJoinItemNonSubQueryArgs } from './types';
import { PickQueryQAndBaseQuery, Query } from '../query/query';
import { whereToSql } from './where';
import { ToSQLCtx, ToSQLQuery } from './toSQL';
import {
  JoinedShapes,
  PickQueryDataShapeAndJoinedShapes,
  PickQueryDataShapeAndJoinedShapesAndAliases,
  QueryData,
} from './data';
import {
  addValue,
  Expression,
  isExpression,
  QueryColumns,
  RecordBoolean,
  RecordUnknown,
} from 'orchid-core';
import { RawSQL } from './rawSql';
import { getSqlText } from './utils';
import { getQueryAs } from '../common/utils';

type ItemOf2Or3Length =
  | [leftColumn: string | Expression, rightColumn: string | Expression]
  | [
      leftColumn: string | Expression,
      op: string,
      rightColumn?: string | Expression,
    ];

interface SqlJoinItem {
  target: string;
  on?: string;
}

export const processJoinItem = (
  ctx: ToSQLCtx,
  table: ToSQLQuery,
  query: PickQueryDataShapeAndJoinedShapesAndAliases,
  args: JoinItemArgs,
  quotedAs: string | undefined,
): SqlJoinItem => {
  let target: string;
  let on: string | undefined;

  // lateral
  if ('l' in args) {
    const { aliasValue } = ctx;
    ctx.aliasValue = true;

    target = `(${getSqlText(args.l.toSQL(ctx))}) "${
      query.aliases?.[args.a] || args.a
    }"`;

    on = `${args.i ? `"${args.a}".r IS NOT NULL` : 'true'}`;

    ctx.aliasValue = aliasValue;
  } else if ('j' in args) {
    const { j, s, r } = args as {
      j: Query;
      s: boolean;
      r?: Query;
    };

    const tableName = (
      typeof j.q.from === 'string' ? j.q.from : j.table
    ) as string;

    const quotedTable = quoteSchemaAndTable(j.q.schema, tableName);
    target = quotedTable;

    const as = j.q.as as string;
    const joinAs = `"${as}"`;
    if (as !== tableName) {
      target += ` ${joinAs}`;
    }

    if (r && s) {
      target = `LATERAL ${subJoinToSql(ctx, j, quotedTable, joinAs, true)}`;
    } else {
      on = whereToSql(ctx, j, j.q, joinAs);
    }
  } else if ('w' in args) {
    const { w } = args;
    target = `"${w}"`;

    if ('r' in args) {
      const { s, r } = args as {
        w: string;
        s: boolean;
        r: Query;
      };
      if (s) {
        target = `LATERAL ${subJoinToSql(ctx, r, target, target)}`;
      } else {
        on = whereToSql(ctx, r as Query, r.q, target);
      }
    } else {
      on = processArgs(
        args.a,
        ctx,
        query,
        target,
        (query.joinedShapes as JoinedShapes)[w],
        quotedAs,
      );
    }
  } else if ('d' in args) {
    const shape = args.c;
    const { values } = ctx;

    target = `(VALUES ${args.d
      .map((x) => {
        return (
          '(' +
          Object.entries(shape)
            .map(([key, column]) => {
              const value = x[key];
              return (
                addValue(
                  values,
                  value === null || value === undefined
                    ? null
                    : column.data.encode
                    ? column.data.encode(value)
                    : value,
                ) +
                '::' +
                column.dataType
              );
            })
            .join(', ') +
          ')'
        );
      })
      .join(', ')}) "${args.a}"(${Object.entries(shape)
      .map(([key, column]) => `"${column.data.name || key}"`)
      .join(', ')})`;
  } else {
    const { q, s } = args as {
      q: Query;
      s: boolean;
    };
    let joinAs;

    if ('r' in args) {
      const { r } = args as {
        q: Query;
        s: boolean;
        r: Query;
      };

      const res = getArgQueryTarget(ctx, q, s, s);
      target = s ? `LATERAL ${res.target}` : res.target;
      joinAs = res.joinAs;

      if (!s) {
        on = whereToSql(ctx, r, r.q, `"${getQueryAs(r)}"`);
      }
    } else {
      const res = getArgQueryTarget(ctx, q, s);
      target = res.target;
      joinAs = res.joinAs;

      if ('a' in args) {
        on = processArgs(args.a, ctx, query, joinAs, q.shape, quotedAs);
      }
    }

    // if it's a sub query, WHERE conditions are already in the sub query
    if (!s) {
      const whereSql = whereToSql(
        ctx,
        q,
        {
          ...q.q,
          joinedShapes: {
            ...query.joinedShapes,
            ...q.q.joinedShapes,
            [(table.q.as || table.table) as string]: table.q.shape,
          },
        },
        joinAs,
      );
      if (whereSql) {
        if (on) on += ` AND ${whereSql}`;
        else on = whereSql;
      }
    }
  }

  return { target, on };
};

const getArgQueryTarget = (
  ctx: ToSQLCtx,
  first: Query,
  joinSubQuery: boolean,
  cloned?: boolean,
) => {
  const joinQuery = first.q;

  const quotedFrom =
    typeof joinQuery.from === 'string' ? `"${joinQuery.from}"` : undefined;

  let joinAs = quotedFrom || `"${first.table}"`;

  const qAs = joinQuery.as ? `"${joinQuery.as}"` : undefined;
  const addAs = qAs && qAs !== joinAs;

  if (joinSubQuery) {
    return {
      target: subJoinToSql(ctx, first, joinAs, qAs, cloned),
      joinAs: addAs ? qAs : joinAs,
    };
  } else {
    let target =
      quotedFrom ||
      quoteSchemaAndTable(joinQuery.schema, first.table as string);
    if (addAs) {
      joinAs = qAs;
      target += ` ${qAs}`;
    }
    return { target, joinAs };
  }
};

const subJoinToSql = (
  ctx: ToSQLCtx,
  jq: Query,
  innerAs: string,
  outerAs?: string,
  cloned?: boolean,
) => {
  if (!jq.q.select && jq.q.selectAllColumns) {
    if (!cloned) jq = jq.clone();
    jq.q.select = [new RawSQL(`${innerAs}.*`)];
  }

  return `(${getSqlText(jq.toSQL(ctx))}) ${outerAs || innerAs}`;
};

const processArgs = (
  args: SimpleJoinItemNonSubQueryArgs,
  ctx: ToSQLCtx,
  query: PickQueryDataShapeAndJoinedShapes,
  joinAs: string,
  joinShape: QueryColumns,
  quotedAs?: string,
): string | undefined => {
  return args.length
    ? args.length === 1
      ? getObjectOrRawConditions(
          ctx,
          query,
          args[0],
          quotedAs,
          joinAs,
          joinShape,
        )
      : getConditionsFor3Or4LengthItem(
          ctx,
          query,
          joinAs,
          quotedAs,
          args as ItemOf2Or3Length,
          joinShape,
        )
    : undefined;
};

const getConditionsFor3Or4LengthItem = (
  ctx: ToSQLCtx,
  query: PickQueryDataShapeAndJoinedShapes,
  target: string,
  quotedAs: string | undefined,
  args: ItemOf2Or3Length,
  joinShape: QueryColumns,
): string => {
  const [leftColumn, opOrRightColumn, maybeRightColumn] = args;

  const op = maybeRightColumn ? opOrRightColumn : '=';
  const rightColumn = maybeRightColumn ? maybeRightColumn : opOrRightColumn;

  return `${rawOrColumnToSql(
    ctx,
    query,
    leftColumn,
    target,
    joinShape,
  )} ${op} ${rawOrColumnToSql(ctx, query, rightColumn, quotedAs, query.shape)}`;
};

const getObjectOrRawConditions = (
  ctx: ToSQLCtx,
  query: PickQueryDataShapeAndJoinedShapes,
  data: { [K: string]: string | Expression } | Expression | true,
  quotedAs: string | undefined,
  joinAs: string,
  joinShape: QueryColumns,
): string => {
  if (data === true) {
    return 'true';
  } else if (isExpression(data)) {
    return data.toSQL(ctx, quotedAs);
  } else {
    const pairs: string[] = [];
    const shape = query.shape;

    for (const key in data) {
      const value = data[key];

      pairs.push(
        `${columnToSql(
          ctx,
          query,
          joinShape,
          key,
          joinAs,
        )} = ${rawOrColumnToSql(ctx, query, value, quotedAs, shape)}`,
      );
    }

    return pairs.join(', ');
  }
};

export const pushJoinSql = (
  ctx: ToSQLCtx,
  table: ToSQLQuery,
  query: QueryData & {
    join: JoinItem[];
  },
  quotedAs?: string,
) => {
  const joinSet = query.join.length > 1 ? new Set<string>() : null;

  for (const item of query.join) {
    const { target, on = 'true' } = processJoinItem(
      ctx,
      table,
      query,
      item.args,
      quotedAs,
    );

    const sql = `${item.type} ${target} ON ${on}`;

    if (joinSet) {
      if (joinSet.has(sql)) continue;
      joinSet.add(sql);
    }

    ctx.sql.push(sql);
  }
};

const skipQueryKeysForSubQuery: RecordBoolean = {
  adapter: true,
  updateData: true,
  parsers: true,
  as: true,
  and: true,
  or: true,
  returnType: true,
  joinedShapes: true,
  returnsOne: true,
  aliases: true,
  defaults: true,
  transform: true,
};

export const getIsJoinSubQuery = (query: PickQueryQAndBaseQuery) => {
  const {
    q,
    baseQuery: { q: baseQ },
  } = query;
  for (const key in q) {
    if (
      !skipQueryKeysForSubQuery[key] &&
      (q as never as RecordUnknown)[key] !==
        (baseQ as never as RecordUnknown)[key]
    ) {
      return true;
    }
  }
  return false;
};
