import { Model, ModelClass } from '../model';
import { Query, SetQueryReturnsOneOrUndefined } from 'pqb';
import { RelationScopeOrModel, RelationThunkBase } from './relations';

export interface BelongsTo extends RelationThunkBase {
  type: 'belongsTo';
  fn(): ModelClass;
  options: {
    primaryKey: string;
    foreignKey: string;
    scope?(q: Query): Query;
  };
}

export type BelongsToMethod<T extends Model, Relation extends BelongsTo> = (
  params: Record<
    Relation['options']['foreignKey'],
    T['columns']['shape'][Relation['options']['foreignKey']]['type']
  >,
) => SetQueryReturnsOneOrUndefined<RelationScopeOrModel<Relation>>;

export const makeBelongsToMethod = (relation: BelongsTo, query: Query) => {
  const { primaryKey, foreignKey } = relation.options;

  return (params: Record<string, unknown>) => {
    return query.findBy({ [primaryKey]: params[foreignKey] });
  };
};
