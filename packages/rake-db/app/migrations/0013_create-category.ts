import { change } from '../db-script';

change(async (db) => {
  await db.createTable('schema.category', (t) => ({
    iD: t.identity().primaryKey(),
    categoryName: t.text(),
    parentName: t.text().nullable(),
    ...t.timestamps(),
  }));
});
