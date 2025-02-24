import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('product', (t) => ({
    id: t.identity().primaryKey(),
    priceAmount: t.decimal(),
  }));
});
