import { Adapter } from 'pqb/internal';

export interface OrmParam {
  $getAdapter(): Adapter;
}

export type DbParam = OrmParam | Adapter;

export const getMaybeTransactionAdapter = (db: DbParam): Adapter =>
  '$getAdapter' in db ? db.$getAdapter() : db;

export const runSqlInSavePoint = async (
  db: DbParam,
  sql: string,
  code: string,
): Promise<'done' | 'already'> => {
  const adapter = getMaybeTransactionAdapter(db);
  try {
    await adapter.query(
      adapter.isInTransaction()
        ? `SAVEPOINT s; ${sql}; RELEASE SAVEPOINT s`
        : sql,
    );
    return 'done';
  } catch (err) {
    if ((err as { code: string }).code === code) {
      if (adapter.isInTransaction()) {
        await adapter.query(`ROLLBACK TO SAVEPOINT s`);
      }
      return 'already';
    }
    throw err;
  }
};
