import { ColumnSchemaConfig } from 'pqb/internal';

declare module 'rake-db' {
  export interface RakeDbConfig {
    dbPath?: string;
    dbExportedAs?: string;
    generateTableTo?(tableName: string): string;
  }

  export interface RakeDbCliConfigInputBase<
    //
    SchemaConfig extends ColumnSchemaConfig,
    //
    CT,
  > {
    dbPath?: string;
    dbExportedAs?: string;
    generateTableTo?(tableName: string): string;
  }
}
