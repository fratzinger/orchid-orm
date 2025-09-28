import { User, userData } from '../../test-utils/test-utils';
import {
  assertType,
  sql,
  testDb,
  TestTransactionAdapter,
  useTestDatabase,
} from 'test-utils';

const TableWithReadOnly = testDb('user', (t) => ({
  id: t.identity().primaryKey(),
  name: t.string(),
  password: t.integer().readOnly(),
}));

const emulateReturnNoRowsOnce = () => {
  // emulate the edge case when first query doesn't find the record, and then in CTE it appears
  const { query } = TestTransactionAdapter.prototype;
  TestTransactionAdapter.prototype.query = async function (
    this: unknown,
    text: string,
    values?: unknown[],
  ) {
    const result = await query.call(this, text, values);
    result.rowCount = 0;
    TestTransactionAdapter.prototype.query = query;
    return result;
  } as never;
};

describe('upsert', () => {
  useTestDatabase();

  it('should not allow using appReadOnly columns in update', () => {
    expect(() =>
      TableWithReadOnly.find(1).upsert({
        update: {
          // @ts-expect-error password is readOnly
          password: 'password',
        },
        create: { name: 'name' },
      }),
    ).toThrow('Trying to update a readonly column');
  });

  it('should not allow using appReadOnly columns in data', () => {
    expect(() =>
      TableWithReadOnly.find(1).upsert({
        data: {
          // @ts-expect-error password is readOnly
          password: 'password',
        },
        create: { name: 'name' },
      }),
    ).toThrow('Trying to update a readonly column');
  });

  it('should not allow using appReadOnly columns in create', async () => {
    await expect(() =>
      TableWithReadOnly.find(1).upsert({
        update: { name: 'name' },
        create: {
          name: 'name',
          // @ts-expect-error password is readOnly
          password: 'password',
        },
      }),
    ).rejects.toThrow('Trying to insert a readonly column');
  });

  it('should return void by default', () => {
    const q = User.find(1).upsert({
      update: { name: 'name' },
      create: userData,
    });

    assertType<Awaited<typeof q>, void>();
  });

  it('should update record if exists, should support sql and sub-queries', async () => {
    const { id } = await User.create(userData);

    const user = await User.selectAll()
      .find(id)
      .upsert({
        update: {
          data: { name: 'updated', tags: ['tag'] },
          age: () => sql`28`,
          name: () =>
            User.create({
              ...userData,
              name: 'updated',
            }).get('name'),
        },
        create: userData,
      });

    expect(user).toMatchObject({
      name: 'updated',
      age: 28,
      data: { name: 'updated', tags: ['tag'] },
    });
  });

  it('should create record if not exists, should support sql and sub-queries', async () => {
    const user = await User.selectAll()
      .find(123)
      .upsert({
        update: {
          name: 'updated',
        },
        create: {
          data: { name: 'created', tags: ['tag'] },
          password: 'password',
          age: () => sql`28`,
          name: () =>
            User.create({
              ...userData,
              name: 'created',
            }).get('name'),
        },
      });

    expect(user).toMatchObject({
      data: { name: 'created', tags: ['tag'] },
      age: 28,
      name: 'created',
    });
  });

  it('should create record and return a single value', async () => {
    const id = await User.find(1)
      .upsert({
        update: {},
        create: userData,
      })
      .get('id');

    assertType<typeof id, number>();

    expect(id).toEqual(expect.any(Number));
  });

  it('should create record if not exists with a data from a callback', async () => {
    const user = await User.selectAll()
      .find(123)
      .upsert({
        update: {
          name: 'updated',
        },
        create: () => ({ ...userData, name: 'created' }),
      });

    expect(user.name).toBe('created');
  });

  describe('empty update', () => {
    const UserWithoutTimestamps = testDb('user', (t) => ({
      id: t.serial().primaryKey(),
      name: t.text(),
      password: t.text(),
    }));

    it('should not create record if it exists', async () => {
      const { id } = await UserWithoutTimestamps.create(userData);

      const user = await UserWithoutTimestamps.selectAll()
        .find(id)
        .upsert({
          update: {},
          create: {
            name: 'new name',
            password: 'new password',
          },
        });

      expect(user.id).toBe(id);
    });

    it('should create record if not exists', async () => {
      const user = await UserWithoutTimestamps.selectAll()
        .find(1)
        .upsert({
          update: {},
          create: {
            name: 'created',
            password: 'new password',
          },
        });

      expect(user.name).toBe('created');
    });
  });

  it('should throw if more than one row was updated', async () => {
    await User.createMany([userData, userData]);

    await expect(
      User.findBy({ name: userData.name }).upsert({
        update: {
          name: 'updated',
        },
        create: userData,
      }),
    ).rejects.toThrow();
  });

  it('should inject update data into create function', async () => {
    const created = await User.find(1)
      .select('*')
      .upsert({
        update: {
          name: 'name',
        },
        create: (data) => ({
          ...data,
          password: 'password',
        }),
      });

    expect(created).toMatchObject({
      name: 'name',
    });

    expect(created).not.toMatchObject({
      password: 'password',
    });
  });

  it('should use `data` for both update and create', async () => {
    const created = await User.find(1)
      .select('*')
      .upsert({
        data: {
          name: 'name',
        },
        create: {
          password: 'password',
        },
      });

    expect(created).toMatchObject({
      name: 'name',
    });

    expect(created).not.toMatchObject({
      password: 'password',
    });
  });

  it('should use `data` for both update and create with function', async () => {
    const created = await User.find(1).upsert({
      data: {
        name: 'name',
      },
      create: (data) => ({
        password: data.name,
      }),
    });

    assertType<typeof created, void>();

    expect(created).toBe(undefined);
  });

  it('should call both before hooks, after update hooks when updated, should return void by default', async () => {
    await User.create(userData);

    const beforeUpdate = jest.fn();
    const afterUpdate = jest.fn();
    const afterUpdateCommit = jest.fn();
    const beforeCreate = jest.fn();
    const afterCreate = jest.fn();
    const afterCreateCommit = jest.fn();

    emulateReturnNoRowsOnce();

    const res = await User.findBy({ name: 'name' })
      .upsert({
        data: userData,
        create: userData,
      })
      .beforeUpdate(beforeUpdate)
      .afterUpdate(['id'], afterUpdate)
      .afterUpdateCommit(['name'], afterUpdateCommit)
      .beforeCreate(beforeCreate)
      .afterCreate(['password'], afterCreate)
      .afterCreateCommit(['age'], afterCreateCommit);

    assertType<typeof res, void>();
    expect(res).toBe(undefined);

    expect(beforeUpdate).toHaveBeenCalledTimes(1);
    expect(afterUpdate).toHaveBeenCalledWith(
      [
        {
          id: expect.any(Number),
          name: 'name',
          password: 'password',
          age: null,
        },
      ],
      expect.any(Object),
    );
    expect(afterUpdateCommit).toHaveBeenCalledWith(
      [
        {
          id: expect.any(Number),
          name: 'name',
          password: 'password',
          age: null,
        },
      ],
      expect.any(Object),
    );
    expect(beforeCreate).toHaveBeenCalledTimes(1);
    expect(afterCreate).not.toHaveBeenCalled();
    expect(afterCreateCommit).not.toHaveBeenCalled();
  });

  it('should call both before hooks, after update hooks when updated, should return selected columns', async () => {
    await User.create(userData);

    const beforeUpdate = jest.fn();
    const afterUpdate = jest.fn();
    const afterUpdateCommit = jest.fn();
    const beforeCreate = jest.fn();
    const afterCreate = jest.fn();
    const afterCreateCommit = jest.fn();

    emulateReturnNoRowsOnce();

    const res = await User.findBy({ name: 'name' })
      .select('id')
      .upsert({
        data: userData,
        create: userData,
      })
      .beforeUpdate(beforeUpdate)
      .afterUpdate(['id'], afterUpdate)
      .afterUpdateCommit(['name'], afterUpdateCommit)
      .beforeCreate(beforeCreate)
      .afterCreate(['password'], afterCreate)
      .afterCreateCommit(['age'], afterCreateCommit);

    assertType<typeof res, { id: number }>();
    expect(res).toEqual({ id: expect.any(Number) });

    expect(beforeUpdate).toHaveBeenCalledTimes(1);
    expect(afterUpdate).toHaveBeenCalledWith(
      [
        {
          id: expect.any(Number),
          name: 'name',
          password: 'password',
          age: null,
        },
      ],
      expect.any(Object),
    );
    expect(afterUpdateCommit).toHaveBeenCalledWith(
      [
        {
          id: expect.any(Number),
          name: 'name',
          password: 'password',
          age: null,
        },
      ],
      expect.any(Object),
    );
    expect(beforeCreate).toHaveBeenCalledTimes(1);
    expect(afterCreate).not.toHaveBeenCalled();
    expect(afterCreateCommit).not.toHaveBeenCalled();
  });

  it('should call after create hooks when created', async () => {
    const beforeUpdate = jest.fn();
    const afterUpdate = jest.fn();
    const afterUpdateCommit = jest.fn();
    const beforeCreate = jest.fn();
    const afterCreate = jest.fn();
    const afterCreateCommit = jest.fn();

    const res = await User.findBy({ name: 'name' })
      .upsert({
        data: userData,
        create: userData,
      })
      .beforeUpdate(beforeUpdate)
      .afterUpdate(['id'], afterUpdate)
      .afterUpdateCommit(['name'], afterUpdateCommit)
      .beforeCreate(beforeCreate)
      .afterCreate(['password'], afterCreate)
      .afterCreateCommit(['age'], afterCreateCommit);

    assertType<typeof res, void>();
    expect(res).toBe(undefined);

    expect(beforeUpdate).toHaveBeenCalledTimes(1);
    expect(afterUpdate).not.toHaveBeenCalled();
    expect(afterUpdateCommit).not.toHaveBeenCalled();
    expect(beforeCreate).toHaveBeenCalledTimes(1);
    expect(afterCreate).toHaveBeenCalledWith(
      [
        {
          id: expect.any(Number),
          name: 'name',
          password: 'password',
          age: null,
        },
      ],
      expect.any(Object),
    );
    expect(afterCreateCommit).toHaveBeenCalledWith(
      [
        {
          id: expect.any(Number),
          name: 'name',
          password: 'password',
          age: null,
        },
      ],
      expect.any(Object),
    );
  });
});
