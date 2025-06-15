import { Db, IsolationLevel, TransactionOptions } from 'pqb';
import { AfterCommitStandaloneHook } from 'orchid-core';

export function transaction<Result>(
  this: { $queryBuilder: Db },
  fn: () => Promise<Result>,
): Promise<Result>;
export function transaction<Result>(
  this: { $queryBuilder: Db },
  options: IsolationLevel | TransactionOptions,
  fn: () => Promise<Result>,
): Promise<Result>;
export function transaction<Result>(
  this: { $queryBuilder: Db },
  fnOrOptions: IsolationLevel | TransactionOptions | (() => Promise<Result>),
  fn?: () => Promise<Result>,
): Promise<Result> {
  return this.$queryBuilder.transaction(
    fnOrOptions as IsolationLevel,
    fn as () => Promise<Result>,
  );
}

export function ensureTransaction<Result>(
  this: { $queryBuilder: Db },
  cb: () => Promise<Result>,
): Promise<Result> {
  return this.$queryBuilder.ensureTransaction(cb);
}

export function isInTransaction(this: { $queryBuilder: Db }): boolean {
  return this.$queryBuilder.isInTransaction();
}

export function afterCommit(
  this: { $queryBuilder: Db },
  hook: AfterCommitStandaloneHook,
): void {
  this.$queryBuilder.afterCommit(hook);
}
