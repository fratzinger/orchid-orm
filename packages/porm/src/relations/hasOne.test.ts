import { db } from '../test-utils/test-db';
import {
  AssertEqual,
  expectSql,
  insertProfile,
  insertUser,
  useTestDatabase,
} from '../test-utils/test-utils';
import { RelationQuery } from 'pqb';
import { Profile, User } from 'pqb/src/test-utils';

describe('hasOne', () => {
  useTestDatabase();

  it('should have method to query related data', async () => {
    const profileQuery = db.profile.takeOrThrow();

    const eq: AssertEqual<
      typeof db.user.profile,
      RelationQuery<
        'profile',
        { id: number },
        'userId',
        typeof profileQuery,
        true
      >
    > = true;

    expect(eq).toBe(true);

    const userId = await insertUser();

    const profileData = {
      id: 1,
      userId,
      bio: 'text',
    };
    await insertProfile(profileData);

    const user = await db.user.find(userId).takeOrThrow();
    const query = db.user.profile(user);

    expectSql(
      query.toSql(),
      `
        SELECT "profile".* FROM "profile"
        WHERE "profile"."userId" = $1
        LIMIT $2
      `,
      [userId, 1],
    );

    const profile = await query;

    expect(profile).toMatchObject(profileData);
  });

  it('should have insert with defaults of provided id', () => {
    const user = { id: 1 };
    const now = new Date();

    const query = db.user.profile(user).insert({
      bio: 'bio',
      updatedAt: now,
      createdAt: now,
    });

    expectSql(
      query.toSql(),
      `
        INSERT INTO "profile"("userId", "bio", "updatedAt", "createdAt")
        VALUES ($1, $2, $3, $4)
      `,
      [1, 'bio', now, now],
    );
  });

  it('can insert after calling method', async () => {
    const id = await insertUser();
    const now = new Date();
    await db.user.profile({ id }).insert({
      userId: id,
      bio: 'bio',
      updatedAt: now,
      createdAt: now,
    });
  });

  it('should have proper joinQuery', () => {
    expectSql(
      db.user.relations.profile.joinQuery.toSql(),
      `
        SELECT "profile".* FROM "profile"
        WHERE "profile"."userId" = "user"."id"
      `,
    );
  });

  it('should be supported in whereExists', () => {
    expectSql(
      db.user.whereExists('profile').toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE EXISTS (
          SELECT 1 FROM "profile"
          WHERE "profile"."userId" = "user"."id"
          LIMIT 1
        )
      `,
    );

    expectSql(
      db.user
        .whereExists('profile', (q) => q.where({ 'user.name': 'name' }))
        .toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE EXISTS (
          SELECT 1 FROM "profile"
          WHERE "profile"."userId" = "user"."id"
            AND "user"."name" = $1
          LIMIT 1
        )
      `,
      ['name'],
    );
  });

  it('should be supported in join', () => {
    const query = db.user
      .join('profile', (q) => q.where({ 'user.name': 'name' }))
      .select('name', 'profile.bio');

    const eq: AssertEqual<
      Awaited<typeof query>,
      { name: string; bio: string | null }[]
    > = true;
    expect(eq).toBe(true);

    expectSql(
      query.toSql(),
      `
        SELECT "user"."name", "profile"."bio" FROM "user"
        JOIN "profile"
          ON "profile"."userId" = "user"."id"
         AND "user"."name" = $1
      `,
      ['name'],
    );
  });

  it('should be selectable', () => {
    const query = db.user.select('id', db.user.profile.where({ bio: 'bio' }));
    expectSql(
      query.toSql(),
      `
        SELECT
          "user"."id",
          (
            SELECT row_to_json("t".*) AS "json"
            FROM (
              SELECT "profile".* FROM "profile"
              WHERE "profile"."userId" = "user"."id"
                AND "profile"."bio" = $1
              LIMIT $2
            ) AS "t"
          ) AS "profile"
        FROM "user"
      `,
      ['bio', 1],
    );
  });

  it('should support create', async () => {
    const now = new Date();
    const userData = {
      name: 'name',
      password: 'password',
      updatedAt: now,
      createdAt: now,
    };

    const profileData = {
      bio: 'bio',
      updatedAt: now,
      createdAt: now,
    };

    const query = db.user.insert(
      {
        ...userData,
        profile: {
          create: profileData,
        },
      },
      ['id'],
    );

    const { id } = await query;
    const user = await User.find(id);
    expect(user).toEqual({
      id,
      active: null,
      age: null,
      data: null,
      picture: null,
      ...userData,
    });

    const profile = await Profile.findBy({ userId: id });
    expect(profile).toEqual({
      id: profile.id,
      userId: id,
      ...profileData,
    });
  });
});

describe('hasOne through', () => {
  it('should have method to query related data', async () => {
    const profileQuery = db.profile.takeOrThrow();

    const eq: AssertEqual<
      typeof db.message.profile,
      RelationQuery<
        'profile',
        { authorId: number },
        never,
        typeof profileQuery,
        true
      >
    > = true;

    expect(eq).toBe(true);

    const query = db.message.profile({ authorId: 1 });
    expectSql(
      query.toSql(),
      `
        SELECT "profile".* FROM "profile"
        WHERE EXISTS (
          SELECT 1 FROM "user"
          WHERE "profile"."userId" = "user"."id"
            AND "user"."id" = $1
          LIMIT 1
        )
        LIMIT $2
      `,
      [1, 1],
    );
  });

  it('should have proper joinQuery', () => {
    expectSql(
      db.message.relations.profile.joinQuery.toSql(),
      `
        SELECT "profile".* FROM "profile"
        WHERE EXISTS (
          SELECT 1 FROM "user"
          WHERE "profile"."userId" = "user"."id"
            AND "user"."id" = "message"."authorId"
          LIMIT 1
        )
      `,
    );
  });

  it('should be supported in whereExists', () => {
    expectSql(
      db.message.whereExists('profile').toSql(),
      `
        SELECT "message".* FROM "message"
        WHERE EXISTS (
          SELECT 1 FROM "profile"
          WHERE EXISTS (
            SELECT 1 FROM "user"
            WHERE "profile"."userId" = "user"."id"
              AND "user"."id" = "message"."authorId"
            LIMIT 1
          )
          LIMIT 1
        )
      `,
    );

    expectSql(
      db.message
        .whereExists('profile', (q) => q.where({ 'message.text': 'text' }))
        .toSql(),
      `
        SELECT "message".* FROM "message"
        WHERE EXISTS (
          SELECT 1 FROM "profile"
          WHERE EXISTS (
            SELECT 1 FROM "user"
            WHERE "profile"."userId" = "user"."id"
              AND "user"."id" = "message"."authorId"
            LIMIT 1
          )
          AND "message"."text" = $1
          LIMIT 1
        )
      `,
      ['text'],
    );
  });

  it('should be supported in join', () => {
    const query = db.message
      .join('profile', (q) => q.where({ 'message.text': 'text' }))
      .select('text', 'profile.bio');

    const eq: AssertEqual<
      Awaited<typeof query>,
      { text: string; bio: string | null }[]
    > = true;
    expect(eq).toBe(true);

    expectSql(
      query.toSql(),
      `
        SELECT "message"."text", "profile"."bio" FROM "message"
        JOIN "profile"
          ON EXISTS (
            SELECT 1 FROM "user"
            WHERE "profile"."userId" = "user"."id"
              AND "user"."id" = "message"."authorId"
            LIMIT 1
          )
          AND "message"."text" = $1
      `,
      ['text'],
    );
  });

  it('should be selectable', () => {
    const query = db.message.select(
      'id',
      db.message.profile.where({ bio: 'bio' }),
    );
    expectSql(
      query.toSql(),
      `
        SELECT
          "message"."id",
          (
            SELECT row_to_json("t".*) AS "json"
            FROM (
              SELECT "profile".* FROM "profile"
              WHERE EXISTS (
                  SELECT 1 FROM "user"
                  WHERE "profile"."userId" = "user"."id"
                    AND "user"."id" = "message"."authorId"
                  LIMIT 1
                )
                AND "profile"."bio" = $1
              LIMIT $2
            ) AS "t"
          ) AS "profile"
        FROM "message"
      `,
      ['bio', 1],
    );
  });
});
