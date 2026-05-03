import postgres from 'postgres';
import { PostgresJsAdapter } from './postgres-js';
import { testDbOptions } from 'test-utils';

class MockRawResult extends Array<unknown> {
  count: number;
  statement: {
    columns: Array<{ name: string }>;
  };

  constructor(rows: unknown[], columns: Array<{ name: string }>) {
    super(...rows);
    this.count = rows.length;
    this.statement = { columns };
  }
}

const makeRawResult = (
  rows: unknown[],
  columns: Array<{ name: string }>,
): MockRawResult => new MockRawResult(rows, columns);

type UnsafeSpy = jest.SpyInstance<unknown, [string, ...unknown[]]>;

const spyOnUnsafe = (client: postgres.TransactionSql): UnsafeSpy => {
  return jest.spyOn(
    client as unknown as {
      unsafe: (text: string, ...args: unknown[]) => unknown;
    },
    'unsafe',
  ) as UnsafeSpy;
};

const issuedSql = (unsafeSpy: UnsafeSpy): string[] =>
  unsafeSpy.mock.calls.map((call) => call[0]);

describe('postgres-js', () => {
  afterEach(() => jest.clearAllMocks());

  describe('queryClient unit', () => {
    it('wraps non-arrays query result', async () => {
      const rawResult = makeRawResult([{ one: 1 }], [{ name: 'one' }]);
      const client = {
        unsafe: jest.fn(() => Promise.resolve(rawResult)),
      };

      const result = await PostgresJsAdapter.queryClient(
        client as unknown as postgres.TransactionSql,
        'SELECT 1 AS one',
      );

      expect(client.unsafe).toHaveBeenCalledWith('SELECT 1 AS one', undefined);
      expect(result.rowCount).toBe(1);
      expect(result.rows[0]).toEqual({ one: 1 });
      expect(result.fields).toEqual([{ name: 'one' }]);
    });

    it('uses values() in arrays mode', async () => {
      const objectResult = makeRawResult([{ one: 1 }], [{ name: 'one' }]);
      const arraysResult = makeRawResult([[1]], [{ name: 'one' }]);

      const query = Promise.resolve(objectResult) as Promise<MockRawResult> & {
        values: jest.Mock;
      };
      query.values = jest.fn(() => Promise.resolve(arraysResult));

      const client = {
        unsafe: jest.fn(() => query),
      };

      const result = await PostgresJsAdapter.queryClient(
        client as unknown as postgres.TransactionSql,
        'SELECT 1 AS one',
        undefined,
        undefined,
        undefined,
        true,
      );

      expect(query.values).toHaveBeenCalledTimes(1);
      expect(result.rowCount).toBe(1);
      expect(result.rows[0]).toEqual([1]);
      expect(result.fields).toEqual([{ name: 'one' }]);
    });

    it('rolls back to releasingSavepoint on failure', async () => {
      const error = new Error('query failed');
      const rollbackResult = makeRawResult([], []);

      const client = {
        unsafe: jest.fn((text: string) => {
          if (text === 'SELECT * FROM non_existing_table') {
            return Promise.reject(error);
          }

          if (text === 'ROLLBACK TO SAVEPOINT "sp"') {
            return Promise.resolve(rollbackResult);
          }

          return Promise.resolve(makeRawResult([], []));
        }),
      };

      await expect(
        PostgresJsAdapter.queryClient(
          client as unknown as postgres.TransactionSql,
          'SELECT * FROM non_existing_table',
          undefined,
          undefined,
          'sp',
        ),
      ).rejects.toBe(error);

      expect(client.unsafe).toHaveBeenCalledWith('ROLLBACK TO SAVEPOINT "sp"');
    });
  });

  describe('queryClient integration', () => {
    let sql: postgres.Sql;

    beforeAll(() => {
      sql = PostgresJsAdapter.configure(testDbOptions);
    });

    afterAll(async () => {
      await PostgresJsAdapter.close(sql);
    });

    it('supports only startingSavepoint', async () => {
      await PostgresJsAdapter.begin<postgres.TransactionSql, void>(
        sql,
        async (client) => {
          const unsafeSpy = spyOnUnsafe(client);

          const result = await PostgresJsAdapter.queryClient(
            client,
            'SELECT 1',
            undefined,
            'start_sp',
          );

          expect(result.rowCount).toBe(1);
          expect(issuedSql(unsafeSpy)).toEqual(
            expect.arrayContaining(['SAVEPOINT "start_sp"']),
          );
        },
      );
    });

    it('supports only releasingSavepoint after it was started earlier', async () => {
      await PostgresJsAdapter.begin<postgres.TransactionSql, void>(
        sql,
        async (client) => {
          const unsafeSpy = spyOnUnsafe(client);

          await PostgresJsAdapter.queryClient(
            client,
            'SELECT 1',
            undefined,
            'release_sp',
          );
          const result = await PostgresJsAdapter.queryClient(
            client,
            'SELECT 1',
            undefined,
            undefined,
            'release_sp',
          );

          expect(result.rowCount).toBe(1);
          expect(issuedSql(unsafeSpy)).toEqual(
            expect.arrayContaining([
              'SAVEPOINT "release_sp"',
              'RELEASE SAVEPOINT "release_sp"',
            ]),
          );
        },
      );
    });

    it('supports both startingSavepoint and releasingSavepoint', async () => {
      await PostgresJsAdapter.begin<postgres.TransactionSql, void>(
        sql,
        async (client) => {
          const unsafeSpy = spyOnUnsafe(client);

          const result = await PostgresJsAdapter.queryClient(
            client,
            'SELECT 1',
            undefined,
            'both_sp',
            'both_sp',
          );

          expect(result.rowCount).toBe(1);
          expect(issuedSql(unsafeSpy)).toEqual(
            expect.arrayContaining([
              'SAVEPOINT "both_sp"',
              'RELEASE SAVEPOINT "both_sp"',
            ]),
          );
        },
      );
    });

    it('rolls back to releasingSavepoint on failure and transaction remains queryable', async () => {
      await PostgresJsAdapter.begin<postgres.TransactionSql, void>(
        sql,
        async (client) => {
          const unsafeSpy = spyOnUnsafe(client);

          await PostgresJsAdapter.queryClient(
            client,
            'SELECT 1',
            undefined,
            'failing_sp',
          );

          let error: unknown;
          try {
            await PostgresJsAdapter.queryClient(
              client,
              'SELECT * FROM non_existing_table',
              undefined,
              undefined,
              'failing_sp',
            );
          } catch (err) {
            error = err;
          }

          expect(error).toBeInstanceOf(Error);
          expect(issuedSql(unsafeSpy)).toEqual(
            expect.arrayContaining(['ROLLBACK TO SAVEPOINT "failing_sp"']),
          );

          const result = await PostgresJsAdapter.queryClient(
            client,
            'SELECT 1',
          );
          expect(result.rowCount).toBe(1);
        },
      );
    });
  });
});
