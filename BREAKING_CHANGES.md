# Breaking changes

## orchid-orm 1.51

Rename `db.$queryBuilder` to `db.$qb` for conciseness.

## orchid-orm 1.50

`afterCommit` hooks used to be awaited when awaiting a transaction or a query,
now they become detached, won't be awaited by the main flow.
Make sure to handle their errors inside the hooks or by using `catchAfterCommitError`,
without error handling the hooks will cause unhandled exception errors.

## orchid-orm-schema-to-zod 1.0.0

Upgrade to use zod v4 from v3.25.42 zod package.

`string().ip()` was changed to `string().ipv4()` and `string().ipv6()`.

Other than that, no visible changes in the integration with OrchidORM.

Error messages thrown by Zod were changed.

I can confirm types became more lightweight after this upgrade.

## orchid-orm 1.48

`chain` is re-implemented, see the documentation.

Previously it was relying on `WHERE EXISTS` statement,
did not support selecting columns of the table prior to the `chain`,
did not support filtering by that table, ordering by its columns.

Now it is implemented with `JOIN`, sub-queries, and a hacky `row_number` for de-duplication.
Supports selecting and filtering by columns of the table prior to the `chain`.
Unlike a simple `join` method, it guarantees de-duplication: only unique records are returned,
even when chaining over many-to-many relations.

## orchid-orm 1.47

In sub queries, a single not found record was returned as `null` despite having a type `X | undefined`,
now it is returned as `undefined`.

```ts
const obj = db.table.select({
  thing: (q) => q.relatedThing,
});

obj.thing; // is undefined in both TS and runtime
```

## orchid-orm 1.46

`belongsTo` and `hasOne` relations in a sub-query when chained were incorrectly returning an array of records.
This will return a single record from now.

```ts
// comment belongs to post, post belongs to author.
const result = await db.comment
  .select({
    postAuthor: (q) => q.post.chain('author'),
  })
  .take();

// it was an array, becomes a single record
result.postAuthor;
```

## orchid-orm 1.44

Change `Selectable` type utility to include hidden columns (`select(false)`) and computed columns.

Use `DefaultSelect` instead to have only columns selected by default.

## orchid-orm 1.43

Column's `encode` previously did handle `null` values, this wasn't intentional.
You can use `default(() => value)` to impose a runtime default value instead.

## orchid-orm 1.42

`take`, `find`, `findBySql`, `findBy`: previously, these always changed return type to return a single record and throw if not found.

Now, these methods won't have an effect on `get`, `pluck`, `exec` results.
`getOptional().take()` becomes an equivalent to `get()`.

```ts
// equivalent:
db.table.getOptional('id').take();
db.table.get('id');

// no effect:
db.table.get('id').take();
db.table.pluck('id').take();
db.table.exec().take();
// same as:
db.table.get('id');
db.table.pluck('id');
db.table.exec();
```

`takeOptional`, `findOptional`, `findBySqlOptional`, `findByOptional`: previously, these always changed return type to return a single record or undefined if not found.

Now, `getOptional`, `pluck`, `exec` results are preserved.
`get().takeOptional()` becomes an equivalent to `getOptional()`.

```ts
// equivalent:
db.table.get('id').takeOptional();
db.table.getOptional('id');

// no effect:
db.table.getOptional('id').takeOptional();
db.table.pluck('id').takeOptional();
db.table.exec().takeOptional();
// same as:
db.table.getOptional('id');
db.table.pluck('id');
db.table.exec();
```

## orchid-orm 1.40

Previously, `modify` could accept an arbitrary function.

Now, it only accepts functions created with `db.table.makeHelper`.

And now it can accept arguments.

## orchid-orm 1.39

Due to type collisions with `unknown` typed json columns, it's no longer supported to use sub-queries in `update` in this way:

```ts
await db.table.find(1).update({
  // No longer supported:
  column: db.someTable.get('value'),
});
```

Instead, return the sub-query from a function:

```ts
await db.table.find(1).update({
  // This way is supported:
  column: () => db.someTable.get('value'),
});
```

## orchid-orm 1.38

`group` was giving precedence to the table columns over selected values.

Now selected values will take precedence over table columns in `group`.

So if the table has `id` column, and there is a custom select aliased as `id`, the `group` will reference the selected value.

## orchid-orm-test-factory 1.0

Now test factories work disregarding if and which one validation library you're using with OrchidORM.
It no longer depends on `zod`.

Added a peer dependency on `faker`, so need to install this library together with `faker`:

```shell
npm i -D orchid-orm-test-factory @faker-js/faker
```

Usability is almost unchanged, except that now JSON data won't be generated automatically,
and you need to additionally configure how to generate it.
See details in [these docs](https://orchid-orm.netlify.app/guide/test-factories.html#json).

## orchid-orm 1.37

Previously, you could chain relations in a such way:

```ts
// load books of an author
const books = await db.author.take().books;
```

But if the relation is named `order`, it was causing a naming conflict:

```ts
// load an order of an order item
const order = await db.orderItem.take().order; // order here refers to SQL `ORDER BY`
```

To resolve the naming conflict, such a chaining as shown above is no longer available.

Use `queryRelated` to load related data for a previously loaded record:

```ts
const author = await db.author.find(1);
const books = await db.author.queryRelated('books', author);
```

Use `chain` to load related data based on a query:

```ts
const books = await db.author.find(1).chain('books');
```

In `select` and other query callbacks, you can still refer to relations as before:

```ts
await db.author.select({
  // load all author books
  books: (q) => q.books,
});
```

In the case you need to load a two or more levels deep relation, use `chain`:

```ts
await db.author.select({
  // load all reviews for all author books
  booksReviews: (q) => q.books.chain('reviews'),
});
```

## orchid-orm 1.36

Stop handling null in column `parse`, add `parseNull` for this instead.

Update your column `parse` to not handle null where it is just returning nulls as they come in,
and add separate `parseNull` ([docs](https://orchid-orm.netlify.app/guide/common-column-methods.html#parsenull)) to return a default value.

## orchid-orm 1.35

Empty select `select()` was selecting a full record, and from now will select an empty record.

## orchid-orm 1.34

Previously, input for `startWith`, `contains`, `endsWith`, and case-sensitive versions was not escaped.

It becomes escaped now.

`db.table.where({ title: { contains: '100%' } })` - 100% will be searched literally, the `%` sign won't be treated as a wildcard.

## orchid-orm 1.33

Previously when joining with columns, you could omit table names of both tables:

```ts
db.user.join(db.message, 'userId', 'id'); // id -> user.id
```

Now, columns without a table will be addressed to the joining table:

```ts
// wrong: message.userId = message.id
db.user.join(db.message, 'userId', 'id' ❌);

// correct: message.userId = user.id
db.user.join(db.message, 'userId', 'user.id' ✅);
```

## orchid-orm 1.32.13

Validation schema `Table.querySchema()` becomes partial by default.

## orchid-orm 1.32.0

Improved casting to snake_case, so the columns are translated to snake_case in primary key, indexes, foreign key options.

This may break existing migrations if you had `snakeCase: true` and for some reason have some of the columns in `camelCase` in the db.

## orchid-orm 1.31.2

Removing `primaryKey`, `foreignKey`, `associationForeignKey`, and such, as options for `belongsTo`, `hasMany`, etc.

## orchid-orm 1.31.0

Computed columns change, see the [docs](https://orchid-orm.netlify.app/guide/computed-columns.html).

For SQL computed columns:

```ts
// before
computed = this.setComputed({
  fullName: (q) => q.sql`...`.type((t) => t.string()),
});

// after
computed = this.setComputed((q) => ({
  fullName: q.sql`...`.type((t) => t.string()),
}));
```

## orchid-orm 1.30.0

The `text` column type no longer accepts `min` and `max` params.

If you have overridden it in the `BaseTable` config like the following, simply remove it:

```ts
text: (min = 0, max = Infinity) => t.text(min, max),
```

Replace all occurrences of `text(min, max)` in your code with `text().min(min).max(max)`.

`varchar`'s limit parameter becomes required (it becomes optional again later in orchid-orm@1.32.19), replace unlimited varchars with `text`.

The `char` type is removed because it's [discouraged](https://wiki.postgresql.org/wiki/Don't_Do_This#Don.27t_use_char.28n.29) by Postgres.

## orchid-orm 1.29.0

`json*` methods rework: now all json methods such as `jsonSet` can be used in all contexts on a single JSON value,
and they can be chained one after another:

```ts
db.table.update({
  data: (q) =>
    q.get('data').jsonSet('foo', 1).jsonSet('bar', 2).jsonRemove('baz'),
});
```

`jsonPathQuery` -> `jsonPathQueryFirst`:

```ts
// before
db.table.jsonPathQuery(columnTypes.text(), 'data', '$.name', 'name', {
  vars: 'vars',
  silent: true,
});

// after
db.table.get('data').jsonPathQueryFirst('$.name', {
  type: (t) => t.text(),
  vars: 'vars',
  silent: true,
});
```

`jsonSet`:

```ts
// before
db.table.jsonSet('data', ['name'], 'new value');

// after
db.table.get('data').jsonSet('name', 'new value');
```

`jsonSet` with `createIfMissing: false` becomes `jsonReplace`:

```ts
// before
db.table.jsonSet('data', ['name'], 'new value', { createIfMissing: false });

// after
db.table.get('data').jsonReplace('name', 'new value');
```

`jsonInsert`:

```ts
// before
db.table.jsonInsert('data', ['tags', 0], 'tag', { insertAfter: true });

// after
db.table.get('data').jsonInsert(['tags', 0], 'tag', { after: true });
```

`jsonRemove`:

```ts
// before
db.table.jsonRemove('data', ['tags', 0]);

// after
db.table.get('data').jsonRemove(['tags', 0]);
```

## orchid-orm 1.28.14

`null` values for JSON columns are saved as is. Prior to now, nulls for JSON columns were stringified.

## orchid-orm 1.28.0

#### with

See the updated [with](https://orchid-orm.netlify.app/guide/advanced-queries.html#with) docs.

Previously, the same `with` method could accept `recursive` parameter, and it could accept custom SQL expressions.

Now the `with` is focused on queries, added new `withRecursive` method for recursive `WITH`, and `withSql` for SQL expressions.

#### union and similar methods

(similar methods are `unionAll`, `intersect`, `intersectAll`, `except`, `exceptAll`)

- previously they accepted optional boolean argument two wrap queries wrap parens, now they are always wrapped;
- they accepted array, now accepting variadic `...args` (one or more arguments);
- `order`, `limit`, `offset` now are gracefully handled for such queries, see [docs](https://orchid-orm.netlify.app/guide/advanced-queries#union-unionall-intersect-intersectall-except-exceptall).

## orchid-orm 1.27.10

`updateRaw` renamed to `updateSql` (for consistency)

## orchid-orm 1.27.2

`fn` query builder used to accept a column type as a parameter, now the column type is set by using the `type` method instead:

```ts
db.table.select({
  // BEFORE
  value: (q) => (q) =>
    q.fn<number>('sqrt', ['numericColumn'], {}, (t) => t.integer()),
  // AFTER
  value: (q) => (q) =>
    q.fn<number>('sqrt', ['numericColumn']).type((t) => t.integer()),
});
```

## orchid-orm 1.27.0

In snake case mode, `timestamps()`'s helper columns had hardcoded names `updated_at` and `created_at`.
Now, if you apply timestamp columns separately as shown below, they will use and snakerize a column name from the key:

```ts
class Table extends BaseTable {
  snakeCase = true;
  columns = this.setColumns((t) => ({
    // will be `custom_created` in db
    customCreated: t.timestamps().createdAt,
    // will be `custom_updated` in db
    customUpdated: t.timestamps().updatedAt,
  }));
}
```

`timestampsSnakeCase` and `timestampsNoTzSnakeCase` helpers were removed in favor of manually naming timestamps as shown above.

## orchid-orm 1.26.3, rake-db 2.20.0

The `import` config was optional, because on some setups it can work without it.
Now it's required, because it is confusing when it does not work for your setup, so it is better to require it for all.

```ts
rakeDb(dbOptions, {
  import: (path) => import(path),
});
```

## orchid-orm 1.26.1

`onConflict` changes:

- `onConflictIgnore` is renamed to `onConflictDoNothing` (was closer to Knex, becomes closer to SQL).
- `onConflict(...).merge` no longer accepts a set for update, only columns for merging.
- New `onConflict(...).set`: use `set` for setting specific values instead of `merge` as it was previously.
- `onConflict(...).merge` now can also accept `{ except: string | string[] }` to merge all values except for specified.

## orchid-orm 1.26.0

Rework of table primary keys, indexes, foreign keys, and checks.

### Query builder

- [findBy](https://orchid-orm.netlify.app/guide/query-methods.html#findby) now will only accept unique sets of columns.
  It accepts columns of simple and composite primary key and columns of unique indexes.
  `findBy` was a shortcut for `where(...).take()`, so it was grabbing the first record for matching conditions.
  It was easy to miss out the fact that there are multiple matching records in the database, and you're receiving a randomly picked one.
  It accepted a partial set of columns, and TS couldn't catch the case if a key is missing (undefined), it was possible to pass empty object: `findBy({})`
  without realizing it.
- [onConflict](https://orchid-orm.netlify.app/guide/create-update-delete.html#onconflict):
  - `onConflict().ignore()` is changed to `onConflictIgnore()`, passing columns to it is optional as it was.
  - `onConflict().merge()` now requires columns of primary key or one of unique indexes.
  - `onConflict()` now can also accept a name of primary key or unique index, if it was defined in the table's code.

### `setColumns` in table definitions

```ts
export class Table extends BaseTable {
  readonly table = 'table';

  // BEFORE
  columns = this.setColumns((t) => ({
    a: t.integer().primaryKey({ name: 'pkey' }),
    b: t.integer().index({ name: 'index' })
    c: t.integer().foreignKey(() => OtherTable, 'id', { name: 'fkey' }),
    d: t.integer().index({ unique: true }),
    ...t.timestamps(),
    ...t.primaryKey(['a', 'b'], { name: 'compositePkey' }),
    ...t.index(['a', 'b'], { name: 'compositeIndex', ...otherOptions }),
    ...t.foreignKey(['a', 'b'], () => OtherTable, ['id', 'type'], { name: 'fkey2' }),
    ...t.check(t.sql`a != b`),
  }));

  // AFTER
  columns = this.setColumns(
    (t) => ({
      a: t.integer().primaryKey('pkey'),
      b: t.integer().index('index')
      c: t.integer().foreignKey(() => OtherTable, 'id', { name: 'fkey' }),
      d: t.integer().unique(),
      ...t.timestamps(),
    }),
    (t) => [
      t.primaryKey(['a', 'b'], 'compositePkey'),
      t.index(['a', 'b'], 'compositeIndex', { ...otherOptions }),
      t.foreignKey(['a', 'b'], () => OtherTable, ['id', 'type'], { name: 'fkey2' }),
      t.check(t.sql`a != b`),
    ],
  );
```

- Composite primary keys, indexes, foreign keys are moving to a separate function.
  Now their column arguments are type-checked.
- To define a database-level name of the primary key or index, previously it was passed in an object,
  now it's passed separately after a column list.
  This way the name can be inferred for later use in `onConflict`.
- Previously, `t.unique()` was a shortcut for `t.index({ unique: true })`.
  Now it's mandatory to use `t.unique()` for unique indexes because in this way ORM can infer what indexes are unique,
  for later use in `findBy` and `onConflict`.
- Foreign key's name still can be passed via object because there is no need for inferring it.
- `...t.timestamps()` are unchanged, goes into the first function.
- If there is only a single composite primary key or index, it can be returned without wrapping into an array:
  ```ts
  (t) => t.primaryKey(['a', 'b'], 'compositePkey'),
  ```

### Migrations

The same changes to primary keys, indexes, foreign keys also applies for migrations.
`createTable` now will accept a second function for these things.
As well as in the table's code, `name` of primary key and index becomes a standalone argument, `{ unique: true }` index option was removed in favor of `t.unique()`.

`changeTable` still accepts a single function for changes, as it can't type-check columns that aren't in this migration anyway.

## orchid-orm 1.25.0

The new and shiny migration from code generator is arrived ([docs](https://orchid-orm.netlify.app/guide/orm-and-query-builder.html#generate-migrations)),
and the previous generator of code from migrations was dropped (`appCodeUpdater` config in `rake-db`).

Generating code from migrations was an experiment, and it was quicker to implement, but that approach wasn't viable enough and had limitations.
