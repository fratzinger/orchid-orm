import { UniqueTable, User } from './test-utils/test-utils';
import { QueryError } from 'orchid-core';
import { testDb, useTestDatabase } from 'test-utils';

describe('errors', () => {
  useTestDatabase();

  it('should capture stack trace properly', async () => {
    let err: Error | undefined;

    try {
      await User.select({ column: testDb.sql`koko`.type((t) => t.boolean()) });
    } catch (error) {
      err = error as Error;
    }

    expect((err?.cause as Error).stack).toContain('errors.test.ts');
  });

  it('should have isUnique and column names map when violating unique error over single column', async () => {
    await UniqueTable.create({
      one: 'one',
      two: 1,
      thirdColumn: 'three',
      fourthColumn: 1,
    });

    let err: InstanceType<typeof UniqueTable.error> | undefined;

    try {
      await UniqueTable.create({
        one: 'one',
        two: 2,
        thirdColumn: 'three',
        fourthColumn: 2,
      });
    } catch (error) {
      if (error instanceof UniqueTable.error) {
        err = error;
      }
    }

    expect(err?.query).toBe(UniqueTable);
    expect(err?.isUnique).toBe(true);
    expect(err?.columns).toEqual({
      one: true,
    });
  });

  it('should have isUnique and column names map when violating unique error over multiple columns', async () => {
    await UniqueTable.create({
      one: 'one',
      two: 1,
      thirdColumn: 'three',
      fourthColumn: 1,
    });

    let err: QueryError | undefined;

    try {
      await UniqueTable.create({
        one: 'two',
        two: 2,
        thirdColumn: 'three',
        fourthColumn: 1,
      });
    } catch (error) {
      if (error instanceof QueryError) {
        err = error;
      }
    }

    expect(err?.query).toBe(UniqueTable);
    expect(err?.isUnique).toBe(true);
    expect(err?.columns).toEqual({
      thirdColumn: true,
      fourthColumn: true,
    });
  });
});
