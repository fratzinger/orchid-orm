import {
  EnumColumn,
  defaultSchemaConfig,
  DefaultSchemaConfig,
} from 'pqb/internal';

export interface TableMethods {
  enum(
    name: string,
  ): EnumColumn<DefaultSchemaConfig, undefined, [string, ...string[]]>;
}

export const tableMethods = {
  enum(name: string) {
    // empty array will be filled during the migration by querying db
    return new EnumColumn(
      defaultSchemaConfig,
      name,
      [] as unknown as [string, ...string[]],
      undefined,
    );
  },
};
