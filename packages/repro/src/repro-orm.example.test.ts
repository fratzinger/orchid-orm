import { createBaseTable, testTransaction } from 'orchid-orm';
import { orchidORM } from 'orchid-orm/postgres-js';

// Do the `createBaseTable` as specified in the issue, otherwise default it to:
const BaseTable = createBaseTable({ snakeCase: true });

// Define the tables as specified in the issue,
// if not specified try to infer the table names, columns, relations, etc. from the issue.
class UserTable extends BaseTable {
  readonly table = 'user';

  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    name: t.varchar(),
  }));
}

class PostTable extends BaseTable {
  readonly table = 'post';
  readonly softDelete = true;

  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    deletedAt: t.timestamp().nullable(),
    userId: t.integer(),
    text: t.varchar(),
  }));

  relations = {
    user: this.belongsTo(() => UserTable, {
      required: true,
      columns: ['userId'],
      references: ['id'],
    }),
  };
}

const db = orchidORM(
  {
    // Always specify this databaseURL
    databaseURL: process.env.PG_REPRO_URL,
    log: true,
  },
  {
    // Specify all the previously defined tables
    user: UserTable,
    post: PostTable,
  },
);

// describe description should state what issue are we reproducing
describe('reproduction example for orm query', () => {
  beforeAll(async () => {
    // Always start a testTransaction in beforeAll like this.
    // If user specified it elsewhere - still put it to the beforeAll.
    await testTransaction.start(db);

    // If user provided SQLs to create tables and other db structures - just use the provided SQL here.
    // Otherwise write a valid PostgreSQL SQL to reflect the table structure, it should reflect table classes defined above.
    // Always execute the SQL using `db.$query` in beforeAll.
    await db.$query`
      create table "user" (id serial primary key, name varchar not null);
      create table "post" (id serial primary key, deleted_at timestamp null, user_id integer not null references "user"(id), text varchar not null);
    `;
  });

  afterAll(async () => {
    // Always do the testTransaction.close in afterAll like this.
    // If user specified it elsewhere - still put it to the afterAll.
    await testTransaction.close(db);
  });

  // The reproduction goes to the test case. Test case name should tell what's expected.
  // Write clarification comments in the test case.
  it('should do what is expected', async () => {
    await db.user.insertMany([{ name: 'Alice' }, { name: 'Bob' }]);
    await db.post.insertMany([
      { userId: 1, text: 'Hello' },
      { userId: 2, text: 'World' },
    ]);

    const deletedPost = await db.post
      .find(1)
      .delete()
      .select('id', 'text', {
        user: (q) => q.user.select('id', 'name'),
      });

    // Capture user's issue problem into a failing `expect` assertion.
    expect(deletedPost.user).toBeDefined();
  });
});
