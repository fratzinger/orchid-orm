import { patchRakeDb as patch } from './patch-rake-db';
export * from './patch-rake-db-types';
export * from 'rake-db';

patch();

export const patchRakeDb = patch;
