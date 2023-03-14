import { astToMigration } from './astToMigration';
import { columnTypes } from 'pqb';
import { RakeDbAst } from '../ast';
import { processRakeDbConfig } from '../common';
import { RakeDbEnumColumn } from './structureToAst';

const template = (content: string) => `import { change } from 'rake-db';

change(async (db) => {
${content}
});
`;

const schema: RakeDbAst.Schema = {
  type: 'schema',
  action: 'create',
  name: 'schemaName',
};

const extension: RakeDbAst.Extension = {
  type: 'extension',
  action: 'create',
  name: 'extensionName',
};

const enumType: RakeDbAst.Enum = {
  type: 'enum',
  action: 'create',
  name: 'mood',
  values: ['sad', 'ok', 'happy'],
};

const table: RakeDbAst.Table = {
  type: 'table',
  action: 'create',
  schema: 'schema',
  name: 'table',
  noPrimaryKey: 'ignore',
  indexes: [],
  foreignKeys: [],
  shape: {
    id: columnTypes.serial().primaryKey(),
  },
};

const foreignKey: RakeDbAst.ForeignKey = {
  type: 'foreignKey',
  action: 'create',
  tableName: 'table',
  columns: ['otherId'],
  fnOrTable: 'otherTable',
  foreignColumns: ['id'],
  options: {},
};

const config = processRakeDbConfig({
  migrationsPath: 'migrations',
});

describe('astToMigration', () => {
  beforeEach(jest.clearAllMocks);

  it('should return undefined when ast is empty', () => {
    const result = astToMigration(config, []);

    expect(result).toBe(undefined);
  });

  it('should put schema, extension, enum to first change, tables to separate changes, foreignKeys in last change', () => {
    const result = astToMigration(config, [
      schema,
      extension,
      enumType,
      {
        ...table,
        shape: {
          ...table.shape,
          enum: new RakeDbEnumColumn({}, enumType.name, enumType.values),
        },
      },
      { ...table, name: 'other' },
      foreignKey,
    ]);

    expect(result).toBe(`import { change } from 'rake-db';

change(async (db) => {
  await db.createSchema('schemaName');

  await db.createExtension('extensionName');

  await db.createEnum('mood', ['sad', 'ok', 'happy']);
});

change(async (db) => {
  await db.createTable('schema.table', (t) => ({
    id: t.serial().primaryKey(),
    enum: t.enum('mood'),
  }));
});

change(async (db) => {
  await db.createTable('schema.other', (t) => ({
    id: t.serial().primaryKey(),
  }));
});

change(async (db) => {
  await db.addForeignKey(
    'table',
    ['otherId'],
    'otherTable',
    ['id'],
  );
});
`);
  });

  it('should create schema', () => {
    const result = astToMigration(config, [schema]);

    expect(result).toBe(template(`  await db.createSchema('schemaName');`));
  });

  it('should create extension', () => {
    const result = astToMigration(config, [
      {
        ...extension,
        schema: 'schema',
        version: '123',
      },
    ]);

    expect(result).toBe(
      template(`  await db.createExtension('extensionName', {
    schema: 'schema',
    version: '123',
  });`),
    );
  });

  it('should create enum', () => {
    const result = astToMigration(config, [
      {
        ...enumType,
        schema: 'schema',
      },
    ]);

    expect(result).toBe(
      template(`  await db.createEnum('mood', ['sad', 'ok', 'happy'], {
    schema: 'schema',
  });`),
    );
  });

  describe('table', () => {
    it('should create table', () => {
      const result = astToMigration(config, [table]);

      expect(result).toBe(
        template(`  await db.createTable('schema.table', (t) => ({
    id: t.serial().primaryKey(),
  }));`),
      );
    });

    it('should add columns with indexes and foreignKeys', () => {
      const result = astToMigration(config, [
        {
          ...table,
          shape: {
            someId: columnTypes
              .integer()
              .unique({ name: 'indexName' })
              .foreignKey('otherTable', 'otherId', {
                name: 'fkey',
                match: 'FULL',
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
              }),
          },
        },
      ]);

      expect(result).toBe(`import { change } from 'rake-db';

change(async (db) => {
  await db.createTable('schema.table', (t) => ({
    someId: t.integer().foreignKey('otherTable', 'otherId', {
      name: 'fkey',
      match: 'FULL',
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    }).unique({
      name: 'indexName',
    }),
  }));
});
`);
    });

    it('should add composite primaryKeys, indexes, foreignKeys', () => {
      const result = astToMigration(config, [
        {
          ...table,
          shape: {
            id: columnTypes.serial().primaryKey(),
          },
          primaryKey: { columns: ['id', 'name'], options: { name: 'pkey' } },
          indexes: [
            {
              columns: [{ column: 'id' }, { column: 'name' }],
              options: { name: 'index', unique: true },
            },
          ],
          foreignKeys: [
            {
              columns: ['id', 'name'],
              fnOrTable: 'otherTable',
              foreignColumns: ['otherId', 'otherName'],
              options: {
                name: 'fkey',
                match: 'FULL',
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
              },
            },
          ],
        },
      ]);

      expect(result).toBe(
        template(`  await db.createTable('schema.table', (t) => ({
    id: t.serial().primaryKey(),
    ...t.primaryKey(['id', 'name'], { name: 'pkey' }),
    ...t.index(['id', 'name'], {
      name: 'index',
      unique: true,
    }),
    ...t.foreignKey(
      ['id', 'name'],
      'otherTable',
      ['otherId', 'otherName'],
      {
        name: 'fkey',
        match: 'FULL',
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
    ),
  }));`),
      );
    });
  });

  describe('foreignKey', () => {
    it('should add standalone foreignKey', () => {
      const result = astToMigration(config, [
        {
          ...foreignKey,
          tableSchema: 'custom',
          options: {
            name: 'fkey',
            match: 'FULL',
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
        },
      ]);

      expect(result).toBe(
        template(`  await db.addForeignKey(
    'custom.table',
    ['otherId'],
    'otherTable',
    ['id'],
    {
      name: 'fkey',
      match: 'FULL',
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
  );`),
      );
    });
  });
});