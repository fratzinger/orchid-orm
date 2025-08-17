import { createDb, dropDb, resetDb } from './createOrDrop';
import { Adapter } from 'pqb';
import { fullMigrate } from './migrateOrRollback';
import { testConfig } from '../rake-db.test-utils';
import { asMock } from 'test-utils';
import { RecordUnknown } from 'orchid-core';
import { setAdminCredentialsToOptions } from './createOrDrop.utils';
import { createMigrationsTable } from '../migration/migrationsTable';

jest.mock('./createOrDrop.utils.ts', () => ({
  ...jest.requireActual('./createOrDrop.utils.ts'),
  setAdminCredentialsToOptions: jest.fn((options: RecordUnknown) => ({
    ...options,
    user: 'admin-user',
    password: 'admin-password',
  })),
}));

jest.mock('../migration/migrationsTable', () => ({
  createMigrationsTable: jest.fn(),
}));

jest.mock('./migrateOrRollback', () => ({
  fullMigrate: jest.fn(),
}));

const options = { database: 'dbname', user: 'user', password: 'password' };
const queryMock = jest.fn();
Adapter.prototype.query = queryMock;

const config = testConfig;
const logMock = asMock(testConfig.logger.log);

describe('createOrDrop', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createDb', () => {
    it('should create a database without a specified user', async () => {
      queryMock.mockResolvedValueOnce(undefined);

      await createDb([{ ...options, user: undefined }], config);

      expect(queryMock.mock.calls).toEqual([[`CREATE DATABASE "dbname"`]]);

      expect(logMock.mock.calls).toEqual([
        [`Database dbname successfully created`],
      ]);

      expect(createMigrationsTable).toHaveBeenCalled();
    });

    it('should create database when user is an admin', async () => {
      queryMock.mockResolvedValueOnce(undefined);

      await createDb([options], config);

      expect(queryMock.mock.calls).toEqual([
        [`CREATE DATABASE "dbname" OWNER "user"`],
      ]);
      expect(logMock.mock.calls).toEqual([
        [`Database dbname successfully created`],
      ]);
      expect(createMigrationsTable).toHaveBeenCalled();
    });

    it('should create databases for each provided option', async () => {
      queryMock.mockResolvedValue(undefined);

      await createDb(
        [options, { ...options, database: 'dbname-test' }],
        config,
      );

      expect(queryMock.mock.calls).toEqual([
        [`CREATE DATABASE "dbname" OWNER "user"`],
        [`CREATE DATABASE "dbname-test" OWNER "user"`],
      ]);
      expect(logMock.mock.calls).toEqual([
        [`Database dbname successfully created`],
        [`Database dbname-test successfully created`],
      ]);
      expect(createMigrationsTable).toHaveBeenCalledTimes(2);
    });

    it('should inform if database already exists', async () => {
      queryMock.mockRejectedValueOnce({ code: '42P04' });

      await createDb([options], config);

      expect(queryMock.mock.calls).toEqual([
        [`CREATE DATABASE "dbname" OWNER "user"`],
      ]);
      expect(logMock.mock.calls).toEqual([[`Database dbname already exists`]]);
      expect(createMigrationsTable).toHaveBeenCalled();
    });

    it('should inform if ssl is required', async () => {
      queryMock.mockRejectedValueOnce({
        code: 'XX000',
        message: 'sslmode=require',
      });

      await createDb([options], config);

      expect(queryMock.mock.calls).toEqual([
        [`CREATE DATABASE "dbname" OWNER "user"`],
      ]);
      expect(logMock.mock.calls).toEqual([
        ['SSL is required: append ?ssl=true to the database url string'],
      ]);
      expect(createMigrationsTable).not.toHaveBeenCalled();
    });

    it('should ask and use admin credentials when cannot connect', async () => {
      queryMock.mockRejectedValueOnce({ code: '42501' });

      await createDb([options], config);

      expect(setAdminCredentialsToOptions).toHaveBeenCalled();
      expect(queryMock.mock.calls).toEqual([
        [`CREATE DATABASE "dbname" OWNER "user"`],
        [`CREATE DATABASE "dbname" OWNER "user"`],
      ]);
      expect(logMock.mock.calls).toEqual([
        [
          `Permission denied to create database.\nDon't use this command for database service providers, only for a local db.`,
        ],
        [`Database dbname successfully created`],
      ]);
      expect(createMigrationsTable).toHaveBeenCalled();
    });
  });

  describe('dropDb', () => {
    it('should drop database when user is an admin', async () => {
      queryMock.mockResolvedValueOnce(undefined);

      await dropDb([options], config);

      expect(queryMock.mock.calls).toEqual([[`DROP DATABASE "dbname"`]]);
      expect(logMock.mock.calls).toEqual([
        [`Database dbname was successfully dropped`],
      ]);
    });

    it('should drop databases for each provided option', async () => {
      queryMock.mockResolvedValue(undefined);

      await dropDb([options, { ...options, database: 'dbname-test' }], config);

      expect(queryMock.mock.calls).toEqual([
        [`DROP DATABASE "dbname"`],
        [`DROP DATABASE "dbname-test"`],
      ]);
      expect(logMock.mock.calls).toEqual([
        [`Database dbname was successfully dropped`],
        [`Database dbname-test was successfully dropped`],
      ]);
    });

    it('should inform if database does not exist', async () => {
      queryMock.mockRejectedValueOnce({ code: '3D000' });

      await dropDb([options], config);

      expect(queryMock.mock.calls).toEqual([[`DROP DATABASE "dbname"`]]);
      expect(logMock.mock.calls).toEqual([[`Database dbname does not exist`]]);
    });

    it('should inform if ssl is required', async () => {
      queryMock.mockRejectedValueOnce({
        code: 'XX000',
        message: 'sslmode=require',
      });

      await createDb([options], config);

      expect(queryMock.mock.calls).toEqual([
        [`CREATE DATABASE "dbname" OWNER "user"`],
      ]);
      expect(logMock.mock.calls).toEqual([
        ['SSL is required: append ?ssl=true to the database url string'],
      ]);
      expect(createMigrationsTable).not.toHaveBeenCalled();
    });

    it('should ask and use admin credentials when cannot connect', async () => {
      queryMock.mockRejectedValueOnce({ code: '42501' });

      await dropDb([options], config);

      expect(setAdminCredentialsToOptions).toHaveBeenCalled();
      expect(queryMock.mock.calls).toEqual([
        [`DROP DATABASE "dbname"`],
        [`DROP DATABASE "dbname"`],
      ]);
      expect(logMock.mock.calls).toEqual([
        [
          `Permission denied to drop database.\nDon't use this command for database service providers, only for a local db.`,
        ],
        [`Database dbname was successfully dropped`],
      ]);
    });
  });

  describe('reset', () => {
    it('should drop and create database', async () => {
      queryMock.mockResolvedValue(undefined);

      await resetDb([options], config);

      expect(queryMock.mock.calls).toEqual([
        [`DROP DATABASE "dbname"`],
        [`CREATE DATABASE "dbname" OWNER "user"`],
      ]);
      expect(logMock.mock.calls).toEqual([
        [`Database dbname was successfully dropped`],
        [`Database dbname successfully created`],
      ]);
      expect(createMigrationsTable).toHaveBeenCalled();
      expect(fullMigrate).toBeCalled();
    });
  });
});
