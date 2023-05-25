# orchid-orm

## 1.9.34

### Patch Changes

- 4287137: Add `sql` method to accept raw SQL via template literals
- Updated dependencies [4287137]
  - pqb@0.11.27
  - orchid-core@0.4.9

## 1.9.33

### Patch Changes

- Updated dependencies [2e8e2a3]
  - pqb@0.11.26

## 1.9.32

### Patch Changes

- a33d1a1: Update docs links in README.md and in package.json
- Updated dependencies [a33d1a1]
  - pqb@0.11.25

## 1.9.31

### Patch Changes

- 83d8eed: Support defining hooks on tables (#83)
- Updated dependencies [83d8eed]
  - pqb@0.11.24

## 1.9.30

### Patch Changes

- Updated dependencies [9610b44]
  - orchid-core@0.4.8
  - pqb@0.11.23

## 1.9.29

### Patch Changes

- Updated dependencies [c7298d6]
  - pqb@0.11.22

## 1.9.28

### Patch Changes

- 64353f7: Make identity column optional when creating
- 63934b5: Fix ordering and using where for the column of selected relation
- 5046e74: Fix codegen for relations when re-appliying migrations
- 23d8a2a: Fix `nowSQL` to be wrapped into parens automatically
- Updated dependencies [64353f7]
- Updated dependencies [63934b5]
- Updated dependencies [23d8a2a]
  - pqb@0.11.21
  - orchid-core@0.4.7

## 1.9.27

### Patch Changes

- Support ESM in ORM codegen

## 1.9.26

### Patch Changes

- Fix importing of ORM in the ORM codegen

## 1.9.25

### Patch Changes

- Fix exporting codegen from the ORM

## 1.9.24

### Patch Changes

- Fix exporting codegen from ORM

## 1.9.23

### Patch Changes

- Move ORM codegen module to a separate bundle

## 1.9.22

### Patch Changes

- Support returning data from a callback for creating record in `upsert`, `orCreate`
- e8a863d: Support `.join()` on relations to have JOIN LATERAL instead of LEFT JOIN LATERAL
- Updated dependencies
- Updated dependencies [e8a863d]
  - pqb@0.11.20

## 1.9.21

### Patch Changes

- Allow to customize timestamp default value with `nowSQL` option of base table
- Updated dependencies
  - pqb@0.11.19
  - orchid-core@0.4.6

## 1.9.20

### Patch Changes

- Fix selecting a plain value from a sub query in select
- Updated dependencies
  - pqb@0.11.18

## 1.9.19

### Patch Changes

- Fix aliasing relation sub queries in select; Fix ordering by selected value
- Updated dependencies
  - pqb@0.11.17

## 1.9.18

### Patch Changes

- Fix selecting nested relations
- Updated dependencies
  - pqb@0.11.16

## 1.9.17

### Patch Changes

- Fix selecting relation pluck with query methods like orderBy
- Updated dependencies
  - pqb@0.11.15

## 1.9.16

### Patch Changes

- Handle releations selects with `JOIN LATERAL` internally
- dfc2b87: Remove ability to select a relation with a string in `select` because it may be confusing
- Updated dependencies
- Updated dependencies [dfc2b87]
  - pqb@0.11.14

## 1.9.15

### Patch Changes

- Change `createFactory` to `tableFactory` and `ormFactory`; Add factory.buildMany and factory.createMany
- 96504ef: Support `as` in joinLateral relation
- Updated dependencies
- Updated dependencies [96504ef]
  - pqb@0.11.13
  - orchid-core@0.4.5

## 1.9.14

### Patch Changes

- Add testTransaction utility for tests
- Updated dependencies [cfdc2bb]
- Updated dependencies
  - pqb@0.11.12
  - orchid-core@0.4.4

## 1.9.13

### Patch Changes

- Updated dependencies
  - pqb@0.11.11
  - orchid-core@0.4.4

## 1.9.12

### Patch Changes

- Support joining a relation with a callback
- Updated dependencies
  - pqb@0.11.10
  - orchid-core@0.4.3

## 1.9.11

### Patch Changes

- Make passing this not required when customizing column types
- Updated dependencies
  - pqb@0.11.9
  - orchid-core@0.4.2

## 1.9.10

### Patch Changes

- Updated dependencies
  - pqb@0.11.8

## 1.9.9

### Patch Changes

- Support joinLateral
- Updated dependencies
  - pqb@0.11.7

## 1.9.8

### Patch Changes

- Updated dependencies
  - pqb@0.11.6

## 1.9.7

### Patch Changes

- Change result handling to a sync function as optimization
- Updated dependencies
  - pqb@0.11.5

## 1.9.6

### Patch Changes

- Updated dependencies
  - pqb@0.11.4
  - orchid-core@0.4.1

## 1.9.5

### Patch Changes

- Remove unneeded dependencies

## 1.9.4

### Patch Changes

- Replace pluralize with inflection for es module support

## 1.9.3

### Patch Changes

- Automaticly define relations from db pull or after running migrations

## 1.9.2

### Patch Changes

- Fix orchid-orm init

## 1.9.1

### Patch Changes

- Fix orchid-orm init

## 1.9.0

### Minor Changes

- Change appCodeUpdater config to take path and name of the base table from baseTable option

### Patch Changes

- Updated dependencies
  - orchid-core@0.4.0
  - pqb@0.11.3

## 1.8.1

### Patch Changes

- Updated dependencies
  - pqb@0.11.2
  - orchid-core@0.3.1

## 1.8.0

### Minor Changes

- Support overriden column types in rake-db

### Patch Changes

- Updated dependencies
  - orchid-core@0.3.0
  - pqb@0.11.1

## 1.7.0

### Minor Changes

- Implicitly pass transaction object by using AsyncLocalStorage

### Patch Changes

- Updated dependencies
  - pqb@0.11.0
  - orchid-core@0.2.0

## 1.6.40

### Patch Changes

- Update dependencies
- Updated dependencies
  - pqb@0.10.36

## 1.6.39

### Patch Changes

- Updated dependencies
  - pqb@0.10.35

## 1.6.38

### Patch Changes

- Initial support for db views
- Updated dependencies
  - orchid-core@0.1.17
  - pqb@0.10.34

## 1.6.37

### Patch Changes

- Updated dependencies
  - orchid-core@0.1.16
  - pqb@0.10.33

## 1.6.36

### Patch Changes

- Updated dependencies
  - pqb@0.10.32

## 1.6.35

### Patch Changes

- Support identity columns
- Updated dependencies
  - orchid-core@0.1.15
  - pqb@0.10.31

## 1.6.34

### Patch Changes

- Updated dependencies
  - pqb@0.10.30

## 1.6.33

### Patch Changes

- Updated dependencies
  - orchid-core@0.1.14
  - pqb@0.10.29

## 1.6.32

### Patch Changes

- Updated dependencies
  - pqb@0.10.28

## 1.6.31

### Patch Changes

- Support NULLS NOT DISTINCT for unique index
- Updated dependencies
  - pqb@0.10.27

## 1.6.30

### Patch Changes

- Updated dependencies
  - pqb@0.10.26

## 1.6.29

### Patch Changes

- Updated dependencies
  - pqb@0.10.25

## 1.6.28

### Patch Changes

- Remove undefined and void from json schema
- Updated dependencies
  - orchid-core@0.1.13
  - pqb@0.10.24

## 1.6.27

### Patch Changes

- Support db table checks and constraints
- Updated dependencies
  - orchid-core@0.1.12
  - pqb@0.10.23

## 1.6.26

### Patch Changes

- Support schema connection option
- Updated dependencies
  - pqb@0.10.22

## 1.6.25

### Patch Changes

- Improve error classes
- Updated dependencies
  - pqb@0.10.21

## 1.6.24

### Patch Changes

- Updated dependencies
  - pqb@0.10.20

## 1.6.23

### Patch Changes

- Updated dependencies
  - orchid-core@0.1.11
  - pqb@0.10.19

## 1.6.22

### Patch Changes

- Improve select and from types
- Updated dependencies
  - pqb@0.10.18

## 1.6.21

### Patch Changes

- Updated dependencies
  - orchid-core@0.1.10
  - pqb@0.10.17

## 1.6.20

### Patch Changes

- c8df1f9: Fix camelCase and PascalCase table names in codegen
- Updated dependencies
- Updated dependencies [c8df1f9]
  - orchid-core@0.1.9
  - pqb@0.10.16

## 1.6.19

### Patch Changes

- Updated dependencies
  - orchid-core@0.1.8
  - pqb@0.10.15

## 1.6.18

### Patch Changes

- Updated dependencies
  - orchid-core@0.1.7
  - pqb@0.10.14

## 1.6.17

### Patch Changes

- Support snakeCase option
- Updated dependencies
  - orchid-core@0.1.6
  - pqb@0.10.13

## 1.6.16

### Patch Changes

- Support selecting \*
- Updated dependencies
  - pqb@0.10.12

## 1.6.15

### Patch Changes

- Support runtime default; Add createManyRaw and createManyFrom
- Updated dependencies
  - orchid-core@0.1.5
  - pqb@0.10.11

## 1.6.14

### Patch Changes

- Add citext
- Updated dependencies
  - pqb@0.10.10

## 1.6.13

### Patch Changes

- 8d35851: Handle unsupported types
- Updated dependencies [8d35851]
  - pqb@0.10.9

## 1.6.12

### Patch Changes

- Support domain types
- Updated dependencies
  - orchid-core@0.1.4
  - pqb@0.10.8

## 1.6.11

### Patch Changes

- Support database CHECK validation
- Updated dependencies
  - orchid-core@0.1.3
  - pqb@0.10.7

## 1.6.10

### Patch Changes

- Make swc optional in init

## 1.6.9

### Patch Changes

- Updated dependencies
  - pqb@0.10.6

## 1.6.8

### Patch Changes

- Updated dependencies
  - pqb@0.10.5

## 1.6.7

### Patch Changes

- Show current path as a hint in init script

## 1.6.6

### Patch Changes

- Handle cancel in init script

## 1.6.5

### Patch Changes

- Choose project path in init script

## 1.6.4

### Patch Changes

- Use readonly for table in the table class
- Updated dependencies
  - pqb@0.10.4

## 1.6.3

### Patch Changes

- Add log to appCodeUpdater, change file pathes to urls when logging
- Updated dependencies
- Updated dependencies [384fbfc]
  - orchid-core@0.1.2
  - pqb@0.10.3

## 1.6.2

### Patch Changes

- Fix creating belongsTo relation when id has no default
- Updated dependencies
  - pqb@0.10.2

## 1.6.1

### Patch Changes

- Updated dependencies
  - orchid-core@0.1.1
  - pqb@0.10.1

## 1.6.0

### Minor Changes

- Move common code into separate orchid-core package

### Patch Changes

- Updated dependencies
  - orchid-core@0.1.0
  - pqb@0.10.0

## 1.5.39

### Patch Changes

- Updated dependencies
  - pqb@0.9.27

## 1.5.38

### Patch Changes

- Support join subquery
- Updated dependencies
  - pqb@0.9.26

## 1.5.37

### Patch Changes

- Fix pluck in sub query
- Updated dependencies
  - pqb@0.9.25

## 1.5.36

### Patch Changes

- Fix pluck subquery with empty result
- Updated dependencies
  - pqb@0.9.24

## 1.5.35

### Patch Changes

- Fix returning pluck from sub query
- Updated dependencies
  - pqb@0.9.23

## 1.5.34

### Patch Changes

- Fix returning related records in an extra array
- Updated dependencies
  - pqb@0.9.22

## 1.5.33

### Patch Changes

- Add method $from to orm
- Updated dependencies
  - pqb@0.9.21

## 1.5.32

### Patch Changes

- Fix number column operators
- Updated dependencies
  - pqb@0.9.20

## 1.5.31

### Patch Changes

- Updated dependencies
- Updated dependencies [aa92f25]
  - pqb@0.9.19

## 1.5.30

### Patch Changes

- Leave only dist in shipped packages
- Updated dependencies
  - pqb@0.9.18

## 1.5.29

### Patch Changes

- Updated dependencies
  - pqb@0.9.17

## 1.5.28

### Patch Changes

- Updated dependencies
  - pqb@0.9.16

## 1.5.27

### Patch Changes

- Updated dependencies
  - pqb@0.9.15

## 1.5.26

### Patch Changes

- Updated dependencies
  - pqb@0.9.14

## 1.5.25

### Patch Changes

- Change relative paths in rake-db config generated by init script

## 1.5.24

### Patch Changes

- Updated dependencies
  - pqb@0.9.13

## 1.5.23

### Patch Changes

- Fix relative path resolution on windows for orm codegen

## 1.5.22

### Patch Changes

- Make codegen to not add table to the main file when the key already exist

## 1.5.21

### Patch Changes

- Fix baseTablePath in orm codegen

## 1.5.20

### Patch Changes

- Relative path in rakeDb config

## 1.5.19

### Patch Changes

- Improve init script

## 1.5.18

### Patch Changes

- Add orCreate method
- Updated dependencies
  - pqb@0.9.12

## 1.5.17

### Patch Changes

- Improve code generation, fix ssl databaseUrl option
- Updated dependencies
  - pqb@0.9.11

## 1.5.16

### Patch Changes

- Improve code generation

## 1.5.15

### Patch Changes

- Improve init script

## 1.5.14

### Patch Changes

- Improve init script

## 1.5.13

### Patch Changes

- Fix init script

## 1.5.12

### Patch Changes

- Add init script
- Updated dependencies
  - pqb@0.9.10

## 1.5.11

### Patch Changes

- Override column types via callback
- Updated dependencies
  - pqb@0.9.9

## 1.5.10

### Patch Changes

- ee1961e: Make columnTypes optional in configs
- Updated dependencies [ee1961e]
  - pqb@0.9.8

## 1.5.9

### Patch Changes

- Updated dependencies
  - pqb@0.9.7

## 1.5.8

### Patch Changes

- Fix import path on windows in generated code

## 1.5.7

### Patch Changes

- Updated dependencies
  - pqb@0.9.6

## 1.5.6

### Patch Changes

- Updated dependencies
  - pqb@0.9.5

## 1.5.5

### Patch Changes

- ESM support for orm

## 1.5.4

### Patch Changes

- Updated dependencies
  - pqb@0.9.4

## 1.5.3

### Patch Changes

- Change package.json exports for esm support
- Updated dependencies
  - pqb@0.9.3

## 1.5.2

### Patch Changes

- Updated dependencies
  - pqb@0.9.2

## 1.5.1

### Patch Changes

- Updated dependencies
  - pqb@0.9.1

## 1.5.0

### Minor Changes

- Change index options: column or expression is required, operator renamed to opclass

### Patch Changes

- f1cd5db: Handle multiple indexes and foreignKeys of the column
- Updated dependencies
- Updated dependencies [f1cd5db]
  - pqb@0.9.0

## 1.4.22

### Patch Changes

- Change inner aspects of columns
- Updated dependencies
  - pqb@0.8.5

## 1.4.21

### Patch Changes

- Add --code cli argument to rake-db
- Improve codegen
- Updated dependencies
- Updated dependencies
  - pqb@0.8.4

## 1.4.19

### Patch Changes

- Updated dependencies
  - pqb@0.8.3

## 1.4.18

### Patch Changes

- Add code generator to change project files after migrations
- Updated dependencies
  - pqb@0.8.2

## 1.4.17

### Patch Changes

- Updated dependencies
  - pqb@0.8.1

## 2.0.0

### Minor Changes

- 3f25b4d: Rename all model words to table words, because all models here are not models in OOP meaning

### Patch Changes

- Updated dependencies [3f25b4d]
  - pqb@0.8.0
  - rake-db@2.2.0

## 1.3.16

### Patch Changes

- Refactor create and update of relations
- Updated dependencies
  - pqb@0.7.13

## 1.3.15

### Patch Changes

- Updated dependencies
  - pqb@0.7.12

## 1.3.14

### Patch Changes

- Updated dependencies
  - pqb@0.7.11

## 1.3.13

### Patch Changes

- Updated dependencies
  - pqb@0.7.10

## 1.3.12

### Patch Changes

- Updated dependencies
  - pqb@0.7.9

## 1.3.11

### Patch Changes

- Change connectionString to databaseURL option, add ssl option
- Updated dependencies
  - pqb@0.7.8

## 1.3.10

### Patch Changes

- Updated dependencies
  - pqb@0.7.7

## 1.3.9

### Patch Changes

- Updated dependencies
  - pqb@0.7.6

## 1.3.8

### Patch Changes

- Updated dependencies
  - pqb@0.7.5

## 1.3.7

### Patch Changes

- Update homepage link in package.json
- Updated dependencies
  - pqb@0.7.4

## 1.3.6

### Patch Changes

- Add required min and max parameters to text column
- Updated dependencies
  - pqb@0.7.3

## 1.3.5

### Patch Changes

- Check if through and source relations are defined

## 1.3.4

### Patch Changes

- Updated dependencies [9b8b3d5]
  - pqb@0.7.2

## 1.3.3

### Patch Changes

- Handle tables without primary key
- Updated dependencies
  - pqb@0.7.1

## 1.3.2

### Patch Changes

- 1147182: Run relation callbacks when creating/updating/deleting in a nested way

## 1.3.0

### Minor Changes

- 883c3e4: Add changeset

### Patch Changes

- Updated dependencies [883c3e4]
  - pqb@0.7.0
