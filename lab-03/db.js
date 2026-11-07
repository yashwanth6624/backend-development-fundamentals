const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

// DB_PATH comes from the environment, with a safe default for local runs
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "books.db");

const seedBooks = [
  ["Clean Code", "Robert C. Martin", 450],
  ["The Pragmatic Programmer", "Andrew Hunt", 520],
  ["Eloquent JavaScript", "Marijn Haverbeke", 380],
  ["You Don't Know JS", "Kyle Simpson", 299],
  ["Node.js Design Patterns", "Mario Casciaro", 650],
  ["Learning SQL", "Alan Beaulieu", 410],
  ["Introduction to Algorithms", "Thomas H. Cormen", 899],
  ["Designing Data-Intensive Applications", "Martin Kleppmann", 780],
  ["JavaScript: The Good Parts", "Douglas Crockford", 250],
  ["Python Crash Course", "Eric Matthes", 399],
  ["Grokking Algorithms", "Aditya Bhargava", 340],
  ["SQL Cookbook", "Anthony Molinaro", 560],
];

async function initDb() {
  const db = await open({ filename: DB_PATH, driver: sqlite3.Database });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS books (
      id     INTEGER PRIMARY KEY AUTOINCREMENT,
      title  TEXT NOT NULL,
      author TEXT NOT NULL,
      price  REAL NOT NULL CHECK (price >= 0)
    )
  `);

  // Seed sample data only when the table is empty
  const row = await db.get("SELECT COUNT(*) AS count FROM books");
  if (row.count === 0) {
    for (const [title, author, price] of seedBooks) {
      await db.run(
        "INSERT INTO books (title, author, price) VALUES (?, ?, ?)",
        [title, author, price]
      );
    }
  }
  return db;
}

module.exports = { initDb, DB_PATH };
