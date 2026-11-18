const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

// DB_PATH comes from the environment, with a safe default for local runs
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "users.db");

async function initDb() {
  const db = await open({ filename: DB_PATH, driver: sqlite3.Database });

  // The password column stores the bcrypt hash, never the plain password.
  // COLLATE NOCASE makes "Yash" and "yash" count as the same username.
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      name     TEXT NOT NULL,
      password TEXT NOT NULL
    )
  `);
  return db;
}

module.exports = { initDb, DB_PATH };
