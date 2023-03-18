import { updateTableFile } from './updateTableFile';
import { asMock, ast, makeTestWritten, tablePath } from '../testUtils';
import { resolve, dirname } from 'path';
import fs from 'fs/promises';
import { columnTypes } from 'pqb';
import { pathToLog } from 'orchid-core';

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
}));

const t = columnTypes;

const baseTablePath = resolve('baseTable.ts');
const baseTableName = 'BaseTable';
const log = jest.fn();
const params = {
  baseTablePath,
  baseTableName,
  tablePath,
  logger: { ...console, log },
};

const path = tablePath('some');
const testWrittenOnly = makeTestWritten(path);
const testWritten = (content: string) => {
  testWrittenOnly(content);
  expect(log).toBeCalledWith(`Created ${pathToLog(path)}`);
};

const template = ({
  schema,
  columns,
  noPrimaryKey,
}: {
  schema?: string;
  columns: string;
  noPrimaryKey?: boolean;
}) => `import { BaseTable } from '../baseTable';

export class SomeTable extends BaseTable {
  ${schema ? `schema = '${schema}';\n  ` : ''}readonly table = 'some';${
  noPrimaryKey ? '\n  noPrimaryKey = true;' : ''
}
  columns = this.setColumns((t) => (${columns}));
}
`;

describe('createTable', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should add table', async () => {
    await updateTableFile({
      ...params,
      ast: {
        ...ast.addTable,
        schema: 'schema',
        shape: {},
      },
    });

    expect(asMock(fs.mkdir)).toBeCalledWith(dirname(tablePath('some')), {
      recursive: true,
    });

    testWritten(
      template({
        schema: 'schema',
        columns: `{

  }`,
      }),
    );
  });

  it('should add table with primary key, indexes, foreign keys', async () => {
    await updateTableFile({
      ...params,
      ast: {
        ...ast.addTable,
        primaryKey: {
          columns: ['one', 'two'],
          options: { name: 'name' },
        },
        indexes: [
          {
            columns: [{ column: 'one' }, { column: 'two' }],
            options: { name: 'indexName', unique: true },
          },
        ],
        foreignKeys: [
          {
            columns: ['one', 'two'],
            fnOrTable: 'some',
            foreignColumns: ['three', 'four'],
            options: { name: 'foreignKeyName' },
          },
        ],
      },
    });

    testWritten(
      template({
        columns: `{
    id: t.serial().primaryKey(),
    ...t.primaryKey(['one', 'two'], { name: 'name' }),
    ...t.index(['one', 'two'], {
      name: 'indexName',
      unique: true,
    }),
    ...t.foreignKey(
      ['one', 'two'],
      'some',
      ['three', 'four'],
      {
        name: 'foreignKeyName',
      },
    ),
  }`,
      }),
    );
  });

  it('should add table with columns', async () => {
    await updateTableFile({
      ...params,
      ast: {
        ...ast.addTable,
        shape: {
          column: t.name('name').integer(),
          domain: t.domain('domainName').as(t.integer()),
        },
      },
    });

    testWritten(
      template({
        columns: `{
    column: t.name('name').integer(),
    domain: t.domain('domainName').as(t.integer()),
  }`,
      }),
    );
  });

  it('should add noPrimaryKey prop when noPrimaryKey is `ignore` in ast', async () => {
    await updateTableFile({
      ...params,
      ast: { ...ast.addTable, noPrimaryKey: 'ignore' },
    });

    testWritten(
      template({
        noPrimaryKey: true,
        columns: `{
    id: t.serial().primaryKey(),
  }`,
      }),
    );
  });

  it('should create file with wx flag', async () => {
    asMock(fs.writeFile).mockRejectedValue(
      Object.assign(new Error(), { code: 'EEXIST' }),
    );

    await updateTableFile({ ...params, ast: ast.addTable });

    const [, , options] = asMock(fs.writeFile).mock.calls[0];
    expect(options).toEqual({ flag: 'wx' });
  });
});
