# test-utils

## 0.3.0

### Minor Changes

- 9eb720a: Change `text`, `varchar` types, remove `char` (#277)

  The text no longer accepts min and max: `text(min, max)` -> `text()`

  Varchar's limit becomes required: `varchar(limit?: number)` -> `varchar(limit: number)`

## 0.2.3

### Patch Changes

- 907b2b8: Synchronize libraries by publishing them

## 0.2.2

### Patch Changes

- 465827b1: Fix code generation for `timestamps()` with custom name (#256)

## 0.2.1

### Patch Changes

- 012752d0: Add valibot integration

## 0.2.0

### Minor Changes

- 851e840e: Significantly optimize types

## 0.1.0

### Minor Changes

- 4c7015b4: Support multiple column schemas for various cases

## 0.0.3

### Patch Changes

- 1688e82b: Add a dependency on "pg" and "@types/pg"

## 0.0.2

### Patch Changes

- Add testTransaction utility for tests

## 0.0.1

### Patch Changes

- Rename timestampWithoutTimezone to timestampNoTZ; Add methods for it
