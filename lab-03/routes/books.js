const express = require("express");
const { validateId, validateBookBody, validateListQuery } = require("../utils/validate");

// The router gets the open database connection from server.js
module.exports = function booksRouter(db) {
  const router = express.Router();

  // GET /books  -> list with search, price range, sorting and pagination
  router.get("/", async (req, res) => {
    const parsed = validateListQuery(req.query);
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    const { search_q, order_by, order, limit, offset, min_price, max_price } = parsed.value;

    // Build the WHERE part. Only fixed SQL text is joined, user values go in params.
    const conditions = [];
    const params = [];

    if (search_q) {
      // escape % and _ so they are searched as normal characters
      const safe = search_q.replace(/[\\%_]/g, "\\$&");
      conditions.push("title LIKE ? ESCAPE '\\'");
      params.push(`%${safe}%`);
    }
    if (min_price !== null) {
      conditions.push("price >= ?");
      params.push(min_price);
    }
    if (max_price !== null) {
      conditions.push("price <= ?");
      params.push(max_price);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    // order_by and order cannot be ? placeholders, so they are checked against
    // a whitelist in validateListQuery before they reach this string.
    const totalRow = await db.get(`SELECT COUNT(*) AS total FROM books ${where}`, params);
    const books = await db.all(
      `SELECT id, title, author, price FROM books ${where}
       ORDER BY ${order_by} ${order} LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.status(200).json({
      message: "Books fetched",
      total: totalRow.total,
      count: books.length,
      limit,
      offset,
      data: books,
    });
  });

  // GET /books/:id  -> one book
  router.get("/:id", async (req, res) => {
    const id = validateId(req.params.id);
    if (id.error) return res.status(400).json({ message: id.error });

    const book = await db.get("SELECT id, title, author, price FROM books WHERE id = ?", [id.value]);
    if (!book) return res.status(404).json({ message: `Book with id ${id.value} not found` });

    res.status(200).json({ message: "Book fetched", data: book });
  });

  // POST /books  -> create
  router.post("/", async (req, res) => {
    const body = validateBookBody(req.body);
    if (body.error) return res.status(400).json({ message: body.error });
    const { title, author, price } = body.value;

    const result = await db.run(
      "INSERT INTO books (title, author, price) VALUES (?, ?, ?)",
      [title, author, price]
    );
    res.status(201).json({
      message: "Book created",
      data: { id: result.lastID, title, author, price },
    });
  });

  // PUT /books/:id  -> update (all fields required)
  router.put("/:id", async (req, res) => {
    const id = validateId(req.params.id);
    if (id.error) return res.status(400).json({ message: id.error });
    const body = validateBookBody(req.body);
    if (body.error) return res.status(400).json({ message: body.error });
    const { title, author, price } = body.value;

    const result = await db.run(
      "UPDATE books SET title = ?, author = ?, price = ? WHERE id = ?",
      [title, author, price, id.value]
    );
    if (result.changes === 0) {
      return res.status(404).json({ message: `Book with id ${id.value} not found` });
    }
    res.status(200).json({
      message: "Book updated",
      data: { id: id.value, title, author, price },
    });
  });

  // DELETE /books/:id  -> remove
  router.delete("/:id", async (req, res) => {
    const id = validateId(req.params.id);
    if (id.error) return res.status(400).json({ message: id.error });

    const result = await db.run("DELETE FROM books WHERE id = ?", [id.value]);
    if (result.changes === 0) {
      return res.status(404).json({ message: `Book with id ${id.value} not found` });
    }
    res.status(200).json({ message: `Book with id ${id.value} deleted` });
  });

  return router;
};
