import {
  TableClasses,
  OrchidORM,
  OrchidOrmParam,
  orchidORMWithAdapter,
} from 'orchid-orm';
import {
  NodePostgresAdapter,
  NodePostgresAdapterOptions,
  createDb as cdb,
} from 'pqb/node-postgres';
import { DbSharedOptions, AdapterClass } from 'pqb/internal';

export const Adapter = NodePostgresAdapter;

export const createDb = cdb;

export const orchidORM = <T extends TableClasses>(
  {
    log,
    ...options
  }: OrchidOrmParam<NodePostgresAdapterOptions & DbSharedOptions>,
  tables: T,
): OrchidORM<T> => {
  return orchidORMWithAdapter(
    {
      ...options,
      adapter: new AdapterClass({
        driverAdapter: NodePostgresAdapter,
        config: options,
      }),
      log,
    },
    tables,
  );
};
