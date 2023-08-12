import {
  createSchemaMigrations,
  getDatabaseAndUserFromOptions,
  getFirstWordAndRest,
  processRakeDbConfig,
  getMigrations,
  getTextAfterTo,
  joinColumns,
  joinWords,
  quoteWithSchema,
  setAdapterOptions,
  setAdminCredentialsToOptions,
  sortAsc,
  sortDesc,
  AppCodeUpdater,
} from './common';
import prompts from 'prompts';
import { Adapter, columnTypes } from 'pqb';
import { readdir } from 'fs/promises';
import path from 'path';
import { asMock } from 'test-utils';
import { testConfig } from './rake-db.test-utils';

jest.mock('prompts', () => jest.fn());

jest.mock('fs/promises', () => ({
  readdir: jest.fn(),
}));

const config = testConfig;

describe('common', () => {
  describe('processRakeDbConfig', () => {
    it('should return config with defaults', () => {
      const result = processRakeDbConfig({
        basePath: __dirname,
        dbScript: 'dbScript.ts',
        migrationsPath: 'custom-path',
      });

      const migrationsPath = path.resolve(__dirname, 'custom-path');

      expect(result).toEqual({
        basePath: __dirname,
        dbScript: 'dbScript.ts',
        columnTypes,
        migrationsPath,
        recurrentPath: path.join(migrationsPath, 'recurrent'),
        migrationsTable: 'schemaMigrations',
        snakeCase: false,
        import: expect.any(Function),
        log: true,
        logger: console,
        useCodeUpdater: true,
        commands: {},
      });
    });

    it('should throw if appCodeUpdater is provided but baseTable is not', () => {
      expect(() =>
        processRakeDbConfig({
          appCodeUpdater: {} as unknown as AppCodeUpdater,
        }),
      ).toThrow(
        '`baseTable` option is required in `rakeDb` for `appCodeUpdater`',
      );
    });
  });

  describe('getDatabaseAndUserFromOptions', () => {
    it('should return data from databaseURL', () => {
      const result = getDatabaseAndUserFromOptions({
        databaseURL: 'postgres://user:password@localhost:5432/dbname',
      });

      expect(result).toEqual({
        database: 'dbname',
        user: 'user',
      });
    });

    it('should return data from options when no databaseURL', () => {
      const result = getDatabaseAndUserFromOptions({
        database: 'dbname',
        user: 'user',
      });

      expect(result).toEqual({
        database: 'dbname',
        user: 'user',
      });
    });
  });

  describe('setAdapterOptions', () => {
    it('should set options in databaseURL to postgres', () => {
      const result = setAdapterOptions(
        {
          databaseURL: 'postgres://user:password@localhost:5432/dbname',
        },
        {
          database: 'updated-db',
          user: 'updated-user',
          password: 'updated-password',
        },
      );

      expect(result).toEqual({
        databaseURL:
          'postgres://updated-user:updated-password@localhost:5432/updated-db',
      });
    });

    it('should set object options', () => {
      const result = setAdapterOptions(
        {
          database: 'dbname',
          user: 'user',
          password: 'password',
        },
        {
          database: 'updated-db',
          user: 'updated-user',
          password: 'updated-password',
        },
      );

      expect(result).toEqual({
        database: 'updated-db',
        user: 'updated-user',
        password: 'updated-password',
      });
    });
  });

  describe('setAdminCredentialsToOptions', () => {
    beforeEach(() => {
      asMock(prompts).mockResolvedValueOnce({
        confirm: true,
      });

      asMock(prompts).mockResolvedValueOnce({
        user: 'admin-user',
        password: 'admin-password',
      });
    });

    it('should set admin credentials to databaseURL', async () => {
      const result = await setAdminCredentialsToOptions({
        databaseURL: 'postgres://user:password@localhost:5432/dbname',
      });

      expect(result).toEqual({
        databaseURL:
          'postgres://admin-user:admin-password@localhost:5432/dbname',
      });
    });

    it('should set admin credentials to options', async () => {
      const result = await setAdminCredentialsToOptions({
        database: 'dbname',
        user: 'user',
        password: 'password',
      });

      expect(result).toEqual({
        database: 'dbname',
        user: 'admin-user',
        password: 'admin-password',
      });
    });
  });

  describe('createSchemaMigrations', () => {
    const mockedQuery = jest.fn();

    const db = new Adapter({
      databaseURL: 'postgres://user:password@host:1234/db-name',
    });
    db.query = mockedQuery;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should create a "schemaMigrations" table', async () => {
      mockedQuery.mockReturnValueOnce(undefined);

      await createSchemaMigrations(db, config);

      expect(mockedQuery.mock.calls).toEqual([
        [`CREATE TABLE "schemaMigrations" ( version TEXT NOT NULL )`],
      ]);

      expect(asMock(testConfig.logger.log).mock.calls).toEqual([
        ['Created versions table'],
      ]);
    });

    it('should inform if table already exists', async () => {
      mockedQuery.mockRejectedValueOnce({ code: '42P07' });

      await createSchemaMigrations(db, config);

      expect(mockedQuery.mock.calls).toEqual([
        [`CREATE TABLE "schemaMigrations" ( version TEXT NOT NULL )`],
      ]);

      expect(asMock(testConfig.logger.log).mock.calls).toEqual([
        ['Versions table exists'],
      ]);
    });

    it('should create a custom schema if config has a schema other than public', async () => {
      db.schema = 'custom';

      await createSchemaMigrations(db, config);

      expect(mockedQuery.mock.calls).toEqual([
        [`CREATE SCHEMA "custom"`],
        [`CREATE TABLE "schemaMigrations" ( version TEXT NOT NULL )`],
      ]);

      expect(asMock(testConfig.logger.log).mock.calls).toEqual([
        ['Created schema custom'],
        ['Created versions table'],
      ]);

      db.schema = undefined;
    });

    it('should be fine when the custom schema already exists', async () => {
      mockedQuery.mockRejectedValueOnce({ code: '42P06' });
      mockedQuery.mockResolvedValue(null);

      db.schema = 'custom';

      await createSchemaMigrations(db, config);

      expect(mockedQuery.mock.calls).toEqual([
        [`CREATE SCHEMA "custom"`],
        [`CREATE TABLE "schemaMigrations" ( version TEXT NOT NULL )`],
      ]);

      expect(asMock(testConfig.logger.log).mock.calls).toEqual([
        ['Created versions table'],
      ]);

      db.schema = undefined;
    });
  });

  describe('getFirstWordAndRest', () => {
    it('should return pair of first word and rest', () => {
      expect(getFirstWordAndRest('fooBarBaz')).toEqual(['foo', 'barBaz']);
      expect(getFirstWordAndRest('foo-barBaz')).toEqual(['foo', 'barBaz']);
      expect(getFirstWordAndRest('foo_barBaz')).toEqual(['foo', 'barBaz']);
    });

    it('should return input when it is a single word', () => {
      expect(getFirstWordAndRest('foo')).toEqual(['foo']);
    });
  });

  describe('getTextAfterTo', () => {
    it('should return text after To or to', () => {
      expect(getTextAfterTo('addColumnToTable')).toBe('table');
      expect(getTextAfterTo('add-column-to-table')).toBe('table');
      expect(getTextAfterTo('add_column_to_table')).toBe('table');
    });
  });

  describe('getMigrations', () => {
    it('should return migrations from a specified directory path', async () => {
      const version = '12345678901234';
      const files = [`${version}_a.ts`, `${version}_b.ts`, `${version}_c.ts`];
      (readdir as jest.Mock).mockReturnValueOnce(files);

      const result = await getMigrations(config, true);
      expect(result).toEqual(
        files.map((file) => ({
          path: path.resolve(config.migrationsPath, file),
          version,
          change: expect.any(Function),
        })),
      );
    });

    it('should return migrations from an object with migrations', async () => {
      const version = '12345678901234';

      const fn1 = async () => {};
      const fn2 = async () => {};

      const migrations = {
        [`${version}_a.ts`]: fn1,
        [`${version}_b.ts`]: fn2,
      };

      const result = await getMigrations({ ...config, migrations }, true);
      expect(result).toEqual([
        {
          path: path.resolve(__dirname, `${version}_a.ts`),
          version,
          change: fn1,
        },
        {
          path: path.resolve(__dirname, `${version}_b.ts`),
          version,
          change: fn2,
        },
      ]);
    });

    it('should return empty array on error', async () => {
      (readdir as jest.Mock).mockRejectedValue(new Error());

      const result = await getMigrations(config, true);
      expect(result).toEqual([]);
    });

    it('should skip files (or dirs) without extension', async () => {
      (readdir as jest.Mock).mockRejectedValue(['dir']);

      const result = await getMigrations(config, true);
      expect(result).toEqual([]);
    });

    it('should throw if file is not a .ts or .js file', async () => {
      (readdir as jest.Mock).mockReturnValueOnce(['file.c']);

      await expect(getMigrations(config, true)).rejects.toThrow(
        'Only .ts and .js files are supported',
      );
    });

    it('should throw on improper version', async () => {
      (readdir as jest.Mock).mockReturnValueOnce(['1234567890_file.ts']);

      await expect(getMigrations(config, true)).rejects.toThrow(
        'Migration file name should start with 14 digit version',
      );
    });
  });

  describe('sortAsc', () => {
    it('should sort ascending', () => {
      expect(sortAsc(['a', 'c', 'b'])).toEqual(['a', 'b', 'c']);
    });
  });

  describe('sortDesc', () => {
    it('should sort descending', () => {
      expect(sortDesc(['a', 'c', 'b'])).toEqual(['c', 'b', 'a']);
    });
  });

  describe('joinWords', () => {
    it('should join words', () => {
      expect(joinWords('foo', 'bar', 'baz')).toEqual('fooBarBaz');
    });
  });

  describe('joinColumns', () => {
    it('should join columns', () => {
      expect(joinColumns(['a', 'b', 'c'])).toBe('"a", "b", "c"');
    });
  });

  describe('quoteWithSchema', () => {
    it('should quote a name', () => {
      expect(quoteWithSchema({ name: 'table' })).toBe('"table"');
    });

    it('should quote a name with schema', () => {
      expect(quoteWithSchema({ schema: 'schema', name: 'table' })).toBe(
        '"schema"."table"',
      );
    });
  });
});
