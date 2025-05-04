import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('message', (t) => ({
    id: t.id(),
    messageKey: t.text().nullable(),
    chatId: t.integer().foreignKey('chat', 'idOfChat').index(),
    authorId: t.integer().foreignKey('user', 'id').nullable().index(),
    text: t.text(),
    decimal: t.decimal().nullable(),
    meta: t.json().nullable(),
    active: t.boolean().nullable(),
    deletedAt: t.timestamp().nullable(),
    ...t.timestamps(),
  }));
});
