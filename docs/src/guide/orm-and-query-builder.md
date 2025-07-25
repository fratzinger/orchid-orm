---
outline: deep
---

# ORM and query builder

`OrchidORM` consists of a query builder (such as [Knex](https://knexjs.org/) or [Kysely](https://www.kysely.dev/docs/intro)) + layer on top of it for defining, querying and utilizing relations (as in [Prisma](https://www.prisma.io/docs/concepts/components/prisma-schema/relations)).

The query builder is for building and executing SQL queries, such as `select`, `create`, `update`, and `delete`.

ORM allows defining `belongsTo`, `hasMany` and [other relations](/guide/relations), select and join them, create/update/delete records together with their related records and [more](/guide/relation-queries).

## setup

Install by running:

```sh
npm i orchid-orm
# or
pnpm i orchid-orm
```

`orchidORM` is an entry function of the ORM.

The first argument is a connection options object, the ORM-specific options are described below,
see also options for a `pg` adapter that could be passed via the same object: [client options](https://node-postgres.com/api/client) + [pool options](https://node-postgres.com/api/pool).

The second argument is an object where keys are names and values are table classes (see next section for defining a table class).

Returns an instance with tables and some specific functions prefixed with a `$` sign to not overlap with your tables.

```ts
import { orchidORM } from 'orchid-orm';

// import all tables
import { UserTable } from './tables/user';
import { MessageTable } from './tables/message';

export const db = orchidORM(
  {
    // details for databaseURL are below
    databaseURL: process.env.DATABASE_URL,

    // ssl and schema can be set here or as databaseURL parameters:
    ssl: true,
    schema: 'my_schema',

    // retry connecting when db is starting up, no retry by default,
    // see `connectRetry` section below
    connectRetry: true,

    // option for logging, false by default
    log: true,

    // automatically create foreign keys for relations
    // see `autoForeignKeys` section below
    autoForeignKeys: true,

    // option to create named prepared statements implicitly, false by default
    autoPreparedStatements: true,
  },
  {
    user: UserTable,
    message: MessageTable,
  },
);
```

If needed, you can pass `Adapter` instance instead of connection options:

```ts
import { orchidORM, Adapter } from 'orchid-orm';

export const db = orchidORM(
  {
    adapter: new Adapter({ databaseURL: process.env.DATABASE_URL }),
    log: true,
  },
  {
    // ...tables
  },
);
```

## define a base table

Define a base table class to extend from, this code should be separated from the `db` file:

```ts
import { createBaseTable } from 'orchid-orm';

export const BaseTable = createBaseTable();

export const { sql } = BaseTable;
```

`sql` is exported here because this way it can be linked with custom columns defined in the `BaseTable`.

Optionally, you can customize column types behavior here for all future tables:

```ts
import { createBaseTable } from 'orchid-orm';
// optionally, use one of the following validation integrations:
import { zodSchemaConfig } from 'orchid-orm-schema-to-zod';
import { valibotSchemaConfig } from 'orchid-orm-valibot';

export const BaseTable = createBaseTable({
  // set to true if columns in database are in snake_case
  snakeCase: true,

  // optional, but recommended: derive and use validation schemas from your tables
  schemaConfig: zodSchemaConfig,
  // or
  schemaConfig: valibotSchemaConfig,

  columnTypes: (t) => ({
    // by default timestamp is returned as a string, override to a Data
    timestamp: () => t.timestamp().asDate(),

    // define custom types in one place inside BaseTable to use them later in tables
    myEnum: () => t.enum('myEnum', ['one', 'two', 'three']),
  }),
});

export const { sql } = BaseTable;
```

See [override column types](/guide/columns-overview#override-column-types) for details of customizing columns.

Tables are defined as classes `table` and `columns` required properties:

`table` is a table name and `columns` is for defining table column types (see [Columns schema](/guide/columns-overview) document for details).

Note that the `table` property is marked as `readonly`, this is needed for TypeScript to check the usage of the table in queries.

```ts
import { Selectable, DefaultSelect, Insertable, Updatable } from 'orchid-orm';
// import BaseTable from a file from the previous step:
import { BaseTable } from './baseTable';

// export types of User for various use-cases:
export type User = Selectable<UserTable>;
export type UserDefault = DefaultSelect<UserTable>;
export type UserNew = Insertable<UserTable>;
export type UserUpdate = Updateable<UserTable>;

export class UserTable extends BaseTable {
  readonly table = 'user';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    name: t.string(),
    password: t.string(),
    ...t.timestamps(),
  }));
}
```

After defining the table place it in the main `db` file as in [setup](#setup) step:

```ts
import { UserTable } from './tables/user';

export const db = orchidORM(
  {
    databaseURL: process.env.DATABASE_URL,
  },
  {
    user: UserTable,
  },
);
```

And now it's available for querying:

```ts
import { db } from './db';

const user = await db.user.findBy({ name: 'John' });
```

Don't use table classes directly, this won't work:

```ts
// error
await UserTable.findBy({ name: 'John' });
```

`snakeCase` can be overridden for a table:

```ts
import { BaseTable } from './baseTable';

export class SnakeCaseTable extends BaseTable {
  readonly table = 'table';
  // override snakeCase:
  snakeCase = true;
  columns = this.setColumns((t) => ({
    // snake_column in db
    snakeColumn: t.text(),
  }));
}
```

## define a table class

Table classes are similar to Models or Entities in other ORMs.
The key difference is that Model/Entity is meant to also contain business logic,
while a table in OrchidORM is only meant for configuring a database table columns, relations, allows to define [softDelete](/guide/orm-and-query-builder#softdelete),
query [hooks](/guide/hooks#lifecycle-hooks) (aka callbacks), so to define the database table and querying specifics, but not for app's logic.

```ts
import { BaseTable, sql } from './baseTable';
import { PostTable } from './post.table';
import { SubscriptionTable } from './subscription.table';

export class UserTable extends BaseTable {
  schema = 'customSchema';
  readonly table = 'user';

  // The comment will be persisted to database's table metadata.
  comment = 'this is a table for storing users';

  // If you don't define a primary key, OrchidORM will remind you about it with an error,
  // Set `noPrimaryKey = true` if you really want a table without a primary key.
  noPrimaryKey = true;

  // You can set `snakeCase` for all tables in the `BaseTable`,
  // or you can enable it for an individual table.
  snakeCase = true;

  // For full text search: 'english' is the default, you can set it to other langauge
  language = 'spanish';

  // For "soft delete" functionality
  readonly softDelete = true; // or a string with a column name

  columns = this.setColumns(
    (t) => ({
      id: t.uuid().primaryKey(),
      firstName: t.string(),
      lastName: t.string(),
      username: t.string().unique(),
      email: t.string().email().unique(),
      deletedAt: t.timestamp().nullable(),
      subscriptionProvider: t.enum('paymentProvider', ['stripe', 'paypal']),
      subscriptionId: t.uuid(),
      startDate: t.timestamp(),
      endDate: t.timestamp(),
      ...t.timestamps(),
    }),
    // The second function is optional, it is for composite primary keys, indexes, etc.
    // For a single thing no need to wrap it in array:
    // (t) => t.index(['role', 'deletedAt']),
    // For multiple things, return array:
    (t) => [
      // composite primary key
      t.primaryKey(['firstName', 'lastName']),
      // composite unique index
      t.unique(['subscriptionProvider', 'subscriptionId']),
      // composite foreign key
      t.foreignKey(
        ['subscriptionProvider', 'subscriptionId'],
        () => SubscriptionTable,
        ['provider', 'id'],
      ),
      // postgres `EXCLUDE` constraint: do not let the timeranges of different rows to overlap
      t.exclude([
        { expression: `tstzrange("startDate", "endDate")`, with: '&&' },
      ]),
      // database-level check
      t.check(sql`username != email`),
    ],
  );

  // To define "virtual" columns that will be computed on a database side with a custom SQL
  computed = this.setComputed({
    fullName: (q) =>
      sql`${q.column('firstName')} || ' ' || ${q.column('lastName')}`.type(
        (t) => t.string(),
      ),
  });

  // The `defaut` scope will be applied to all queries,
  // you can define additional scopes to use them when building queries.
  scopes = this.setScopes({
    default: (q) => q.where({ hidden: false }),
    active: (q) => q.where({ active: true }),
  });

  relations = {
    posts: this.hasMany(() => PostTable, {
      columns: ['id'],
      references: ['authorId'],
    }),
  };
}
```

- `table` and `softDelete` must be readonly for TS to recognize them properly, other properties don't have to be readonly.
- for configuring columns see [Columns schema overview](/guide/columns-overview).
- documentation for composite primary keys, indexes, exclusions, foreign keys, is residing in [migration column methods](/guide/migration-column-methods)
- for defining table's relations see [Modeling relations](/guide/relations).
- check out [soft delete](/guide/orm-and-query-builder#softdelete)
- for `computed` see [Computed columns](/guide/orm-and-query-builder#computed-columns).
- for `scopes` see [Scopes](/guide/orm-and-query-builder#scopes).

All table files must be linked into `orchidORM` instance, as was shown above in the [setup](#setup) section.

When trying OrchidORM on an existing project that already has a database with tables,
you can run a command to generate code for tables and a migration for it by running [db pull](/guide/migration-commands#pull).

## generate migrations

After defining, modifying, or deleting tables or columns in the app code,
run `db g` command to generate corresponding migration:

```shell
npm run db g
# or
pnpm db g
```

Optionally, provide a migration file name:

```shell
pnpm db g create-some-tables
```

It automatically calls `db up` to apply existing migrations when it starts.

Pass `up` argument if you'd like to apply the migration right after it generates:

```shell
pnpm db g create-some-tables up

# or, with a default "generated" file name
pnpm db g up
```

:::warning
Use this approach **only** if is the database can be fully managed by your application.

This tool will drop all database entities (schemas, tables, etc.) that aren't referenced by your application's code.
:::

This tool will automatically write a migration to create, drop, change, rename database items.

When you're renaming a table, column, enum, or a schema in the code, it will interactively ask via the terminal whether you want to create a new item or to rename the old one.
Such as when renaming a column, you may choose to drop the old one and create a new (data will be lost), or to rename the existing (data is preserved).

If you don't set a custom constraint name for indexes, primary keys, foreign keys, exclude constraints, they have a default name such as `table_pkey`, `table_column_idx`, `table_someId_fkey`, `table_column_exclude`.
When renaming a table, the table primary key will be also renamed. When renaming a column, its index or foreign key will be renamed as well.

The tool handles migration generation for
tables, columns, schemas, enums, primary keys, foreign keys, indexes, database checks, exclude constraints, extensions, domain types.

Please let me know by opening an issue if you'd like to have a support for additional database features such as views, triggers, procedures.

### generatorIgnore

`db g` command attempts to drop all the database entities that it cannot find in the code.

Use `generatorIgnore` option to preserve db entities that are needed but not reflected in the code.
Such as when using certain extensions, or libraries, they can create schemas, tables, types, etc.

Ignoring a schema also ignores all its tables, domains, enums.

```ts
export const db = orchidORM(
  {
    databaseURL: process.env.DATABASE_URL,
    extensions: ['postgis'],
    generatorIgnore: {
      // pgboss library keeps all its db objects in the `pgboss` schema.
      schemas: ['pgboss'],
      // spatial_ref_sys is automatically created by postgis
      tables: ['spatial_ref_sys'],
      // you can ignore individual enums, domains, extensions.
      enums: [],
      domains: [],
      extensions: [],
    },
  },
  { ...tables },
);
```

## Postgres extensions

To enable a postgres extension such as `citext`, list it in the `extensions` config in the `orchidORM` call:

```ts
export const db = orchidORM(
  {
    databaseURL: process.env.DATABASE_URL,
    extensions: [
      // just the extension name for a recent version
      'citext',

      // you can specify a certain version
      { citext: '1.2.3' },

      // define extension only for specific schema:
      'mySchema.citext',
    ],
  },
  { ...tables },
);
```

Run the migration generator (`npm run g`) and apply the migration (`npm run db up`).

## Postgres domains

Domain is a custom database type that is based on other type and can include `NOT NULL` and a `CHECK` (see [postgres tutorial](https://www.postgresqltutorial.com/postgresql-tutorial/postgresql-user-defined-data-types/)).

Define a domain as follows for the migration generator to write a corresponding migration:

```ts
import { sql } from './baseTable';

export const db = orchidORM(
  {
    databaseURL: process.env.DATABASE_URL,
    domains: {
      domainName: (t) =>
        t
          .integer()
          .nullable()
          .check(sql`VALUE = 69`),

      // domain residing in a certain schema:
      'mySchema.domainName': (t) => t.integer().default(123),
    },
  },
  { ...tables },
);
```

## table utility types

### Selectable

`Selectable` represents a record type returned from a database and parsed with [column parsers](/guide/common-column-methods#parse).

For instance, when using `asDate` for a [timestamp](/guide/columns-types#date-and-time) column, `Selectable` will have `Date` type for this column.

It contains all the columns including the ones marked with [select(false)](/guide/common-column-methods.html#exclude-from-select),
as well as [Computed columns](/guide/computed-columns).

```ts
import { Selectable } from 'orchid-orm';

export type User = Selectable<UserTable>;
```

### DefaultSelect

`DefaultSelect` is for table types returned from a database, with respect for column parsers, limited only to columns selected by default.

It does not include [select(false)](/guide/common-column-methods.html#exclude-from-select) columns, as well as [Computed columns](/guide/computed-columns).

```ts
import { DefaultSelect } from 'orchid-orm';

export type UserDefault = DefaultSelect<UserTable>;
```

### Insertable

`Insertable` types an object you can create a new record with.

Column type may be changed by [encode](/guide/common-column-methods#encode) function.

`Insertable` type for timestamp column is a union `string | number | Date`.

```ts
import { Insertable } from 'orchid-orm';

export type UserNew = Insertable<UserTable>;
```

### Updatable

`Updatable` is the same as `Insertable` but all fields are optional.

```ts
import { Updatable } from 'orchid-orm';

export type UserUpdate = Updatable<UserTable>;
```

### Queryable

`Queryable`: disregarding if [parse](/guide/common-column-methods#parse) or [encode](/guide/common-column-methods#encode) functions are specified for the column,
types that are accepted by `where` and other query methods remains the same.

Use this type to accept data for querying a table.

```ts
import { Queryable } from 'orchid-orm';

export type UserQueryable = Queryable<UserTable>;
```

## createDb

[//]: # 'has JSDoc'

If you'd like to use the query builder of OrchidORM as a standalone tool, install `pqb` package and use `createDb` to initialize it.

As `Orchid ORM` focuses on ORM usage, docs examples mostly demonstrates how to work with ORM-defined tables,
but everything that's not related to table relations should also work with `pqb` query builder on its own.

It is accepting the same options as `orchidORM` + options of `createBaseTable`:

```ts
import { createDb } from 'orchid-orm';

import { zodSchemaConfig } from 'orchid-orm-schema-to-zod';
// or
import { SchemaConfig } from 'orchid-orm-valibot';

const db = createDb({
  // db connection options
  databaseURL: process.env.DATABASE_URL,
  log: true,

  // columns in db are in snake case:
  snakeCase: true,

  // override default SQL for timestamp, see `nowSQL` above
  nowSQL: `now() AT TIME ZONE 'UTC'`,

  // optional, but recommended: makes zod schemas for your tables
  schemaConfig: zodSchemaConfig,
  // or
  schemaConfig: valibotSchemaConfig,

  // override column types:
  columnTypes: (t) => ({
    // by default timestamp is returned as a string, override to a number
    timestamp: () => t.timestamp().asNumber(),
  }),
});
```

After `db` is defined, construct queryable tables in such way:

```ts
export const User = db('user', (t) => ({
  id: t.identity().primaryKey(),
  name: t.string(),
  password: t.string(),
  age: t.integer().nullable(),
  ...t.timestamps(),
}));
```

Now the `User` can be used for making type-safe queries:

```ts
const users = await User.select('id', 'name') // only known columns are allowed
  .where({ age: { gte: 20 } }) // gte is available only on the numeric field, and the only number is allowed
  .order({ createdAt: 'DESC' }) // type safe as well
  .limit(10);

// users array has a proper type of Array<{ id: number, name: string }>
```

The optional third argument is for table options:

```ts
const Table = db('table', (t) => ({ ...columns }), {
  // provide this value if the table belongs to a specific database schema:
  schema: 'customTableSchema',
  // override `log` option of `createDb`:
  log: true, // boolean or object described `createdDb` section
  logger: { ... }, // override logger
  noPrimaryKey: 'ignore', // override noPrimaryKey
  snakeCase: true, // override snakeCase
})
```

## databaseURL option

`databaseURL` has the following format:

```
postgres://user:password@localhost:5432/dbname
```

`schema` and `ssl` option can be specified as a parameter:

```
postgres://user:password@localhost:5432/dbname?schema=my_schema&ssl=true
```

If `schema` is set and is different from `public`,
the `SET search_path = schema` query will be performed before the first query run per each database connection.

## snakeCase option

By default, all column names are expected to be named in camelCase.

If only some columns are named in snake_case, you can use `name` method to indicate it:

```ts
import { BaseTable } from './baseTable';

class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    camelCase: t.integer(),
    snakeCase: t.name('snake_case').integer(),
  }));
}

// all columns are available by a camelCase name,
// even though `snakeCase` has a diferent name in the database
const records = await table.select('camelCase', 'snakeCase');
```

Set `snakeCase` to `true` if you want all columns to be translated automatically into a snake_case.

Column name can still be overridden with a `name` method.

```ts
import { createBaseTable } from 'orchid-orm';

export const BaseTable = createBaseTable({
  snakeCase: true,
});

class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    // camelCase column requires an explicit name
    camelCase: t.name('camelCase').integer(),
    // snakeCase is snakerized automatically when generating SQL
    snakeCase: t.integer(),
  }));
}

// result is the same as before
const records = await table.select('camelCase', 'snakeCase');
```

## log option

The `log` option is false by default, `true` or custom object can be provided:

```ts
type LogOption = {
  // for colorful log, true by default
  colors?: boolean;

  // callback to run before query
  // Query is a query object, sql is { text: string, values: unknown[] }
  // returned value will be passed to afterQuery and onError
  beforeQuery?(sql: Sql): unknown;

  // callback to run after query, logData is data returned by beforeQuery
  afterQuery?(sql: Sql, logData: unknown): void;

  // callback to run in case of error
  onError?(error: Error, sql: Sql, logData: unknown): void;
};
```

The log will use `console.log` and `console.error` by default, it can be overridden by passing the `logger` option:

```ts
export const db = orchidORM(
  {
    databaseURL: process.env.DATABASE_URL,
    log: true,
    logger: {
      log(message: string): void {
        // ...
      },
      error(message: string): void {
        // ...
      },
    },
  },
  {
    // ...tables
  },
);
```

## autoForeignKeys

In general, it's a good practice to always define database-level foreign keys between related tables,
so the database guarantees data integrity, and a record cannot mistakenly have an id of a record that does not exist.

Adding `autoForeignKeys: true` option to `createBaseTable` will automatically generate foreign keys based on defined relations (in the case you're using migration generator).

You can provide foreign key options instead of `true` to be used by all auto-generated foreign keys.

```ts
import { createBaseTable } from 'orchid-orm';

export const BaseTable = createBaseTable({
  autoForeignKeys: true, // with default options

  // or, you can provide custom options
  autoForeignKeys: {
    // all fields are optional
    match: 'FULL', // 'SIMPLE' by default, can be 'FULL', 'PARTIAL', 'SIMPLE'.
    onUpdate: 'CASCADE', // 'NO ACTION' by default, can be 'NO ACTION', 'RESTRICT', 'CASCADE', 'SET NULL', 'SET DEFAULT'.
    onDelete: 'CASCADE', // same as `onUpdate`.
    dropMode: 'CASCADE', // for the down migration, 'RESTRICT' is the default, can be 'CASCADE' or 'RESTRICT'.
  },
});
```

When this is enabled, you can disable it for a specific table.
And when this is disabled globally, you can enable it only for a specific table in the same way.

```ts
import { BaseTable } from './baseTable';

export class MyTable extends BaseTable {
  autoForeignKey = false; // disable only for this table
  autoForeignKey = { onUpdate: 'RESTRICT' }; // or, override options only for this table
}
```

Auto foreign keys can also be enabled, disabled, overridden for a concrete relation:

```ts
import { BaseTable } from './baseTable';

export class MyTable extends BaseTable {
  relations = {
    btRel: this.belongsTo(() => OtherTable, {
      columns: ['otherId'],
      references: ['id'],

      // disable for this relation
      foreignKey: false,
      // or, customize options for this relation
      foreignKey: {
        onUpdate: 'RESTRICT',
      },
    }),

    habtmRel: this.hasAndBelongsToMany(() => OtherTable, {
      columns: ['id'],
      references: ['myId'],

      // disable foreign key from the join table to this table
      foreignKey: false,

      through: {
        table: 'joinTable',
        columns: ['otherId'],
        references: ['id'],

        // customize foreign key from the join table to the other table
        foreignKey: {
          onUpdate: 'RESTRICT',
        },
      },
    }),
  };
}
```

## connectRetry

[//]: # 'has JSDoc'

This option may be useful in CI when database container has started, CI starts performing next steps,
migrations begin to apply though database may be not fully ready for connections yet.

Set `connectRetry: true` for the default backoff strategy. It performs 10 attempts starting with 50ms delay and increases delay exponentially according to this formula:

```
(factor, defaults to 1.5) ** (currentAttempt - 1) * (delay, defaults to 50)
```

So the 2nd attempt will happen in 50ms from start, 3rd attempt in 125ms, 3rd in 237ms, and so on.

You can customize max attempts to be made, `factor` multiplier and the starting delay by passing:

```ts
const options = {
  databaseURL: process.env.DATABASE_URL,
  connectRetry: {
    attempts: 15, // max attempts
    strategy: {
      delay: 100, // initial delay
      factor: 2, // multiplier for the formula above
    }
  }
};

rakeDb(options, { ... });
```

You can pass a custom function to `strategy` to customize delay behavior:

```ts
import { setTimeout } from 'timers/promises';

const options = {
  databaseURL: process.env.DATABASE_URL,
  connectRetry: {
    attempts: 5,
    stragegy(currentAttempt: number, maxAttempts: number) {
      // linear: wait 100ms after 1st attempt, then 200m after 2nd, and so on.
      return setTimeout(currentAttempt * 100);
    },
  },
};
```

## nowSQL option

For the specific case you can use `nowSQL` option to specify SQL to override the default value of `timestamps()` method.

If you're using `timestamp` and not `timestampNoTZ` there is no problem,
or if you're using `timestampNoTZ` in a database where time zone is UTC there is also no problem,
but if you're using `timestampNoTZ` in a database with a different time zone,
and you still want `updatedAt` and `createdAt` columns to automatically be saved with a current time in UTC,
you can specify the `nowSQL` for the base table:

```ts
import { createBaseTable } from 'orchid-orm';

export const BaseTable = createBaseTable({
  nowSQL: `now() AT TIME ZONE 'UTC'`,

  // ...other options
});
```

This value is used:

- for `updatedAt` column when updating a record
- for the default value `updatedAt` and `createdAt` columns in a database, applied in the migrations

It's required to specify a `baseTable` parameter of `rakeDb` to make it work in the migrations.

By default, `Orchid ORM` is using `now()` for a timestamp value of `updatedAt` and `createdAt`, in the example above we
override it to `now() AT TIME ZONE 'UTC'` so it produces UTC timestamp for `timestampNoTZ` columns even in database in different time zone.

## autoPreparedStatements option

This option was meant to speed up the queries, but benchmarks cannot prove this, so simply ignore this option for now.

`pg` node module used under the hood is performing "unnamed" prepared statements by default ([link](https://www.postgresql.org/docs/current/protocol-flow.html#PROTOCOL-FLOW-EXT-QUERY) to Postgres details about this).

When the option is set to `true`, the query builder will generate a name for each different query to make the statement named.

## noPrimaryKey

All tables should have a primary key. Even if it is a join table, it should have a composite primary key consisting of foreign key columns.

If you forgot to define a primary key, ORM will send a friendly remained by throwing an error.

Disable the check for a specific table by setting `noPrimaryKey` property:

```ts
import { BaseTable } from './baseTable';

export class NoPrimaryKeyTable extends BaseTable {
  readonly table = 'table';
  noPrimaryKey = true; // set to `true` to ignore absence of primary key
  columns = this.setColumns((t) => ({
    // ...no primary key defined
  }));
}
```

Or, you can override this behavior for all tables by placing `noPrimaryKey` option into `orchidORM` config:

`ignore` will disable the check, `warning` will print a warning instead of throwing error.

```ts
// ignore absence of primary keys for all tables
const db = orchidORM(
  {
    databaseURL: process.env.DATABASE_URL,
    noPrimaryKey: 'ignore',
  },
  {
    // ...tables
  },
);

// print a warning for all tables without primary key
const db2 = orchidORM(
  {
    databaseURL: process.env.DATABASE_URL,
    noPrimaryKey: 'warning',
  },
  {
    // ...tables
  },
);
```

## softDelete

[//]: # 'has JSDoc'

`softDelete` configures the table to set `deletedAt` to current time instead of deleting records.
All queries on such table will filter out deleted records by default.

```ts
import { BaseTable } from './baseTable';

export class SomeTable extends BaseTable {
  readonly table = 'some';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    deletedAt: t.timestamp().nullable(),
  }));

  // true is for using `deletedAt` column
  readonly softDelete = true;
  // or provide a different column name
  readonly softDelete = 'myDeletedAt';
}

const db = orchidORM(
  { databaseURL: '...' },
  {
    someTable: SomeTable,
  },
);

// deleted records are ignored by default
const onlyNonDeleted = await db.someTable;
```

`includeDeleted` disables the default `deletedAt` filter:

```ts
const allRecords = await db.someTable.includeDeleted();
```

`delete` behavior is altered:

```ts
await db.someTable.find(1).delete();
// is equivalent to:
await db.someTable.find(1).update({ deletedAt: sql`now()` });
```

`hardDelete` deletes records bypassing the `softDelete` behavior:

```ts
await db.someTable.find(1).hardDelete();
```

## scopes

[//]: # 'has JSDoc'

This feature allows defining a set of query modifiers to use it later.
Only [where conditions](/guide/where) can be set in a scope.
If you define a scope with name `default`, it will be applied for all table queries by default.

```ts
import { BaseTable } from './baseTable';

export class SomeTable extends BaseTable {
  readonly table = 'some';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    hidden: t.boolean(),
    active: t.boolean(),
  }));

  scopes = this.setScopes({
    default: (q) => q.where({ hidden: false }),
    active: (q) => q.where({ active: true }),
  });
}

const db = orchidORM(
  { databaseURL: '...' },
  {
    some: SomeTable,
  },
);

// the default scope is applied for all queries:
const nonHiddenRecords = await db.some;
```

### scope

[//]: # 'has JSDoc'

Use the `scope` method to apply a pre-defined scope.

```ts
// use the `active` scope that is defined in the table:
await db.some.scope('active');
```

### unscope

[//]: # 'has JSDoc'

Remove conditions that were added by the scope from the query.

```ts
// SomeTable has a default scope, ignore it for this query:
await db.some.unscope('default');
```

## computed columns

[//]: # 'has JSDoc'

```ts
import { BaseTable, sql } from './baseTable';

export class UserTable extends BaseTable {
  readonly table = 'user';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    firstName: t.string(),
    lastName: t.string(),
  }));

  computed = this.setComputed({
    fullName: () =>
      sql`${q.column('firstName')} || ' ' || ${q.column('lastName')}`.type(
        (t) => t.string(),
      ),
  });
}
```

`setComputed` takes an object where keys are computed column names, and values are functions returning raw SQL.

Use `q.column` as shown above to reference a table column, it will be prefixed with a correct table name even if the table is joined under a different name.

Computed columns are not selected by default, only on demand:

```ts
const a = await db.user.take();
a.fullName; // not selected

const b = await db.user.select('*', 'fullName');
b.fullName; // selected

// Table post belongs to user as an author.
// it's possible to select joined computed column:
const posts = await db.post
  .join('author')
  .select('post.title', 'author.fullName');
```

SQL query can be generated dynamically based on the current request context.

Imagine we are using [AsyncLocalStorage](https://nodejs.org/api/async_context.html#asynchronous-context-tracking)
to keep track of current user's language.

And we have articles translated to different languages, each article has `title_en`, `title_uk`, `title_be` and so on.

We can define a computed `title` by passing a function into `sql` method:

```ts
import { sql } from './baseTable';

type Locale = 'en' | 'uk' | 'be';
const asyncLanguageStorage = new AsyncLocalStorage<Locale>();
const defaultLocale: Locale = 'en';

export class ArticleTable extends BaseTable {
  readonly table = 'article';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    title_en: t.text(),
    title_uk: t.text().nullable(),
    title_be: t.text().nullable(),
  }));

  computed = this.setComputed({
    title: () =>
      // `sql` accepts a callback to generate a new query on every run
      sql(() => {
        // get locale dynamically based on current storage value
        const locale = asyncLanguageStorage.getStore() || defaultLocale;

        // use COALESCE in case when localized title is NULL, use title_en
        return sql`COALESCE(
            ${q.column(`title_${locale}`)},
            ${q.column(`title_${defaultLocale}`)}
          )`;
      }).type((t) => t.text()),
  });
}
```

## $query

Use `$query` to perform raw SQL queries.

```ts
const value = 1;

// it is safe to interpolate inside the backticks (``):
const result = await db.$query<{ one: number }>`SELECT ${value} AS one`;
// data is inside `rows` array:
result.rows[0].one;
```

If the query is executing inside a transaction, it will use the transaction connection automatically.

```ts
await db.$transaction(async () => {
  // both queries will execute in the same transaction
  await db.$query`SELECT 1`;
  await db.$query`SELECT 2`;
});
```

Alternatively, provide a raw SQL object created with the `sql` function:

```ts
import { sql } from './baseTable';

// it is NOT safe to interpolate inside a simple string, use `values` to pass the values.
const result = await db.$query<{ one: number }>(
  sql({
    raw: 'SELECT $value AS one',
    values: {
      value: 123,
    },
  }),
);

// data is inside `rows` array:
result.rows[0].one;
```

### $query.records

Returns an array of records:

```ts
const array: T[] = await db.$query.records<T>`SELECT * FROM table`;
```

### $query.take

Returns a single record, throws [NotFoundError](/guide/error-handling) if not found.

```ts
const one: T = await db.$query.take<T>`SELECT * FROM table LIMIT 1`;
```

### $query.takeOptional

Returns a single record or `undefined` when not found.

```ts
const maybeOne: T | undefined = await db.$query
  .takeOptional<T>`SELECT * FROM table LIMIT 1`;
```

### $query.rows

Returns array of tuples of the values:

```ts
const arrayOfTuples: [number, string][] = await db.$query.rows<
  [number, string]
>`SELECT id, name FROM table`;
```

### $query.pluck

Returns a flat array of values for a single column:

```ts
const strings: string[] = await db.$query.pluck<string>`SELECT name FROM table`;
```

### $query.get

Returns a single value, throws [NotFoundError](/guide/error-handling) if not found.

```ts
const value: number = await db.$query.get<number>`SELECT 1`;
```

### $query.getOptional

Returns a single value or `undefined` when not found.

```ts
const value: number | undefined = await db.$query.getOptional<number>`SELECT 1`;
```

## $queryArrays

Performs a SQL query, returns a db result with array of arrays instead of objects:

```ts
const value = 1;

// it is safe to interpolate inside the backticks (``):
const result = await db.$queryArrays<[number]>`SELECT ${value} AS one`;
// `rows` is an array of arrays:
const row = result.rows[0];
row[0]; // our value
```

## $from

Use `$from` to build a queries around sub queries similar to the following:

```ts
const subQuery = db.someTable.select('name', {
  relatedCount: (q) => q.related.count(),
});

const result = await db
  .$from(subQuery)
  .where({ relatedCount: { gte: 5 } })
  .limit(10);
```

It is the same [from](/guide/query-methods#from) method as available in the query builder, it also can accept multiple sources.

## $close

Call `$clone` to end a database connection:

```ts
await db.$close();
```

For a standalone query builder, the method is `close`.
