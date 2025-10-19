import {
  expectQueryNotMutated,
  Message,
  Product,
  Profile,
  profileData,
  ProfileRecord,
  Snake,
  SnakeRecord,
  snakeSelectAll,
  snakeSelectAllWithTable,
  User,
  userColumnsSql,
  userData,
  UserRecord,
  userTableColumnsSql,
} from '../../test-utils/test-utils';
import {
  DateColumn,
  defaultSchemaConfig,
  DefaultSchemaConfig,
  IntegerColumn,
  JSONTextColumn,
  VirtualColumn,
} from '../../columns';
import { getShapeFromSelect } from './select';
import {
  assertType,
  expectSql,
  jsonBuildObjectAllSql,
  sql,
  testZodColumnTypes as t,
  useTestDatabase,
} from 'test-utils';
import { z } from 'zod/v4';
import { EmptyObject, NotFoundError } from 'orchid-core';

const insertUserAndProfile = async () => {
  const id = await User.get('id').create(userData);
  await Profile.create({ ...profileData, userId: id });
};

const profileJsonBuildObjectSql = jsonBuildObjectAllSql(Profile, 'p');

const ProfileNoParsers = Profile.clone();
ProfileNoParsers.q.parsers = undefined;

describe('select', () => {
  useTestDatabase();

  describe('select', () => {
    it('should select all columns with a *', () => {
      const query = User.join(Message, 'authorId', 'id').select('*');

      assertType<Awaited<typeof query>, UserRecord[]>();

      expect(Object.keys(getShapeFromSelect(query))).toEqual(
        Object.keys(User.q.selectAllShape),
      );

      expectSql(
        query.toSQL(),
        `
          SELECT ${userTableColumnsSql} FROM "user"
          JOIN "message" ON "message"."author_id" = "user"."id"
        `,
      );
    });

    it('should omit virtual columns from getShapeFromSelect when selecting *', () => {
      class Virtual extends VirtualColumn<DefaultSchemaConfig> {}

      const Table = Object.create(User);
      Table.q = {
        shape: { ...Table.shape, virtual: new Virtual(defaultSchemaConfig) },
      };

      const q = Table.select('*');
      expect(Object.keys(getShapeFromSelect(q))).toEqual(
        Object.keys(User.q.selectAllShape),
      );
    });

    it('should select all named columns with a *', () => {
      const q = Snake.join(Message, 'authorId', 'tailLength').select('*');

      assertType<Awaited<typeof q>, SnakeRecord[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT ${snakeSelectAllWithTable} FROM "snake"
          JOIN "message" ON "message"."author_id" = "snake"."tail_length"
        `,
      );
    });

    it('should select all table columns with * plus specified joined columns', () => {
      const query = User.join(Message, 'authorId', 'id').select(
        '*',
        'message.text',
      );

      assertType<Awaited<typeof query>, (UserRecord & { text: string })[]>();

      expectSql(
        query.toSQL(),
        `
          SELECT ${userTableColumnsSql}, "message"."text" FROM "user"
          JOIN "message" ON "message"."author_id" = "user"."id"
        `,
      );
    });

    it('should be able to select nothing', async () => {
      await User.insert(userData);

      const q = User.select();

      expectSql(q.toSQL(), `SELECT FROM "user"`);

      const users = await q;
      assertType<typeof users, EmptyObject[]>();

      expect(users).toEqual([{}]);
    });

    it('should select provided columns', () => {
      const q = User.all();
      const query = q.select('id', 'name');

      assertType<Awaited<typeof query>, Pick<UserRecord, 'id' | 'name'>[]>();

      expectSql(
        query.toSQL(),
        `
          SELECT "user"."id", "user"."name" FROM "user"
        `,
      );

      expect(getShapeFromSelect(query)).toEqual({
        id: User.shape.id,
        name: User.shape.name,
      });

      expectQueryNotMutated(q);
    });

    it('should select named columns', () => {
      const q = Snake.select('snakeName', 'tailLength');

      assertType<
        Awaited<typeof q>,
        { snakeName: string; tailLength: number }[]
      >();

      expectSql(
        q.toSQL(),
        `
          SELECT "snake"."snake_name" "snakeName", "snake"."tail_length" "tailLength"
          FROM "snake"
        `,
      );
    });

    it('should select table.column', () => {
      const q = User.all();
      const query = q.select('user.id', 'user.name');

      assertType<Awaited<typeof query>, Pick<UserRecord, 'id' | 'name'>[]>();

      expectSql(
        query.toSQL(),
        `
          SELECT "user"."id", "user"."name" FROM "user"
        `,
      );

      expect(getShapeFromSelect(query)).toEqual({
        id: User.shape.id,
        name: User.shape.name,
      });

      expectQueryNotMutated(q);
    });

    it('should select named columns with table', () => {
      const q = Snake.select('snake.snakeName', 'snake.tailLength');

      assertType<
        Awaited<typeof q>,
        { snakeName: string; tailLength: number }[]
      >();

      expectSql(
        q.toSQL(),
        `
          SELECT "snake"."snake_name" "snakeName", "snake"."tail_length" "tailLength"
          FROM "snake"
        `,
      );
    });

    it('should select joined columns', () => {
      const q = User.all();
      const query = q
        .join(Profile, 'profile.userId', '=', 'user.id')
        .select('user.id', 'profile.userId');

      assertType<Awaited<typeof query>, { id: number; userId: number }[]>();

      expectSql(
        query.toSQL(),
        `
          SELECT "user"."id", "profile"."user_id" "userId" FROM "user"
          JOIN "profile" ON "profile"."user_id" = "user"."id"
        `,
      );

      expect(getShapeFromSelect(query)).toEqual({
        id: User.shape.id,
        userId: Profile.shape.userId,
      });

      expectQueryNotMutated(q);
    });

    it('should select left joined columns as optional', () => {
      const q = User.leftJoin(Profile, 'profile.userId', 'user.id').select(
        'user.id',
        'profile.userId',
      );

      assertType<Awaited<typeof q>, { id: number; userId: number | null }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT "user"."id", "profile"."user_id" "userId" FROM "user"
          LEFT JOIN "profile" ON "profile"."user_id" = "user"."id"
        `,
      );
    });

    it('should select named joined columns', () => {
      const q = User.join(Snake, 'tailLength', 'id').select(
        'user.id',
        'snake.snakeName',
      );

      assertType<Awaited<typeof q>, { id: number; snakeName: string }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT "user"."id", "snake"."snake_name" "snakeName"
          FROM "user"
          JOIN "snake" ON "snake"."tail_length" = "user"."id"
        `,
      );
    });

    it('should select joined columns with alias', () => {
      const q = User.all();
      const query = q
        .join(Profile.as('p'), 'p.userId', '=', 'user.id')
        .select('user.id', 'p.userId');

      assertType<Awaited<typeof query>, { id: number; userId: number }[]>();

      expectSql(
        query.toSQL(),
        `
          SELECT "user"."id", "p"."user_id" "userId" FROM "user"
          JOIN "profile" "p" ON "p"."user_id" = "user"."id"
        `,
      );

      expect(getShapeFromSelect(query)).toEqual({
        id: User.shape.id,
        userId: Profile.shape.userId,
      });

      expectQueryNotMutated(q);
    });

    it('should select named joined columns with alias', () => {
      const q = User.join(Snake.as('s'), 'tailLength', 'id').select(
        'user.id',
        's.snakeName',
      );

      assertType<Awaited<typeof q>, { id: number; snakeName: string }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT "user"."id", "s"."snake_name" "snakeName"
          FROM "user"
          JOIN "snake" "s" ON "s"."tail_length" = "user"."id"
        `,
      );
    });

    it('should select joined table as json', async () => {
      await insertUserAndProfile();

      const q = User.join(Profile.as('p'), 'p.userId', 'user.id')
        .select('p.*')
        .where({
          'p.bio': profileData.bio,
        });

      assertType<Awaited<typeof q>, { p: ProfileRecord }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT ${profileJsonBuildObjectSql} "p"
          FROM "user"
          JOIN "profile" "p" ON "p"."user_id" = "user"."id"
          WHERE "p"."bio" = $1
        `,
        [profileData.bio],
      );

      const data = await q;
      expect(data).toEqual([
        {
          p: {
            id: expect.any(Number),
            userId: expect.any(Number),
            bio: profileData.bio,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          },
        },
      ]);
    });

    it('should select joined table as json with alias', async () => {
      await insertUserAndProfile();

      const q = User.join(Profile.as('p'), 'p.userId', 'user.id')
        .select({
          profile: 'p.*',
        })
        .where({
          'p.bio': profileData.bio,
        });

      assertType<Awaited<typeof q>, { profile: ProfileRecord }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT ${profileJsonBuildObjectSql} "profile"
          FROM "user"
          JOIN "profile" "p" ON "p"."user_id" = "user"."id"
          WHERE "p"."bio" = $1
        `,
        [profileData.bio],
      );

      const data = await q;
      expect(data).toEqual([
        {
          profile: {
            id: expect.any(Number),
            userId: expect.any(Number),
            bio: profileData.bio,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          },
        },
      ]);
    });

    it('should select left joined table as json', async () => {
      await insertUserAndProfile();

      const q = User.leftJoin(Profile.as('p'), 'p.userId', 'user.id').select(
        'p.*',
      );

      assertType<Awaited<typeof q>, { p: ProfileRecord | undefined }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT ${profileJsonBuildObjectSql} "p"
          FROM "user"
          LEFT JOIN "profile" "p" ON "p"."user_id" = "user"."id"
        `,
      );

      const data = await q;
      expect(data).toEqual([
        {
          p: {
            id: expect.any(Number),
            userId: expect.any(Number),
            bio: profileData.bio,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          },
        },
      ]);
    });

    it('should select left joined table as json with alias', async () => {
      await insertUserAndProfile();

      const q = User.leftJoin(Profile.as('p'), 'p.userId', 'user.id').select({
        profile: 'p.*',
      });

      assertType<Awaited<typeof q>, { profile: ProfileRecord | undefined }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT ${profileJsonBuildObjectSql} "profile"
          FROM "user"
          LEFT JOIN "profile" "p" ON "p"."user_id" = "user"."id"
        `,
      );

      const data = await q;
      expect(data).toEqual([
        {
          profile: {
            id: expect.any(Number),
            userId: expect.any(Number),
            bio: profileData.bio,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          },
        },
      ]);
    });

    it('should select right joined table as json', () => {
      const q = User.rightJoin(Profile.as('p'), 'p.userId', 'user.id').select(
        'name',
        'p.*',
      );

      assertType<
        Awaited<typeof q>,
        { name: string | null; p: ProfileRecord }[]
      >();

      expectSql(
        q.toSQL(),
        `
          SELECT "user"."name", ${profileJsonBuildObjectSql} "p"
          FROM "user"
          RIGHT JOIN "profile" "p" ON "p"."user_id" = "user"."id"
        `,
      );
    });

    it('should select right joined table as json with alias', () => {
      const q = User.rightJoin(Profile.as('p'), 'p.userId', 'user.id').select(
        'name',
        { profile: 'p.*' },
      );

      assertType<
        Awaited<typeof q>,
        { name: string | null; profile: ProfileRecord }[]
      >();

      expectSql(
        q.toSQL(),
        `
          SELECT "user"."name", ${profileJsonBuildObjectSql} "profile"
          FROM "user"
          RIGHT JOIN "profile" "p" ON "p"."user_id" = "user"."id"
        `,
      );
    });

    it('should select full joined table as json', () => {
      const q = User.fullJoin(Profile.as('p'), 'p.userId', 'user.id').select(
        'name',
        'p.*',
      );

      assertType<
        Awaited<typeof q>,
        { name: string | null; p: ProfileRecord | undefined }[]
      >();

      expectSql(
        q.toSQL(),
        `
          SELECT "user"."name", ${profileJsonBuildObjectSql} "p"
          FROM "user"
          FULL JOIN "profile" "p" ON "p"."user_id" = "user"."id"
        `,
      );
    });

    it('should select full joined table as json with alias', () => {
      const q = User.fullJoin(Profile.as('p'), 'p.userId', 'user.id').select(
        'name',
        { profile: 'p.*' },
      );

      assertType<
        Awaited<typeof q>,
        { name: string | null; profile: ProfileRecord | undefined }[]
      >();

      expectSql(
        q.toSQL(),
        `
          SELECT "user"."name", ${profileJsonBuildObjectSql} "profile"
          FROM "user"
          FULL JOIN "profile" "p" ON "p"."user_id" = "user"."id"
        `,
      );
    });

    describe('loading records', () => {
      beforeEach(insertUserAndProfile);

      it('should parse columns of the table', async () => {
        const q = User.select('createdAt');

        assertType<Awaited<typeof q>, { createdAt: Date }[]>();

        expect(getShapeFromSelect(q)).toEqual({
          createdAt: User.shape.createdAt,
        });

        expect((await q.all())[0].createdAt instanceof Date).toBe(true);
        expect((await q.take()).createdAt instanceof Date).toBe(true);
        expect((await q.rows())[0][0] instanceof Date).toBe(true);
        expect((await q.get('createdAt')) instanceof Date).toBe(true);
      });

      it('should parse columns of the table, selected by column name and table name', async () => {
        const q = User.select('user.createdAt');

        assertType<Awaited<typeof q>, { createdAt: Date }[]>();

        expect(getShapeFromSelect(q)).toEqual({
          createdAt: User.shape.createdAt,
        });

        expect((await q.all())[0].createdAt instanceof Date).toBe(true);
        expect((await q.take()).createdAt instanceof Date).toBe(true);
        expect((await q.rows())[0][0] instanceof Date).toBe(true);
        expect((await q.get('user.createdAt')) instanceof Date).toBe(true);
      });

      it('should parse columns of joined table', async () => {
        const q = Profile.join(User, 'user.id', '=', 'profile.userId').select(
          'user.createdAt',
        );

        assertType<Awaited<typeof q>, { createdAt: Date }[]>();

        expect(getShapeFromSelect(q)).toEqual({
          createdAt: User.shape.createdAt,
        });

        expect((await q.all())[0].createdAt instanceof Date).toBe(true);
        expect((await q.take()).createdAt instanceof Date).toBe(true);
        expect((await q.rows())[0][0] instanceof Date).toBe(true);
        expect((await q.get('user.createdAt')) instanceof Date).toBe(true);
      });
    });

    it('should select columns with aliases', async () => {
      const q = User.all();

      const query = q.select({ aliasedId: 'id', aliasedName: 'name' });

      assertType<
        Awaited<typeof query>,
        { aliasedId: number; aliasedName: string }[]
      >();

      expect(getShapeFromSelect(query)).toEqual({
        aliasedId: User.shape.id,
        aliasedName: User.shape.name,
      });

      expectSql(
        query.toSQL(),
        `
          SELECT "user"."id" "aliasedId", "user"."name" "aliasedName"
          FROM "user"
        `,
      );
      expectQueryNotMutated(q);
    });

    it('should select named columns with aliases', async () => {
      const q = Snake.select({ name: 'snakeName', length: 'tailLength' });

      assertType<Awaited<typeof q>, { name: string; length: number }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT "snake"."snake_name" "name", "snake"."tail_length" "length"
          FROM "snake"
        `,
      );
    });

    it('should select table.column with aliases', () => {
      const q = User.all();

      const query = q.select({
        aliasedId: 'user.id',
        aliasedName: 'user.name',
      });

      assertType<
        Awaited<typeof query>,
        { aliasedId: number; aliasedName: string }[]
      >();

      expect(getShapeFromSelect(query)).toEqual({
        aliasedId: User.shape.id,
        aliasedName: User.shape.name,
      });

      expectSql(
        query.toSQL(),
        `
          SELECT "user"."id" "aliasedId", "user"."name" "aliasedName"
          FROM "user"
        `,
      );
      expectQueryNotMutated(q);
    });

    it('should select named columns with table with aliases', async () => {
      const q = Snake.select({
        name: 'snake.snakeName',
        length: 'snake.tailLength',
      });

      assertType<Awaited<typeof q>, { name: string; length: number }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT "snake"."snake_name" "name", "snake"."tail_length" "length"
          FROM "snake"
        `,
      );
    });

    it('should select joined columns', () => {
      const q = User.all();
      const query = q.join(Profile, 'profile.userId', '=', 'user.id').select({
        aliasedId: 'user.id',
        aliasedUserId: 'profile.userId',
      });

      assertType<
        Awaited<typeof query>,
        { aliasedId: number; aliasedUserId: number }[]
      >();

      expect(getShapeFromSelect(query)).toEqual({
        aliasedId: User.shape.id,
        aliasedUserId: Profile.shape.userId,
      });

      expectSql(
        query.toSQL(),
        `
          SELECT "user"."id" "aliasedId", "profile"."user_id" "aliasedUserId"
          FROM "user"
          JOIN "profile" ON "profile"."user_id" = "user"."id"
        `,
      );
      expectQueryNotMutated(q);
    });

    it('should select named joined columns with aliases', () => {
      const q = User.join(Snake, 'tailLength', 'id').select({
        userId: 'user.id',
        length: 'snake.tailLength',
      });

      assertType<Awaited<typeof q>, { userId: number; length: number }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT "user"."id" "userId", "snake"."tail_length" "length"
          FROM "user"
          JOIN "snake" ON "snake"."tail_length" = "user"."id"
        `,
      );
    });

    it('should select joined columns with alias', () => {
      const q = User.all();
      const query = q.join(Profile.as('p'), 'p.userId', '=', 'user.id').select({
        aliasedId: 'user.id',
        aliasedUserId: 'p.userId',
      });

      assertType<
        Awaited<typeof query>,
        { aliasedId: number; aliasedUserId: number }[]
      >();

      expect(getShapeFromSelect(query)).toEqual({
        aliasedId: User.shape.id,
        aliasedUserId: Profile.shape.userId,
      });

      expectSql(
        query.toSQL(),
        `
          SELECT "user"."id" "aliasedId", "p"."user_id" "aliasedUserId"
          FROM "user"
          JOIN "profile" "p" ON "p"."user_id" = "user"."id"
        `,
      );
      expectQueryNotMutated(q);
    });

    it('should select named joined columns with aliases from aliased join', () => {
      const q = User.join(Snake.as('s'), 'tailLength', 'id').select({
        userId: 'user.id',
        length: 's.tailLength',
      });

      assertType<Awaited<typeof q>, { userId: number; length: number }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT "user"."id" "userId", "s"."tail_length" "length"
          FROM "user"
          JOIN "snake" "s" ON "s"."tail_length" = "user"."id"
        `,
      );
    });

    it('should accept raw', () => {
      const q = User.all();
      const query = q.select({ one: sql`1` });

      assertType<Awaited<typeof query>, { one: unknown }[]>();

      expectSql(
        query.toSQL(),
        `
          SELECT 1 "one" FROM "user"
        `,
      );
      expectQueryNotMutated(q);
    });

    it('should support selecting column after selecting by object', () => {
      const q = User.select({
        count: sql<number>`count(*)`,
      }).select('name');

      assertType<Awaited<typeof q>, { count: number; name: string }[]>();
    });

    it('should respect previous select', () => {
      const q = User.select('id').select('name');

      assertType<Awaited<typeof q>, { id: number; name: string }[]>();
    });

    it('table should have all columns selected if select was not applied', () => {
      assertType<Awaited<typeof User>, UserRecord[]>();
    });

    describe('select callback', () => {
      it('should support conditional query or raw expression', async () => {
        const condition = true;
        const q = User.select({
          key: () => (condition ? User.exists() : sql<boolean>`false`),
        });

        assertType<Awaited<typeof q>, { key: boolean }[]>();
      });

      it('should accept raw in a callback', () => {
        const query = User.select({
          one: () => sql`1`.type((t) => t.integer()),
        });

        assertType<Awaited<typeof query>, { one: number }[]>();

        expect(getShapeFromSelect(query)).toEqual({
          one: expect.any(IntegerColumn),
        });

        expectSql(
          query.toSQL(),
          `
            SELECT 1 "one" FROM "user"
          `,
        );
      });

      it('should select subquery', () => {
        const q = User.all();
        const query = q.select({ subquery: () => User.all() });

        assertType<Awaited<typeof query>, { subquery: UserRecord[] }[]>();

        expect(getShapeFromSelect(query)).toEqual({
          subquery: expect.any(JSONTextColumn),
        });

        expectSql(
          query.toSQL(),
          `
            SELECT
              (
                SELECT COALESCE(json_agg(row_to_json(t.*)), '[]')
                FROM (SELECT ${userColumnsSql} FROM "user") "t"
              ) "subquery"
            FROM "user"
          `,
        );
        expectQueryNotMutated(q);
      });

      it('should select subquery for named columns', () => {
        const q = Snake.select({ subquery: () => Snake.all() });

        assertType<Awaited<typeof q>, { subquery: SnakeRecord[] }[]>();

        expectSql(
          q.toSQL(),
          `
            SELECT
              (
                SELECT COALESCE(json_agg(row_to_json(t.*)), '[]')
                FROM (
                  SELECT ${snakeSelectAll}
                  FROM "snake"
                ) "t"
              ) "subquery"
            FROM "snake"
          `,
        );
      });

      it('should properly select 3 levels deep select *', () => {
        const q = User.select({
          arr: () =>
            User.select({
              arr: () => User.select('*'),
            }),
        });

        assertType<Awaited<typeof q>, { arr: { arr: UserRecord[] }[] }[]>();
      });

      // testing this issue: https://github.com/romeerez/orchid-orm/issues/45
      // and this: https://github.com/romeerez/orchid-orm/issues/310
      it('should handle nested sub selects', async () => {
        await User.insert(userData);

        const res = await User.select('*', {
          author: () =>
            User.select({
              count: () => User.count(),
            }).takeOptional(),
        });

        assertType<
          typeof res,
          (UserRecord & { author: { count: number } | undefined })[]
        >();
      });

      it('should combine multiple selects and give proper types', async () => {
        const query = User.select('id').select({
          count: () => User.count(),
        });

        const q = User.from(query).selectAll();

        assertType<Awaited<typeof q>, { id: number; count: number }[]>();
      });

      it('should throw when sub query with `take` is not found', async () => {
        await User.insert(userData);

        await expect(() =>
          User.select({ as: () => Profile.take() }),
        ).rejects.toThrow(NotFoundError);
      });

      it('should return undefined when sub query with `takeOptional` is not found', async () => {
        await User.insert(userData);

        const res = await User.select({
          withParsers: () => Profile.takeOptional(),
          withoutParsers: () => ProfileNoParsers.takeOptional(),
        });

        assertType<
          typeof res,
          {
            withParsers: ProfileRecord | undefined;
            withoutParsers: ProfileRecord | undefined;
          }[]
        >();

        expect(res).toEqual([
          { withParsers: undefined, withoutParsers: undefined },
        ]);
      });

      it('should throw when sub query with `get` is not found', async () => {
        await User.insert(userData);

        await expect(() =>
          User.select({ as: () => Profile.get('id') }),
        ).rejects.toThrow(NotFoundError);
      });

      it('should return undefined when sub query with `getOptional` is not found', async () => {
        await User.insert(userData);

        const res = await User.select({
          withParsers: () => Profile.getOptional('createdAt'),
          withoutParsers: () => ProfileNoParsers.getOptional('createdAt'),
        });

        assertType<
          typeof res,
          {
            withParsers: Date | undefined;
            withoutParsers: Date | undefined;
          }[]
        >();

        expect(res).toEqual([
          { withParsers: undefined, withoutParsers: undefined },
        ]);
      });

      it('should not throw when not found for aggregations that can return null', async () => {
        await User.insert(userData);

        const res = await User.select({
          withParsers: () => Profile.avg('id'),
          withoutParsers: () => ProfileNoParsers.avg('id'),
        });

        assertType<
          typeof res,
          {
            withParsers: number | null;
            withoutParsers: number | null;
          }[]
        >();

        expect(res).toEqual([{ withParsers: null, withoutParsers: null }]);
      });
    });
  });

  describe('selectAll', () => {
    it('should select all columns', () => {
      const query = User.select('id', 'name').selectAll();

      assertType<Awaited<typeof query>, UserRecord[]>();

      expect(Object.keys(getShapeFromSelect(query))).toEqual(
        Object.keys(User.q.selectAllShape),
      );

      expectSql(query.toSQL(), `SELECT ${userColumnsSql} FROM "user"`);
    });

    it('should select all named columns', () => {
      const q = Snake.select('snakeName').selectAll();

      assertType<Awaited<typeof q>, SnakeRecord[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT ${snakeSelectAll} FROM "snake"
        `,
      );
    });
  });

  describe('parse columns', () => {
    beforeEach(insertUserAndProfile);

    it('should parse columns of the table', async () => {
      const q = User.select({
        date: 'createdAt',
      });

      assertType<Awaited<typeof q>, { date: Date }[]>();

      expect(getShapeFromSelect(q)).toEqual({
        date: User.shape.createdAt,
      });

      expect((await q.all())[0].date instanceof Date).toBe(true);
      expect((await q.take()).date instanceof Date).toBe(true);
      expect((await q.rows())[0][0] instanceof Date).toBe(true);
    });

    it('should parse columns of the table, selected by column name and table name', async () => {
      const q = User.select({
        date: 'user.createdAt',
      });

      assertType<Awaited<typeof q>, { date: Date }[]>();

      expect(getShapeFromSelect(q)).toEqual({
        date: User.shape.createdAt,
      });

      expect((await q.all())[0].date instanceof Date).toBe(true);
      expect((await q.take()).date instanceof Date).toBe(true);
      expect((await q.rows())[0][0] instanceof Date).toBe(true);
    });

    it('should parse columns of joined table', async () => {
      const q = Profile.join(User, 'user.id', '=', 'profile.userId').select({
        date: 'user.createdAt',
      });

      assertType<Awaited<typeof q>, { date: Date }[]>();

      expect(getShapeFromSelect(q)).toEqual({
        date: User.shape.createdAt,
      });

      expect((await q.all())[0].date instanceof Date).toBe(true);
      expect((await q.take()).date instanceof Date).toBe(true);
      expect((await q.rows())[0][0] instanceof Date).toBe(true);
    });

    it('should parse raw column', async () => {
      const q = User.select({
        date: User.sql`"created_at"`.type(() =>
          t.date().parse(z.date(), (input) => new Date(input)),
        ),
      });

      assertType<Awaited<typeof q>, { date: Date }[]>();

      expect(getShapeFromSelect(q)).toEqual({
        date: expect.any(DateColumn),
      });

      expect((await q.all())[0].date instanceof Date).toBe(true);
      expect((await q.take()).date instanceof Date).toBe(true);
      expect((await q.rows())[0][0] instanceof Date).toBe(true);
    });

    describe('sub query', () => {
      it('should parse subquery array columns', async () => {
        const q = User.select({
          users: () => User.all(),
        });

        assertType<Awaited<typeof q>, { users: UserRecord[] }[]>();

        expect(getShapeFromSelect(q)).toEqual({
          users: expect.any(JSONTextColumn),
        });

        expect((await q.all())[0].users[0].createdAt instanceof Date).toBe(
          true,
        );
        expect((await q.take()).users[0].createdAt instanceof Date).toBe(true);
        expect((await q.rows())[0][0][0].createdAt instanceof Date).toBe(true);
      });

      it('should parse subquery item columns', async () => {
        const q = User.select({
          user: () => User.takeOptional(),
        });

        assertType<Awaited<typeof q>, { user: UserRecord | undefined }[]>();

        expect(getShapeFromSelect(q)).toEqual({
          user: expect.any(JSONTextColumn),
        });

        expect((await q.all())[0].user?.createdAt instanceof Date).toBe(true);
        expect((await q.take()).user?.createdAt instanceof Date).toBe(true);
        expect((await q.rows())[0][0]?.createdAt instanceof Date).toBe(true);
      });

      it('should parse subquery single value', async () => {
        const q = User.select({
          count: (q) => q.count(),
        });

        assertType<Awaited<typeof q>, { count: number }[]>();

        expect(getShapeFromSelect(q)).toEqual({
          count: expect.any(IntegerColumn),
        });

        expect(typeof (await q.all())[0].count).toBe('number');
        expect(typeof (await q.take()).count).toBe('number');
        expect(typeof (await q.rows())[0][0]).toBe('number');
      });

      it('should parse subquery pluck', async () => {
        const q = User.select({
          dates: () => User.pluck('createdAt'),
        });

        assertType<Awaited<typeof q>, { dates: Date[] }[]>();

        expect(getShapeFromSelect(q)).toEqual({
          dates: expect.any(JSONTextColumn),
        });

        expect((await q.all())[0].dates[0] instanceof Date).toBe(true);
        expect((await q.take()).dates[0] instanceof Date).toBe(true);
        expect((await q.rows())[0][0][0] instanceof Date).toBe(true);
      });

      it('should cast decimal to text for a sub-selected record', () => {
        const q = User.select({
          product: () => Product.take(),
        }).take();

        expectSql(
          q.toSQL(),
          `SELECT (
            SELECT json_build_object('id', t."id", 'camelCase', t."camelCase", 'priceAmount', t."priceAmount"::text)
            FROM (SELECT "id", "camel_case" "camelCase", "price_amount" "priceAmount" FROM "product" LIMIT 1) "t"
          ) "product" FROM "user" LIMIT 1`,
        );
      });

      it('should cast decimal to text for sub-selected records', () => {
        const q = User.select({
          products: () => Product,
        }).take();

        expectSql(
          q.toSQL(),
          `SELECT (
            SELECT COALESCE(json_agg(json_build_object('id', t."id", 'camelCase', t."camelCase", 'priceAmount', t."priceAmount"::text)), '[]')
            FROM (SELECT "id", "camel_case" "camelCase", "price_amount" "priceAmount" FROM "product") "t"
          ) "products" FROM "user" LIMIT 1`,
        );
      });

      it('should cast decimal to text for sub-selected records when selecting various columns', () => {
        const q = User.select({
          products: () => Product.select('id', 'camelCase', 'priceAmount'),
        }).take();

        expectSql(
          q.toSQL(),
          `SELECT (
            SELECT COALESCE(json_agg(json_build_object('id', t."id", 'camelCase', t."camelCase", 'priceAmount', t."priceAmount"::text)), '[]')
            FROM (SELECT "product"."id", "product"."camel_case" "camelCase", "product"."price_amount" "priceAmount" FROM "product") "t"
          ) "products" FROM "user" LIMIT 1`,
        );
      });
    });
  });
});
