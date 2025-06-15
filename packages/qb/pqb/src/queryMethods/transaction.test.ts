import pg, { Client } from 'pg';
import { assertType, testDb, useTestDatabase } from 'test-utils';
import { User, userColumnsSql, userData } from '../test-utils/test-utils';
import { noop } from 'orchid-core';
import { AfterCommitError } from './transaction';

const afterCommitSampleError = {
  hookResults: [
    {
      name: 'one',
      status: 'fulfilled',
      value: 'hook ok',
    },
    {
      name: 'two',
      status: 'rejected',
      reason: expect.objectContaining({
        message: 'error',
      }),
    },
  ],
};

describe('transaction', () => {
  beforeEach(() => jest.clearAllMocks());
  afterAll(testDb.close);

  it('should start and commit transaction', async () => {
    const spy = jest.spyOn(pg.Client.prototype, 'query');

    const result = await testDb.transaction(async () => {
      const {
        rows: [{ a }],
      } = await testDb.query`SELECT 1 AS a`;
      const {
        rows: [{ b }],
      } = await testDb.query`SELECT 2 AS b`;
      return (a + b) as number;
    });

    assertType<typeof result, number>();

    expect(result).toBe(3);

    expect(
      spy.mock.calls.map(
        (call) => (call[0] as unknown as { text: string }).text,
      ),
    ).toEqual(['BEGIN', 'SELECT 1 AS a', 'SELECT 2 AS b', 'COMMIT']);
  });

  it('should rollback if error happens', async () => {
    const spy = jest.spyOn(pg.Client.prototype, 'query');

    let error: Error | undefined;

    await testDb
      .transaction(async () => {
        throw new Error('error');
      })
      .catch((err) => (error = err));

    expect(error?.message).toBe('error');

    expect(
      spy.mock.calls.map(
        (call) => (call[0] as unknown as { text: string }).text,
      ),
    ).toEqual(['BEGIN', 'ROLLBACK']);
  });

  it('should accept isolation level and options', async () => {
    const spy = jest.spyOn(pg.Client.prototype, 'query');

    await testDb.transaction('REPEATABLE READ', async () => {});
    await testDb.transaction(
      {
        level: 'READ COMMITTED',
        readOnly: false,
        deferrable: false,
      },
      async () => {},
    );
    await testDb.transaction(
      {
        level: 'READ UNCOMMITTED',
        readOnly: true,
        deferrable: true,
      },
      async () => {},
    );

    expect(
      spy.mock.calls.map(
        (call) => (call[0] as unknown as { text: string }).text,
      ),
    ).toEqual([
      'BEGIN ISOLATION LEVEL REPEATABLE READ',
      'COMMIT',
      'BEGIN ISOLATION LEVEL READ COMMITTED READ WRITE NOT DEFERRABLE',
      'COMMIT',
      'BEGIN ISOLATION LEVEL READ UNCOMMITTED READ ONLY DEFERRABLE',
      'COMMIT',
    ]);
  });

  it('should run a nested transaction with SAVEPOINT and RELEASE SAVEPOINT', async () => {
    const query = jest.spyOn(Client.prototype, 'query');

    const result = await testDb.transaction(
      async () =>
        await testDb.transaction(async () =>
          testDb.queryBuilder.get(testDb.sql`123`),
        ),
    );

    expect(result).toBe(123);

    expect(
      query.mock.calls.map(
        (call) => (call[0] as unknown as { text: string }).text,
      ),
    ).toEqual([
      'BEGIN',
      'SAVEPOINT "1"',
      'SELECT 123 LIMIT 1',
      'RELEASE SAVEPOINT "1"',
      'COMMIT',
    ]);
  });

  it('should rollback a nested transaction with ROLLBACK TO SAVEPOINT', async () => {
    const query = jest.spyOn(Client.prototype, 'query');

    await expect(() =>
      testDb.transaction(
        async () =>
          await testDb.transaction(async () => {
            throw new Error('error');
          }),
      ),
    ).rejects.toThrow('error');

    expect(
      query.mock.calls.map(
        (call) => (call[0] as unknown as { text: string }).text,
      ),
    ).toEqual([
      'BEGIN',
      'SAVEPOINT "1"',
      'ROLLBACK TO SAVEPOINT "1"',
      'ROLLBACK',
    ]);
  });

  it('should expose a `client` object of the database adapter', async () => {
    let client: unknown;
    await testDb.transaction(async () => {
      client = testDb.internal.transactionStorage.getStore()?.adapter.client;
    });

    expect(client).toBeInstanceOf(Client);
  });

  describe('log option', () => {
    it('should log all the queries inside a transaction', async () => {
      const log = jest.spyOn(console, 'log').mockImplementation(noop);

      await testDb.transaction({ log: true }, async () => {
        await User.log(false); // transaction log overrides query's log
        await testDb.query`SELECT 1 AS a`;
      });

      expect(log.mock.calls).toEqual([
        [expect.stringContaining(`BEGIN`)],
        [expect.stringContaining(`SELECT ${userColumnsSql} FROM "user"`)],
        [expect.stringContaining(`SELECT 1 AS a`)],
        [expect.stringContaining(`COMMIT`)],
      ]);
    });
  });

  describe('ensureTransaction', () => {
    it('should not start another transaction when already inside a transaction', async () => {
      const spy = jest.spyOn(pg.Client.prototype, 'query');

      const result = await testDb.transaction(async () => {
        return testDb.ensureTransaction(async () => {
          const {
            rows: [{ a }],
          } = await testDb.query`SELECT 1 AS a`;
          const {
            rows: [{ b }],
          } = await testDb.query`SELECT 2 AS b`;

          return a + b;
        });
      });

      expect(result).toBe(3);

      expect(
        spy.mock.calls.map(
          (call) => (call[0] as unknown as { text: string }).text,
        ),
      ).toEqual(['BEGIN', 'SELECT 1 AS a', 'SELECT 2 AS b', 'COMMIT']);
    });

    it('should start a transaction if it was not started yet', async () => {
      const spy = jest.spyOn(pg.Client.prototype, 'query');

      const result = await testDb.ensureTransaction(async () => {
        const {
          rows: [{ a }],
        } = await testDb.query`SELECT 1 AS a`;
        const {
          rows: [{ b }],
        } = await testDb.query`SELECT 2 AS b`;

        return (a + b) as number;
      });

      assertType<typeof result, number>();

      expect(result).toBe(3);

      expect(
        spy.mock.calls.map(
          (call) => (call[0] as unknown as { text: string }).text,
        ),
      ).toEqual(['BEGIN', 'SELECT 1 AS a', 'SELECT 2 AS b', 'COMMIT']);
    });
  });

  describe('isInTransaction', () => {
    it("should indicate whether we're inside a transaction", async () => {
      expect(testDb.isInTransaction()).toBe(false);

      await testDb.transaction(async () => {
        expect(testDb.isInTransaction()).toBe(true);
      });

      expect(testDb.isInTransaction()).toBe(false);
    });

    describe('in testTransaction', () => {
      useTestDatabase();

      it('should trick testTransaction into thinking that we are not in transaction on the top level', async () => {
        expect(testDb.isInTransaction()).toBe(false);

        await testDb.transaction(async () => {
          expect(testDb.isInTransaction()).toBe(true);
        });
      });
    });
  });

  describe('afterCommit hooks', () => {
    useTestDatabase();

    it('should not make the transaction wait for afterCommit hook to finish', async () => {
      let hookCalled = false;
      let hookAwaited = false;

      const result = await User.transaction(async () => {
        await User.insert(userData).afterCreateCommit([], async () => {
          hookCalled = true;
          await new Promise((resolve) => process.nextTick(resolve));
          hookAwaited = true;
        });

        return 'ok';
      });

      expect(result).toBe('ok');
      expect(hookCalled).toBe(true);
      expect(hookAwaited).toBe(false);
    });

    it('should catch afterCommit errors with catchAfterCommitError, should call all catches even if any of them fails', async () => {
      const catcher1 = jest.fn(() => {
        throw new Error('catcher error');
      });
      const catcher2 = jest.fn();

      const result = await User.transaction(async () => {
        await User.insert(userData)
          .afterCreateCommit([], function one() {
            return 'hook ok';
          })
          .afterCreateCommit([], function two() {
            throw new Error('error');
          })
          .catchAfterCommitError(catcher1)
          .catchAfterCommitError(catcher2);

        return 'ok';
      });

      expect(result).toBe('ok');

      await new Promise(queueMicrotask);

      expect(catcher1).toBeCalledTimes(1);
      expect(catcher2).toBeCalledTimes(1);

      const err = (catcher1.mock.calls[0] as unknown as [unknown])[0];
      expect(err).toBeInstanceOf(AfterCommitError);
      expect(err).toMatchObject({
        ...afterCommitSampleError,
        result: 'ok',
      });
    });
  });

  describe('afterCommit standalone hook', () => {
    it('should run all afterCommit hook after the outermost transaction commit', async () => {
      const hook1 = jest.fn();
      const hook2 = jest.fn();
      const hook3 = jest.fn();

      await User.transaction(async () => {
        await User.transaction(async () => {
          testDb.afterCommit(hook1);
          testDb.afterCommit(hook2);
        });
        testDb.afterCommit(hook3);

        expect(hook1).not.toHaveBeenCalled();
        expect(hook2).not.toHaveBeenCalled();
        expect(hook3).not.toHaveBeenCalled();
      });

      expect(hook1).toHaveBeenCalled();
      expect(hook2).toHaveBeenCalled();
      expect(hook3).toHaveBeenCalled();
    });

    it('should not run if the transaction fails', async () => {
      const hook1 = jest.fn();
      const hook2 = jest.fn();

      await User.transaction(async () => {
        await User.transaction(async () => {
          testDb.afterCommit(hook1);
        });
        testDb.afterCommit(hook2);

        throw new Error('error');
      }).catch(() => {});

      expect(hook1).not.toHaveBeenCalled();
      expect(hook2).not.toHaveBeenCalled();
    });

    it('should run in next microtask when not in transaction', async () => {
      const hook = jest.fn();

      testDb.afterCommit(hook);

      expect(hook).not.toHaveBeenCalled();

      await new Promise(queueMicrotask);

      expect(hook).toHaveBeenCalled();
    });
  });
});

describe('hooks with no test transaction', () => {
  beforeEach(() => {
    jest
      .spyOn(User.adapter, 'query')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce({ rowCount: 1, rows: [] } as any);
  });

  it('should not make the transaction wait for afterCommit hook to finish', async () => {
    let hookCalled = false;
    let hookAwaited = false;

    const result = await User.all()
      .delete()
      .afterDeleteCommit([], async () => {
        hookCalled = true;
        await new Promise((resolve) => process.nextTick(resolve));
        hookAwaited = true;
      });

    expect(result).toBe(1);
    expect(hookCalled).toBe(true);
    expect(hookAwaited).toBe(false);
  });

  it('should catch afterCommit errors with catchAfterCommitError, should call all catchers even if any of them fails', async () => {
    const catcher1 = jest.fn(() => {
      throw new Error('catcher error');
    });
    const catcher2 = jest.fn();

    const result = await User.all()
      .delete()
      .afterDeleteCommit([], function one() {
        return 'hook ok';
      })
      .afterDeleteCommit([], function two() {
        throw new Error('error');
      })
      .catchAfterCommitError(catcher1)
      .catchAfterCommitError(catcher2);

    expect(result).toBe(1);

    await new Promise(queueMicrotask);

    expect(catcher1).toBeCalledTimes(1);
    expect(catcher2).toBeCalledTimes(1);

    const err = (catcher1.mock.calls[0] as unknown as [unknown])[0];
    expect(err).toBeInstanceOf(AfterCommitError);
    expect(err).toMatchObject({
      ...afterCommitSampleError,
      result: [{}],
    });
  });
});
