import { createDb } from '../db';
import { adapter, dbOptions } from '../test-utils';
import { logColors } from './log';
import { noop } from '../utils';

describe('query log', () => {
  it('should not have `log` query object by default', () => {
    const db = createDb(dbOptions);

    expect(db('user').query.log).toBe(undefined);
  });

  it('should set `log` query object when configuring db instance', () => {
    const db = createDb({
      ...dbOptions,
      log: true,
    });

    expect(db('user').query.log).toBeTruthy();
  });

  it('should set `log` query object for a table', () => {
    const db = createDb(dbOptions);
    const table = db('user', undefined, { log: true });

    expect(table.query.log).toBeTruthy();
  });

  it('should set `log` query object with query method', () => {
    const db = createDb(dbOptions);
    const table = db('user');

    expect(table.log().query.log).toBeTruthy();
  });

  it('should log elapsed time, sql and binding values', async () => {
    const hrtime = jest.spyOn(process, 'hrtime');
    hrtime.mockReturnValueOnce([0, 0]);
    hrtime.mockReturnValueOnce([1, 1000000]);

    const logger = {
      log: jest.fn(),
      error: jest.fn(),
    };

    const db = createDb(adapter, { log: true, logger });

    await db('user').where({ name: 'name' });

    expect(logger.log.mock.calls).toEqual([
      [
        `${logColors.boldCyanBright('(1s 1.0ms)')} ${logColors.boldBlue(
          `SELECT "user".* FROM "user" WHERE "user"."name" = $1`,
        )} ${logColors.boldYellow(`['name']`)}`,
      ],
    ]);
  });

  it('should log elapsed time, sql and binding values without colors', async () => {
    const hrtime = jest.spyOn(process, 'hrtime');
    hrtime.mockReturnValueOnce([0, 0]);
    hrtime.mockReturnValueOnce([1, 1000000]);

    const logger = {
      log: jest.fn(),
      error: jest.fn(),
    };

    const db = createDb(adapter, { log: { colors: false }, logger });

    await db('user').where({ name: 'name' });

    expect(logger.log.mock.calls).toEqual([
      [
        `(1s 1.0ms) SELECT "user".* FROM "user" WHERE "user"."name" = $1 ['name']`,
      ],
    ]);
  });

  it('should log in red in case of error', async () => {
    const hrtime = jest.spyOn(process, 'hrtime');
    hrtime.mockReturnValueOnce([0, 0]);
    hrtime.mockReturnValueOnce([1, 1000000]);

    const logger = {
      log: jest.fn(),
      error: jest.fn(),
    };

    const db = createDb(adapter, { log: true, logger });

    await db('user').where({ wrongColumn: 'value' }).then(noop, noop);

    expect(logger.error.mock.calls).toEqual([
      [
        `${logColors.boldMagenta('(1s 1.0ms)')} ${logColors.boldRed(
          `SELECT "user".* FROM "user" WHERE "user"."wrongColumn" = $1`,
        )} ${logColors.boldYellow(`['value']`)} ${logColors.boldRed(
          'Error: column user.wrongColumn does not exist',
        )}`,
      ],
    ]);
  });

  it('should log in red in case of error without colors', async () => {
    const hrtime = jest.spyOn(process, 'hrtime');
    hrtime.mockReturnValueOnce([0, 0]);
    hrtime.mockReturnValueOnce([1, 1000000]);

    const logger = {
      log: jest.fn(),
      error: jest.fn(),
    };

    const db = createDb(adapter, { log: { colors: false }, logger });

    await db('user').where({ wrongColumn: 'value' }).then(noop, noop);

    expect(logger.error.mock.calls).toEqual([
      [
        `(1s 1.0ms) SELECT "user".* FROM "user" WHERE "user"."wrongColumn" = $1 ['value'] Error: column user.wrongColumn does not exist`,
      ],
    ]);
  });
});
