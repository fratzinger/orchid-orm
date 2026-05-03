import { prepareSubQueryForSql } from '../../internal-features/sub-query/sub-query-for-sql';
import { pushQueryValueImmutable } from '../../query-data';
import { Query } from '../../query';

export const _appendQuery = (
  main: Query,
  append: Query,
  asFn: (as: string) => void,
) => {
  return pushQueryValueImmutable(
    pushQueryValueImmutable(
      main,
      'appendQueries',
      prepareSubQueryForSql(main, append),
    ),
    'asFns',
    asFn,
  );
};
