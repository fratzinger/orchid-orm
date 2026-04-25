# Explicit RLS Context Design

**Date:** 2026-04-26
**Source Input:** `changes/611-row-level-security-integration/2-run-work-inside-an-explicit-rls-context/spec.md`
**Scope:** Single-spec planning artifact for explicit callback-scoped SQL session state used by row-level security policies.

## Goal

Extend `withOptions` and `$withOptions` so callers can declare a Postgres `role` and `setConfig` map that Orchid applies on the exact connection executing each query. The behavior must work the same for regular queries, raw query helpers, explicit transactions, and nested savepoints without introducing a new scoped DB handle or changing transaction APIs.

## Why This Belongs In Existing `withOptions`

The source spec is already narrow: callback-scoped execution state that travels with ambient async context. Orchid already uses `withOptions` / `$withOptions` and `AsyncLocalStorage` for `log`, `schema`, and transaction propagation, so the lowest-risk design is to extend the existing storage model instead of introducing a parallel RLS wrapper.

That keeps the user-facing API flat:

```ts
await db.$withOptions(
  {
    role: 'app_user',
    setConfig: {
      'app.tenant_id': tenantId,
      'app.user_id': userId,
    },
  },
  async () => {
    await db.project.find(projectId);

    await db.$transaction(async () => {
      await db.project.find(projectId).update({
        lastViewedAt: new Date(),
      });
    });
  },
);
```

## Boundaries

### Public API Boundary

`orm` and `pqb` keep the existing `withOptions` / `$withOptions` and `transaction` / `$transaction` entry points. Only the `withOptions` option shape changes:

```ts
interface StorageOptions {
  log?: boolean;
  schema?: QuerySchema;
  role?: string;
  setConfig?: Record<string, string | number | boolean>;
}
```

Key rules:

- `role` and `setConfig` are query-scoped SQL session options.
- `number` and `boolean` `setConfig` values are normalized to strings before storage and comparison.
- Nested scopes may continue to override `log` and `schema`.
- Nested scopes may not define `role` or `setConfig` if an outer SQL session scope is already active.
- `transaction` and `$transaction` stay unchanged at the API level and inherit the ambient SQL session state automatically.

### Async State Boundary

`pqb` owns the canonical SQL session state shape because query execution lives there. The async state continues to be the transport layer between ORM call sites and the adapter/query execution layer.

```ts
interface SqlSessionState {
  role?: string;
  setConfig?: Record<string, string>;
}
```

Design constraints:

- Store only normalized values in async state.
- Do not create empty SQL session state for scopes that only change `log` or `schema`.
- Reject nested SQL session scopes before query execution begins so the failure is deterministic and adapter-independent.

### Query Execution Boundary

The critical design decision is that SQL session setup is a query-execution concern, not a callback-lifetime connection concern.

For every query that runs with ambient SQL session state:

1. Resolve the real adapter/connection that will execute the query.
2. Capture the previous role and requested config keys on that same connection.
3. Apply the desired role and config values on that same connection.
4. Execute the target SQL on that same connection.
5. Restore the prior role and config values in `finally`.

This keeps behavior correct for:

- standard ORM and query-builder reads/writes
- raw helpers such as `$query` and `$queryArrays`
- follow-up queries emitted by hooks or relation loading
- explicit transactions and nested savepoints

It also avoids holding a dedicated connection for the entire callback when the callback itself is not inside an explicit transaction.

## Adapter Strategy

### `node-postgres`

`node-postgres` should reconcile SQL session state on the `PoolClient` that executes the query.

- Outside explicit transactions, borrow one `PoolClient` for the setup/query/cleanup window, then release it.
- Inside explicit transactions, reuse the transaction-owned `PoolClient`.
- Compose with existing per-client search-path and savepoint behavior instead of adding a parallel query path.

### `postgres-js`

`postgres-js` needs an explicit same-connection window outside transactions.

- Outside explicit transactions, reserve one connection with `sql.reserve()` for setup/query/cleanup, then release it.
- Inside explicit transactions, use the active transaction connection.
- Do not pipeline setup with the main query; failed setup must prevent the target SQL from being sent.

## SQL Session Reconciliation Rules

### Setup

Before applying requested state:

- capture the current role with `current_user` when `role` is requested
- capture each requested config key with `current_setting(name, true)`

Application rules:

- `role` uses `SET ROLE`
- custom settings use parameterized `set_config`
- dotted keys such as `app.tenant_id` are valid and documented

### Cleanup

Cleanup always runs in `finally`.

- restore the previous role if one was captured
- restore every requested config key to its prior value
- treat cleanup failure as part of the same failed operation

Manual raw SQL that mutates role or session config inside the callback is explicitly outside the feature contract because Orchid cannot reliably reason about state it did not set.

## Failure Model

- Nested SQL session scopes reject immediately when an outer scope already has `role` or `setConfig`.
- Setup failure aborts the main query.
- Cleanup failure is surfaced and not swallowed.
- `setConfig` does not accept `null`; omission is the only supported "not set" state.
- Invalid server-side role names or config keys are allowed to fail with normal Postgres errors.

## Code Areas

Primary implementation seams inferred from the current codebase:

- `packages/orm/src/orm.ts`
  Extend `$withOptions` docs/types and rely on shared async state plumbing.
- `packages/pqb/src/adapters/features/sql-session-context.ts`
  Normalize, merge, reject nested scopes, compute setup/cleanup SQL, and wrap query execution.
- `packages/pqb/src/adapters/adapter.ts`
  Keep adapter interfaces aligned with query-scoped SQL session state propagation.
- `packages/pqb/src/adapters/node-postgres.ts`
  Reconcile session state on the active `PoolClient`.
- `packages/pqb/src/adapters/postgres-js.ts`
  Reconcile session state on reserved or transactional `postgres-js` connections.
- `packages/pqb/src/adapters/features/sql-session-context.test.ts`
  Cover normalization, setup/restore SQL, nested scope rejection, raw helper coverage, and restore behavior.
- `packages/pqb/src/adapters/node-postgres.test.ts`
  Cover explicit transaction and savepoint behavior for the node-postgres adapter.
- `packages/pqb/src/adapters/postgres-js.test.ts`
  Cover explicit transaction and savepoint behavior for the postgres-js adapter.
- `docs/src/guide/...`
  Add user-facing docs for callback-scoped SQL session options and caveats.

## Testing Strategy

The plan should cover three test layers:

### Unit Tests

Pure helper tests for SQL session state normalization, capture SQL generation, cleanup SQL generation, and nested-scope validation.

### Adapter Integration Tests

Adapter-specific tests should verify:

- regular query execution under `role` and `setConfig`
- raw query helpers inheriting the same session state
- explicit transaction inheritance
- nested savepoint inheritance
- restore behavior when keys were previously unset
- setup/cleanup failures surfacing correctly

### ORM Surface Tests

`orm` should verify that `$withOptions` documents and exposes the same option shape, and that ORM raw helpers inherit the same query-time session behavior through shared `pqb` execution paths.

## Documentation Requirements

User-facing docs and JSDoc should explain:

- `role` and `setConfig` on `withOptions` / `$withOptions`
- value normalization for `number` and `boolean`
- nested SQL session scope rejection
- behavior inside explicit transactions and savepoints
- dotted custom setting names
- recommendation to use `current_setting(name, true)` in RLS policy code when missing values matter
- the caveat that manual raw SQL session changes are outside the feature contract

## Out Of Scope

- adding a new dedicated RLS wrapper API
- changing `transaction` / `$transaction` signatures
- transaction-scoped SQL session configuration separate from `withOptions`
- runtime validation of role names or config keys beyond TypeScript types
- guaranteeing correct behavior after user-issued raw SQL session mutations inside the callback

## Recommended Implementation Shape

This work should be implemented as a focused `pqb` execution-layer change with thin `orm` API/documentation updates on top. The plan should keep the center of gravity in shared query execution and adapter tests, because correctness depends on same-connection behavior rather than on ORM-only surface logic.
