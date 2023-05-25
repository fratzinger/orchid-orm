# pqb

## 0.11.27

### Patch Changes

- 4287137: Add `sql` method to accept raw SQL via template literals
- Updated dependencies [4287137]
  - orchid-core@0.4.9

## 0.11.26

### Patch Changes

- 2e8e2a3: Support $ syntax in raw method for column names

## 0.11.25

### Patch Changes

- a33d1a1: Update docs links in README.md and in package.json

## 0.11.24

### Patch Changes

- 83d8eed: Support defining hooks on tables (#83)

## 0.11.23

### Patch Changes

- Updated dependencies [9610b44]
  - orchid-core@0.4.8

## 0.11.22

### Patch Changes

- c7298d6: Throw when passing null or undefined to the find method

## 0.11.21

### Patch Changes

- 64353f7: Make identity column optional when creating
- 63934b5: Fix ordering and using where for the column of selected relation
- 23d8a2a: Fix `nowSQL` to be wrapped into parens automatically
- Updated dependencies [23d8a2a]
  - orchid-core@0.4.7

## 0.11.20

### Patch Changes

- Support returning data from a callback for creating record in `upsert`, `orCreate`
- e8a863d: Support `.join()` on relations to have JOIN LATERAL instead of LEFT JOIN LATERAL

## 0.11.19

### Patch Changes

- Allow to customize timestamp default value with `nowSQL` option of base table
- Updated dependencies
  - orchid-core@0.4.6

## 0.11.18

### Patch Changes

- Fix selecting a plain value from a sub query in select

## 0.11.17

### Patch Changes

- Fix aliasing relation sub queries in select; Fix ordering by selected value

## 0.11.16

### Patch Changes

- Fix selecting nested relations

## 0.11.15

### Patch Changes

- Fix selecting relation pluck with query methods like orderBy

## 0.11.14

### Patch Changes

- Handle releations selects with `JOIN LATERAL` internally
- dfc2b87: Remove ability to select a relation with a string in `select` because it may be confusing

## 0.11.13

### Patch Changes

- Change `createFactory` to `tableFactory` and `ormFactory`; Add factory.buildMany and factory.createMany
- 96504ef: Support `as` in joinLateral relation
- Updated dependencies
  - orchid-core@0.4.5

## 0.11.12

### Patch Changes

- cfdc2bb: Support nested transactions
- Add testTransaction utility for tests
  - orchid-core@0.4.4

## 0.11.11

### Patch Changes

- Rename timestampWithoutTimezone to timestampNoTZ; Add methods for it
- Updated dependencies
  - orchid-core@0.4.4

## 0.11.10

### Patch Changes

- Support joining a relation with a callback
- Updated dependencies
  - orchid-core@0.4.3

## 0.11.9

### Patch Changes

- Make passing this not required when customizing column types
- Updated dependencies
  - orchid-core@0.4.2

## 0.11.8

### Patch Changes

- Fix update method type to accept values by 'inputType' of the column instead of 'type'

## 0.11.7

### Patch Changes

- Support joinLateral

## 0.11.6

### Patch Changes

- Support selecting joined table with alias

## 0.11.5

### Patch Changes

- Change result handling to a sync function as optimization

## 0.11.4

### Patch Changes

- Support selecting full joined record
- Updated dependencies
  - orchid-core@0.4.1

## 0.11.3

### Patch Changes

- Updated dependencies
  - orchid-core@0.4.0

## 0.11.2

### Patch Changes

- Accept string, number, Date in date time columns
- Updated dependencies
  - orchid-core@0.3.1

## 0.11.1

### Patch Changes

- Updated dependencies
  - orchid-core@0.3.0

## 0.11.0

### Minor Changes

- Implicitly pass transaction object by using AsyncLocalStorage

### Patch Changes

- Updated dependencies
  - orchid-core@0.2.0

## 0.10.36

### Patch Changes

- Update dependencies

## 0.10.35

### Patch Changes

- Allow ordering by a sub-query in select

## 0.10.34

### Patch Changes

- Initial support for db views
- Updated dependencies
  - orchid-core@0.1.17

## 0.10.33

### Patch Changes

- Favor timestamptz over timestamp
- Updated dependencies
  - orchid-core@0.1.16

## 0.10.32

### Patch Changes

- Support conditional sub query result

## 0.10.31

### Patch Changes

- Support identity columns
- Updated dependencies
  - orchid-core@0.1.15

## 0.10.30

### Patch Changes

- Simplify current_timestamp, transaction_timestamp() to the equivalent now() in db pull

## 0.10.29

### Patch Changes

- Use gen_random_uuid as a default uuid default
- Updated dependencies
  - orchid-core@0.1.14

## 0.10.28

### Patch Changes

- Type-check required columns in createRaw

## 0.10.27

### Patch Changes

- Support NULLS NOT DISTINCT for unique index

## 0.10.26

### Patch Changes

- Change setting order nulls first/last

## 0.10.25

### Patch Changes

- Ignore undefined where values

## 0.10.24

### Patch Changes

- Remove undefined and void from json schema
- Updated dependencies
  - orchid-core@0.1.13

## 0.10.23

### Patch Changes

- Support db table checks and constraints
- Updated dependencies
  - orchid-core@0.1.12

## 0.10.22

### Patch Changes

- Support schema connection option

## 0.10.21

### Patch Changes

- Improve error classes

## 0.10.20

### Patch Changes

- Fix selecting value in a sub select

## 0.10.19

### Patch Changes

- Improve join arg types
- Updated dependencies
  - orchid-core@0.1.11

## 0.10.18

### Patch Changes

- Improve select and from types

## 0.10.17

### Patch Changes

- Improve onConflict without argument behavior
- Updated dependencies
  - orchid-core@0.1.10

## 0.10.16

### Patch Changes

- Fix generating enum column from db pull to ORM
- Updated dependencies
- Updated dependencies [c8df1f9]
  - orchid-core@0.1.9

## 0.10.15

### Patch Changes

- Support validation error messages
- Updated dependencies
  - orchid-core@0.1.8

## 0.10.14

### Patch Changes

- Fix handling undefined values in foreign key when pulling db
- Updated dependencies
  - orchid-core@0.1.7

## 0.10.13

### Patch Changes

- Support snakeCase option
- Updated dependencies
  - orchid-core@0.1.6

## 0.10.12

### Patch Changes

- Support selecting \*

## 0.10.11

### Patch Changes

- Support runtime default; Add createManyRaw and createManyFrom
- Updated dependencies
  - orchid-core@0.1.5

## 0.10.10

### Patch Changes

- Add citext

## 0.10.9

### Patch Changes

- 8d35851: Handle unsupported types

## 0.10.8

### Patch Changes

- Support domain types
- Updated dependencies
  - orchid-core@0.1.4

## 0.10.7

### Patch Changes

- Support database CHECK validation
- Updated dependencies
  - orchid-core@0.1.3

## 0.10.6

### Patch Changes

- Improve .unique code gen, save migration verion after db pull

## 0.10.5

### Patch Changes

- Support raw in a callback in a select

## 0.10.4

### Patch Changes

- Use readonly for table in the table class

## 0.10.3

### Patch Changes

- 384fbfc: Support enum, array columns in db pull
- Updated dependencies
  - orchid-core@0.1.2

## 0.10.2

### Patch Changes

- Fix creating belongsTo relation when id has no default

## 0.10.1

### Patch Changes

- Updated dependencies
  - orchid-core@0.1.1

## 0.10.0

### Minor Changes

- Move common code into separate orchid-core package

### Patch Changes

- Updated dependencies
  - orchid-core@0.1.0

## 0.9.27

### Patch Changes

- Add `raw` to column types to use in defaults

## 0.9.26

### Patch Changes

- Support join subquery

## 0.9.25

### Patch Changes

- Fix pluck in sub query

## 0.9.24

### Patch Changes

- Fix pluck subquery with empty result

## 0.9.23

### Patch Changes

- Fix returning pluck from sub query

## 0.9.22

### Patch Changes

- Fix returning related records in an extra array

## 0.9.21

### Patch Changes

- Add method $from to orm

## 0.9.20

### Patch Changes

- Fix number column operators

## 0.9.19

### Patch Changes

- Support from(query) with proper result, operators, parsers
- aa92f25: Remove `as` argument from `from` method in favor of specific `as` method

## 0.9.18

### Patch Changes

- Leave only dist in shipped packages

## 0.9.17

### Patch Changes

- Fix sub query columns parsing

## 0.9.16

### Patch Changes

- Store error stack trace in error cause

## 0.9.15

### Patch Changes

- Add createEnum and dropEnum to rake-db

## 0.9.14

### Patch Changes

- Fix TS error when using nullable type in migration

## 0.9.13

### Patch Changes

- Restructure for mysql init

## 0.9.13

### Patch Changes

- Restructure for mysql init

## 0.9.12

### Patch Changes

- Add orCreate method

## 0.9.11

### Patch Changes

- Improve code generation, fix ssl databaseUrl option

## 0.9.10

### Patch Changes

- Add init script

## 0.9.9

### Patch Changes

- Override column types via callback

## 0.9.8

### Patch Changes

- ee1961e: Make columnTypes optional in configs

## 0.9.7

### Patch Changes

- Handle table ordering by foreign key when pulling db

## 0.9.6

### Patch Changes

- Fix import timestamps issue

## 0.9.5

### Patch Changes

- Mix query builder into migration db interface

## 0.9.4

### Patch Changes

- Improve esm support

## 0.9.3

### Patch Changes

- Change package.json exports for esm support

## 0.9.2

### Patch Changes

- Improve pulling db structure

## 0.9.1

### Patch Changes

- Add command for pulling database structure into a migration

## 0.9.0

### Minor Changes

- Change index options: column or expression is required, operator renamed to opclass

### Patch Changes

- f1cd5db: Handle multiple indexes and foreignKeys of the column

## 0.8.5

### Patch Changes

- Change inner aspects of columns

## 0.8.4

### Patch Changes

- Add --code cli argument to rake-db
- Improve codegen

## 0.8.3

### Patch Changes

- Fix export

## 0.8.2

### Patch Changes

- Add code generator to change project files after migrations

## 0.8.1

### Patch Changes

- Add ability to convert columns to code

## 0.8.0

### Minor Changes

- 3f25b4d: Rename all model words to table words, because all models here are not models in OOP meaning

## 0.7.13

### Patch Changes

- Refactor create and update of relations

## 0.7.12

### Patch Changes

- Improve usability of raw SQL

## 0.7.11

### Patch Changes

- Allow to open connections after closing

## 0.7.10

### Patch Changes

- Fix incrorrect order on queries for automatic wrapping into transaction

## 0.7.9

### Patch Changes

- Set proper stack trace on errors

## 0.7.8

### Patch Changes

- Change connectionString to databaseURL option, add ssl option

## 0.7.7

### Patch Changes

- Change QueryError implemetation details

## 0.7.6

### Patch Changes

- Remove force flag from update and delete in favor of empty where

## 0.7.5

### Patch Changes

- Make text operators case insensitive by default

## 0.7.4

### Patch Changes

- Update homepage link in package.json

## 0.7.3

### Patch Changes

- Add required min and max parameters to text column

## 0.7.2

### Patch Changes

- 9b8b3d5: Prefix unique columns with sequences in test factory

## 0.7.1

### Patch Changes

- Handle tables without primary key

## 0.7.0

### Minor Changes

- 883c3e4: Add changeset
