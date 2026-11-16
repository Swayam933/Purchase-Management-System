import mysql from 'mysql2/promise';
import { config } from '../config/env.js';

export const pool = mysql.createPool({
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.name,
  waitForConnections: true,
  connectionLimit: config.database.connectionLimit,
  queueLimit: 0,
  dateStrings: true,
  decimalNumbers: true,
});

export async function query(handle, sql, parameters = []) {
  const [rows] = await handle.execute(sql, parameters);
  return rows;
}

export async function transaction(work) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error('[database] transaction rollback failed', rollbackError);
    }
    throw error;
  } finally {
    connection.release();
  }
}

export async function databaseHealth() {
  const sequenceRows = await query(
    pool,
    'SELECT next_value FROM purchase_order_sequence WHERE id = 1',
  );
  if (sequenceRows.length !== 1) {
    throw new Error('The purchase_order_sequence singleton row is missing');
  }
  const [counts] = await query(
    pool,
    `SELECT
       (SELECT COUNT(*) FROM item_types) AS itemTypes,
       (SELECT COUNT(*) FROM items) AS items,
       (SELECT COUNT(*) FROM purchases) AS purchases,
       (SELECT COUNT(*) FROM purchase_items) AS purchaseItems`,
  );
  return {
    status: 'ok',
    storage: 'mysql',
    lowStockThreshold: config.lowStockThreshold,
    records: {
      itemTypes: Number(counts.itemTypes),
      items: Number(counts.items),
      purchases: Number(counts.purchases),
      purchaseItems: Number(counts.purchaseItems),
    },
  };
}

export async function closeDatabase() {
  await pool.end();
}
