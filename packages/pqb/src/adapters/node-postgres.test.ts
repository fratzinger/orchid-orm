import { PoolClient } from 'pg';
import { NodePostgresAdapter } from './node-postgres';
import { testDbOptions } from 'test-utils';

interface MockQueryResult<Row = unknown> {
  rowCount: number;
  rows: Row[];
  fields: Array<{ name: string }>;
}

const makeQueryResult = <Row>(
  rows: Row[],
  columns: Array<{ name: string }>,
): MockQueryResult<Row> => ({
  rowCount: rows.length,
  rows,
  fields: columns,
});

type QuerySpy = jest.SpyInstance<Promise<unknown>, [unknown, ...unknown[]]>;

const spyOnQuery = (client: PoolClient): QuerySpy => {
  return jest.spyOn(
    client as unknown as {
      query: (query: unknown, ...args: unknown[]) => Promise<unknown>;
    },
    'query',
  ) as QuerySpy;
};

const issuedSql = (querySpy: QuerySpy): string[] =>
  querySpy.mock.calls
    .map((call) => call[0])
    .filter((value): value is string => typeof value === 'string');

describe('node-postgres', () => {
  afterEach(() => jest.clearAllMocks());

  describe('queryClient unit', () => {
    it('passes query config object and returns query result', async () => {
      const rawResult = makeQueryResult([{ one: 1 }], [{ name: 'one' }]);
      const client = {
        query: jest.fn(() => Promise.resolve(rawResult)),
      };

      const result = await NodePostgresAdapter.queryClient(
        client as unknown as PoolClient,
        'SELECT 1 AS one',
      );

      expect(client.query).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'SELECT 1 AS one',
          values: undefined,
          rowMode: undefined,
          types: expect.objectContaining({
            getTypeParser: expect.any(Function),
          }),
        }),
      );
      expect(result.rowCount).toBe(1);
      expect(result.rows[0]).toEqual({ one: 1 });
      expect(result.fields).toEqual([{ name: 'one' }]);
    });

    it('uses rowMode=array in arrays mode', async () => {
      const rawResult = makeQueryResult([[1]], [{ name: 'one' }]);
      const client = {
        query: jest.fn(() => Promise.resolve(rawResult)),
      };

      const result = await NodePostgresAdapter.queryClient(
        client as unknown as PoolClient,
        'SELECT 1 AS one',
        undefined,
        undefined,
        undefined,
        true,
      );

      expect(client.query).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'SELECT 1 AS one',
          values: undefined,
          rowMode: 'array',
        }),
      );
      expect(result.rowCount).toBe(1);
      expect(result.rows[0]).toEqual([1]);
      expect(result.fields).toEqual([{ name: 'one' }]);
    });

    it('rolls back to releasingSavepoint on failure', async () => {
      const error = new Error('query failed');
      const rollbackResult = makeQueryResult([], []);

      const client = {
        query: jest.fn((query: unknown) => {
          if (
            typeof query === 'object' &&
            query !== null &&
            'text' in query &&
            query.text === 'SELECT * FROM non_existing_table'
          ) {
            return Promise.reject(error);
          }

          if (query === 'ROLLBACK TO SAVEPOINT "sp"') {
            return Promise.resolve(rollbackResult);
          }

          return Promise.resolve(makeQueryResult([], []));
        }),
      };

      await expect(
        NodePostgresAdapter.queryClient(
          client as unknown as PoolClient,
          'SELECT * FROM non_existing_table',
          undefined,
          undefined,
          'sp',
        ),
      ).rejects.toBe(error);

      expect(client.query).toHaveBeenCalledWith('ROLLBACK TO SAVEPOINT "sp"');
    });
  });

  describe('queryClient integration', () => {
    let pool: ReturnType<typeof NodePostgresAdapter.configure>;

    beforeAll(() => {
      pool = NodePostgresAdapter.configure(testDbOptions);
    });

    afterAll(async () => {
      await NodePostgresAdapter.close(pool);
    });

    it('supports only startingSavepoint', async () => {
      await NodePostgresAdapter.begin<PoolClient, void>(
        pool,
        async (client) => {
          const querySpy = spyOnQuery(client);

          const result = await NodePostgresAdapter.queryClient(
            client,
            'SELECT 1',
            undefined,
            'start_sp',
          );

          expect(result.rowCount).toBe(1);
          expect(issuedSql(querySpy)).toEqual(
            expect.arrayContaining(['SAVEPOINT "start_sp"']),
          );
        },
      );
    });

    it('supports only releasingSavepoint after it was started earlier', async () => {
      await NodePostgresAdapter.begin<PoolClient, void>(
        pool,
        async (client) => {
          const querySpy = spyOnQuery(client);

          await NodePostgresAdapter.queryClient(
            client,
            'SELECT 1',
            undefined,
            'release_sp',
          );
          const result = await NodePostgresAdapter.queryClient(
            client,
            'SELECT 1',
            undefined,
            undefined,
            'release_sp',
          );

          expect(result.rowCount).toBe(1);
          expect(issuedSql(querySpy)).toEqual(
            expect.arrayContaining([
              'SAVEPOINT "release_sp"',
              'RELEASE SAVEPOINT "release_sp"',
            ]),
          );
        },
      );
    });

    it('supports both startingSavepoint and releasingSavepoint', async () => {
      await NodePostgresAdapter.begin<PoolClient, void>(
        pool,
        async (client) => {
          const querySpy = spyOnQuery(client);

          const result = await NodePostgresAdapter.queryClient(
            client,
            'SELECT 1',
            undefined,
            'both_sp',
            'both_sp',
          );

          expect(result.rowCount).toBe(1);
          expect(issuedSql(querySpy)).toEqual(
            expect.arrayContaining([
              'SAVEPOINT "both_sp"',
              'RELEASE SAVEPOINT "both_sp"',
            ]),
          );
        },
      );
    });

    it('rolls back to releasingSavepoint on failure and transaction remains queryable', async () => {
      await NodePostgresAdapter.begin<PoolClient, void>(
        pool,
        async (client) => {
          const querySpy = spyOnQuery(client);

          await NodePostgresAdapter.queryClient(
            client,
            'SELECT 1',
            undefined,
            'failing_sp',
          );

          let error: unknown;
          try {
            await NodePostgresAdapter.queryClient(
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
          expect(issuedSql(querySpy)).toEqual(
            expect.arrayContaining(['ROLLBACK TO SAVEPOINT "failing_sp"']),
          );

          const result = await NodePostgresAdapter.queryClient(
            client,
            'SELECT 1',
          );
          expect(result.rowCount).toBe(1);
        },
      );
    });
  });
});
