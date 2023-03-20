import { asMock, expectSql, getDb, resetDb, toLine } from '../test-utils';

const db = getDb();

const testUpAndDown = async (
  fn: (action: 'createTable' | 'dropTable') => Promise<void> | void,
  expectUp?: () => void,
  expectDown: () => void = () => expectSql(`DROP TABLE "table"`),
) => {
  resetDb(true);
  await fn('createTable');
  expectUp?.();

  resetDb(false);
  await fn('createTable');
  expectUp && expectDown();

  resetDb(true);

  await fn('dropTable');
  expectUp && expectDown();

  resetDb(false);
  await fn('dropTable');
  expectUp?.();
};

describe('create and drop table', () => {
  beforeEach(() => {
    db.options.snakeCase = false;
  });

  it('should push ast to migratedAsts', async () => {
    await testUpAndDown(
      (action) =>
        db[action]('name', (t) => ({
          id: t.serial().primaryKey(),
        })),
      () => expect(db.migratedAsts.length).toBe(1),
      () => expect(db.migratedAsts.length).toBe(1),
    );
  });

  it('should handle table with schema', async () => {
    await testUpAndDown(
      (action) =>
        db[action]('schema.name', (t) => ({ id: t.serial().primaryKey() })),
      () =>
        expectSql(`
            CREATE TABLE "schema"."name" (
              "id" serial PRIMARY KEY
            )
          `),
      () =>
        expectSql(`
            DROP TABLE "schema"."name"
          `),
    );
  });

  it('should handle table with comment', async () => {
    await testUpAndDown(
      (action) =>
        db[action]('table', { comment: 'this is a table comment' }, (t) => ({
          id: t.serial().primaryKey(),
        })),
      () =>
        expectSql([
          `
              CREATE TABLE "table" (
                "id" serial PRIMARY KEY
              )
            `,
          `COMMENT ON TABLE "table" IS 'this is a table comment'`,
        ]),
    );
  });

  it('should support drop table cascade', async () => {
    await testUpAndDown(
      (action) =>
        db[action]('table', { dropMode: 'CASCADE' }, (t) => ({
          id: t.serial().primaryKey(),
        })),
      () =>
        expectSql(`
          CREATE TABLE "table" (
            "id" serial PRIMARY KEY
          )
        `),
      () =>
        expectSql(`
          DROP TABLE "table" CASCADE
        `),
    );
  });

  describe('columns', () => {
    it('should handle table columns', async () => {
      await testUpAndDown(
        (action) =>
          db[action]('table', (t) => ({
            id: t.serial().primaryKey(),
            nullable: t.text().nullable(),
            nonNullable: t.text(),
            citext: t.citext(),
            varcharWithLength: t.varchar(20),
            decimalWithPrecisionAndScale: t.decimal(10, 5),
            columnWithCompression: t.text().compression('compression'),
            columnWithCollate: t.text().collate('utf-8'),
          })),
        () => {
          expectSql(
            `
            CREATE TABLE "table" (
              "id" serial PRIMARY KEY,
              "nullable" text,
              "nonNullable" text NOT NULL,
              "citext" citext NOT NULL,
              "varcharWithLength" varchar(20) NOT NULL,
              "decimalWithPrecisionAndScale" decimal(10, 5) NOT NULL,
              "columnWithCompression" text COMPRESSION compression NOT NULL,
              "columnWithCollate" text COLLATE 'utf-8' NOT NULL
            )
          `,
          );
        },
        () => {
          expectSql(
            `
            DROP TABLE "table"
          `,
          );
        },
      );
    });

    it('should handle columns in snakeCase mode', async () => {
      await testUpAndDown(
        (action) =>
          db[action]('table', { snakeCase: true }, (t) => ({
            id: t.serial().primaryKey(),
            columnName: t.text(),
          })),
        () =>
          expectSql(`
            CREATE TABLE "table" (
              "id" serial PRIMARY KEY,
              "column_name" text NOT NULL
            )
          `),
      );
    });
  });

  it('should handle enum column', async () => {
    const enumRows = [['one'], ['two']];

    await testUpAndDown(
      (action) => {
        asMock(db.adapter.arrays).mockResolvedValueOnce({ rows: enumRows });

        return db[action]('table', (t) => ({
          id: t.serial().primaryKey(),
          enum: t.enum('mood'),
        }));
      },
      () => {
        expectSql([
          'SELECT unnest(enum_range(NULL::"mood"))::text',
          `
            CREATE TABLE "table" (
              "id" serial PRIMARY KEY,
              "enum" "mood" NOT NULL
            )
          `,
        ]);
      },
      () => {
        expectSql([
          'SELECT unnest(enum_range(NULL::"mood"))::text',
          `
            DROP TABLE "table"
          `,
        ]);
      },
    );
  });

  it('should handle columns with defaults', async () => {
    await testUpAndDown(
      (action) =>
        db[action]('table', (t) => ({
          id: t.serial().primaryKey(),
          withDefault: t.boolean().default(false),
          withDefaultRaw: t.date().default(t.raw(`now()`)),
        })),
      () =>
        expectSql(
          `
            CREATE TABLE "table" (
              "id" serial PRIMARY KEY,
              "withDefault" boolean NOT NULL DEFAULT false,
              "withDefaultRaw" date NOT NULL DEFAULT now()
            )
          `,
        ),
    );
  });

  describe('indexes', () => {
    it('should handle indexes', async () => {
      await testUpAndDown(
        (action) =>
          db[action]('table', (t) => ({
            id: t.serial().primaryKey(),
            withIndex: t.text().index({
              name: 'indexName',
              unique: true,
              using: 'gin',
              collate: 'utf-8',
              opclass: 'opclass',
              order: 'ASC',
              include: 'id',
              with: 'fillfactor = 70',
              tablespace: 'tablespace',
              where: 'column = 123',
            }),
            uniqueColumn: t.text().unique(),
          })),
        () =>
          expectSql([
            `
              CREATE TABLE "table" (
                "id" serial PRIMARY KEY,
                "withIndex" text NOT NULL,
                "uniqueColumn" text NOT NULL
              )
            `,
            toLine(`
              CREATE UNIQUE INDEX "indexName"
                ON "table"
                USING gin
                ("withIndex" COLLATE 'utf-8' opclass ASC)
                INCLUDE ("id")
                WITH (fillfactor = 70)
                TABLESPACE tablespace
                WHERE column = 123
            `),
            toLine(`
              CREATE UNIQUE INDEX "table_uniqueColumn_idx"
                ON "table"
                ("uniqueColumn")
            `),
          ]),
      );
    });

    it('should handle indexes in snakeCase mode', async () => {
      db.options.snakeCase = true;

      await testUpAndDown(
        (action) =>
          db[action]('table', (t) => ({
            id: t.serial().primaryKey(),
            withIndex: t.text().index(),
            uniqueColumn: t.text().unique(),
          })),
        () =>
          expectSql([
            `
              CREATE TABLE "table" (
                "id" serial PRIMARY KEY,
                "with_index" text NOT NULL,
                "unique_column" text NOT NULL
              )
            `,
            toLine(`
              CREATE INDEX "table_with_index_idx" ON "table" ("with_index")
            `),
            toLine(`
              CREATE UNIQUE INDEX "table_unique_column_idx" ON "table" ("unique_column")
            `),
          ]),
      );
    });
  });

  describe('foreign key', () => {
    it('should handle columns with foreign key', async () => {
      await testUpAndDown(
        (action) =>
          db[action]('table', (t) => ({
            id: t.serial().primaryKey(),
            columnWithForeignKey: t.integer().foreignKey('table', 'column', {
              name: 'fkeyConstraint',
              match: 'FULL',
              onUpdate: 'CASCADE',
              onDelete: 'CASCADE',
            }),
          })),
        () =>
          expectSql(
            `
              CREATE TABLE "table" (
                "id" serial PRIMARY KEY,
                "columnWithForeignKey" integer NOT NULL CONSTRAINT "fkeyConstraint" REFERENCES "table"("column") MATCH FULL ON DELETE CASCADE ON UPDATE CASCADE
              )
            `,
          ),
      );
    });

    it('should handle column with foreign key in snakeCase mode', async () => {
      db.options.snakeCase = true;

      await testUpAndDown(
        (action) =>
          db[action]('table', (t) => ({
            id: t.serial().primaryKey(),
            columnWithForeignKey: t
              .integer()
              .foreignKey('table', 'otherColumn'),
          })),
        () =>
          expectSql(`
              CREATE TABLE "table" (
                "id" serial PRIMARY KEY,
                "column_with_foreign_key" integer NOT NULL REFERENCES "table"("other_column")
              )
          `),
      );
    });
  });

  describe('timestamps', () => {
    it('should handle timestamps', async () => {
      await testUpAndDown(
        (action) =>
          db[action]('table', (t) => ({
            id: t.serial().primaryKey(),
            ...t.timestamps(),
          })),
        () =>
          expectSql(`
            CREATE TABLE "table" (
              "id" serial PRIMARY KEY,
              "createdAt" timestamp NOT NULL DEFAULT now(),
              "updatedAt" timestamp NOT NULL DEFAULT now()
            )
          `),
      );
    });

    it('should handle timestamps in snake case mode', async () => {
      await testUpAndDown(
        async (action) => {
          db.options.snakeCase = true;

          await db[action]('table', (t) => ({
            id: t.serial().primaryKey(),
            ...t.timestamps(),
          }));

          db.options.snakeCase = false;
        },
        () =>
          expectSql(`
          CREATE TABLE "table" (
            "id" serial PRIMARY KEY,
            "created_at" timestamp NOT NULL DEFAULT now(),
            "updated_at" timestamp NOT NULL DEFAULT now()
          )
        `),
      );
    });
  });

  it('should handle column with explicit name', async () => {
    await testUpAndDown(
      (action) =>
        db[action]('table', (t) => ({
          columnKey: t.name('its_a_columnName').serial().primaryKey(),
        })),
      () =>
        expectSql(`
          CREATE TABLE "table" (
            "its_a_columnName" serial PRIMARY KEY
          )
        `),
    );
  });

  describe('column comment', () => {
    it('should handle column comment', async () => {
      await testUpAndDown(
        (action) =>
          db[action]('table', (t) => ({
            id: t.serial().primaryKey().comment('this is a column comment'),
          })),
        () =>
          expectSql([
            `
            CREATE TABLE "table" (
              "id" serial PRIMARY KEY
            )
          `,
            `COMMENT ON COLUMN "table"."id" IS 'this is a column comment'`,
          ]),
      );
    });

    it('should handle column comment in snakeCase mode', async () => {
      db.options.snakeCase = true;

      await testUpAndDown(
        (action) =>
          db[action]('table', (t) => ({
            columnName: t
              .serial()
              .primaryKey()
              .comment('this is a column comment'),
          })),
        () =>
          expectSql([
            `
            CREATE TABLE "table" (
              "column_name" serial PRIMARY KEY
            )
          `,
            `COMMENT ON COLUMN "table"."column_name" IS 'this is a column comment'`,
          ]),
      );
    });
  });

  describe('composite primary key', () => {
    it('should support composite primary key defined on multiple columns', async () => {
      await testUpAndDown(
        (action) =>
          db[action]('table', (t) => ({
            id: t.integer().primaryKey(),
            name: t.text().primaryKey(),
            active: t.boolean().primaryKey(),
          })),
        () =>
          expectSql(`
            CREATE TABLE "table" (
              "id" integer NOT NULL,
              "name" text NOT NULL,
              "active" boolean NOT NULL,
              PRIMARY KEY ("id", "name", "active")
            )
          `),
      );
    });

    it('should support composite primary key defined on table', async () => {
      await testUpAndDown(
        (action) =>
          db[action]('table', (t) => ({
            id: t.integer(),
            name: t.text(),
            active: t.boolean(),
            ...t.primaryKey(['id', 'name', 'active']),
          })),
        () =>
          expectSql(`
          CREATE TABLE "table" (
            "id" integer NOT NULL,
            "name" text NOT NULL,
            "active" boolean NOT NULL,
            PRIMARY KEY ("id", "name", "active")
          )
        `),
      );
    });

    it('should support composite primary key with constraint name', async () => {
      await testUpAndDown(
        (action) =>
          db[action]('table', (t) => ({
            id: t.integer(),
            name: t.text(),
            active: t.boolean(),
            ...t.primaryKey(['id', 'name', 'active'], {
              name: 'primaryKeyName',
            }),
          })),
        () =>
          expectSql(`
          CREATE TABLE "table" (
            "id" integer NOT NULL,
            "name" text NOT NULL,
            "active" boolean NOT NULL,
            CONSTRAINT "primaryKeyName" PRIMARY KEY ("id", "name", "active")
          )
        `),
      );
    });

    it('should support composite primary key defined on table and multiple columns', async () => {
      await testUpAndDown(
        (action) =>
          db[action]('table', (t) => ({
            id: t.integer().primaryKey(),
            name: t.text().primaryKey(),
            active: t.boolean().primaryKey(),
            another: t.date(),
            one: t.decimal(),
            ...t.primaryKey(['another', 'one']),
          })),
        () =>
          expectSql(`
            CREATE TABLE "table" (
              "id" integer NOT NULL,
              "name" text NOT NULL,
              "active" boolean NOT NULL,
              "another" date NOT NULL,
              "one" decimal NOT NULL,
              PRIMARY KEY ("id", "name", "active", "another", "one")
            )
          `),
      );
    });

    it('should support composite primary key defined on multiple columns', async () => {
      db.options.snakeCase = true;

      await testUpAndDown(
        (action) =>
          db[action]('table', (t) => ({
            idColumn: t.integer().primaryKey(),
            nameColumn: t.text().primaryKey(),
            activeColumn: t.boolean().primaryKey(),
            anotherColumn: t.date(),
            oneColumn: t.decimal(),
            ...t.primaryKey(['anotherColumn', 'oneColumn']),
          })),
        () =>
          expectSql(`
            CREATE TABLE "table" (
              "id_column" integer NOT NULL,
              "name_column" text NOT NULL,
              "active_column" boolean NOT NULL,
              "another_column" date NOT NULL,
              "one_column" decimal NOT NULL,
              PRIMARY KEY ("id_column", "name_column", "active_column", "another_column", "one_column")
            )
          `),
      );
    });
  });

  describe('composite index', () => {
    it('should support composite index', async () => {
      await testUpAndDown(
        (action) =>
          db[action]('table', (t) => ({
            id: t.serial().primaryKey(),
            name: t.text(),
            ...t.index(['id', { column: 'name', order: 'DESC' }], {
              name: 'compositeIndexOnTable',
            }),
          })),
        () =>
          expectSql([
            `
              CREATE TABLE "table" (
                "id" serial PRIMARY KEY,
                "name" text NOT NULL
              )
            `,
            `
              CREATE INDEX "compositeIndexOnTable" ON "table" ("id", "name" DESC)
            `,
          ]),
      );
    });

    it('should support composite unique index', async () => {
      await testUpAndDown(
        (action) =>
          db[action]('table', (t) => ({
            id: t.serial().primaryKey(),
            name: t.text(),
            ...t.unique(['id', { column: 'name', order: 'DESC' }], {
              name: 'compositeIndexOnTable',
            }),
          })),
        () =>
          expectSql([
            `
              CREATE TABLE "table" (
                "id" serial PRIMARY KEY,
                "name" text NOT NULL
              )
            `,
            `
              CREATE UNIQUE INDEX "compositeIndexOnTable" ON "table" ("id", "name" DESC)
            `,
          ]),
      );
    });

    it('should support composite index and composite unique index in snakeCase mode', async () => {
      db.options.snakeCase = true;

      await testUpAndDown(
        (action) =>
          db[action]('table', (t) => ({
            idColumn: t.serial().primaryKey(),
            nameColumn: t.text(),
            ...t.index(['idColumn', { column: 'nameColumn', order: 'DESC' }]),
            ...t.unique(['idColumn', { column: 'nameColumn', order: 'DESC' }]),
          })),
        () =>
          expectSql([
            `
              CREATE TABLE "table" (
                "id_column" serial PRIMARY KEY,
                "name_column" text NOT NULL
              )
            `,
            `
              CREATE INDEX "table_id_column_name_column_idx" ON "table" ("id_column", "name_column" DESC)
            `,
            `
              CREATE UNIQUE INDEX "table_id_column_name_column_idx" ON "table" ("id_column", "name_column" DESC)
            `,
          ]),
      );
    });
  });

  describe('composite foreign key', () => {
    it('should support composite foreign key', async () => {
      await testUpAndDown(
        (action) =>
          db[action]('table', (t) => ({
            id: t.serial().primaryKey(),
            name: t.text(),
            ...t.foreignKey(
              ['id', 'name'],
              'otherTable',
              ['foreignId', 'foreignName'],
              {
                name: 'constraintName',
                match: 'FULL',
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
              },
            ),
          })),
        () => {
          expectSql(`
            CREATE TABLE "table" (
              "id" serial PRIMARY KEY,
              "name" text NOT NULL,
              ${toLine(`
                CONSTRAINT "constraintName"
                  FOREIGN KEY ("id", "name")
                  REFERENCES "otherTable"("foreignId", "foreignName")
                  MATCH FULL
                  ON DELETE CASCADE
                  ON UPDATE CASCADE
              `)}
            )
          `);
        },
      );
    });

    it('should support composite foreign key in snakeCase mode', async () => {
      db.options.snakeCase = true;

      await testUpAndDown(
        (action) =>
          db[action]('table', (t) => ({
            idColumn: t.serial().primaryKey(),
            nameColumn: t.text(),
            ...t.foreignKey(['idColumn', 'nameColumn'], 'otherTable', [
              'foreignId',
              'foreignName',
            ]),
          })),
        () => {
          expectSql(`
            CREATE TABLE "table" (
              "id_column" serial PRIMARY KEY,
              "name_column" text NOT NULL,
              ${toLine(`
                CONSTRAINT "table_id_column_name_column_fkey"
                  FOREIGN KEY ("id_column", "name_column")
                  REFERENCES "otherTable"("foreign_id", "foreign_name")
              `)}
            )
          `);
        },
      );
    });
  });

  it('should support database check on the column', async () => {
    await testUpAndDown(
      (action) =>
        db[action]('table', (t) => ({
          id: t.serial().primaryKey(),
          columnWithCheck: t
            .text()
            .check(t.raw('length("columnWithCheck") > 10')),
        })),
      () =>
        expectSql(`
          CREATE TABLE "table" (
            "id" serial PRIMARY KEY,
            "columnWithCheck" text NOT NULL CHECK (length("columnWithCheck") > 10)
          )
        `),
    );
  });

  it('should support column of custom type', async () => {
    await testUpAndDown(
      (action) =>
        db[action]('table', (t) => ({
          id: t.serial().primaryKey(),
          column: t.type('customType'),
        })),
      () =>
        expectSql(`
          CREATE TABLE "table" (
            "id" serial PRIMARY KEY,
            "column" "customType" NOT NULL
          )
        `),
    );
  });

  it('should support domain column', async () => {
    await testUpAndDown(
      (action) =>
        db[action]('table', (t) => ({
          id: t.serial().primaryKey(),
          domainColumn: t.domain('domainName'),
        })),
      () =>
        expectSql(`
          CREATE TABLE "table" (
            "id" serial PRIMARY KEY,
            "domainColumn" "domainName" NOT NULL
          )
        `),
    );
  });

  describe('noPrimaryKey', () => {
    const { warn } = console;
    afterAll(() => {
      db.options.noPrimaryKey = undefined;
      console.warn = warn;
    });

    it('should throw by default when no primary key', async () => {
      await testUpAndDown((action) =>
        expect(() => db[action]('table', () => ({}))).rejects.toThrow(
          'Table table has no primary key.\nYou can suppress this error by setting { noPrimaryKey: true } after a table name.',
        ),
      );
    });

    it('should throw when no primary key and noPrimaryKey is set to `error`', async () => {
      await testUpAndDown((action) => {
        db.options.noPrimaryKey = 'error';

        return expect(() => db[action]('table', () => ({}))).rejects.toThrow(
          'Table table has no primary key.\nYou can suppress this error by setting { noPrimaryKey: true } after a table name.',
        );
      });
    });

    it('should warn when no primary key and noPrimaryKey is set to `warning`', async () => {
      await testUpAndDown((action) => {
        console.warn = jest.fn();
        db.options.noPrimaryKey = 'warning';

        db[action]('table', () => ({}));

        expect(console.warn).toBeCalledWith(
          'Table table has no primary key.\nYou can suppress this error by setting { noPrimaryKey: true } after a table name.',
        );
      });
    });

    it('should not throw when no primary key and noPrimaryKey is set to `ignore`', async () => {
      await testUpAndDown((action) => {
        db.options.noPrimaryKey = 'ignore';

        expect(() => db[action]('table', () => ({}))).not.toThrow();
      });
    });

    it(`should not throw if option is set to \`true\` as a option`, async () => {
      await testUpAndDown((action) => {
        db.options.noPrimaryKey = 'error';

        expect(() =>
          db[action]('table', { noPrimaryKey: true }, () => ({})),
        ).not.toThrow();
      });
    });
  });
});
