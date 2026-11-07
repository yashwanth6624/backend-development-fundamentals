const express = require("express");
const { initDb } = require("./db");
const booksRouter = require("./routes/books");

const PORT = process.env.PORT || 3000;

async function createApp() {
  const db = await initDb();
  const app = express();

  app.use(express.json());

  app.get("/", (req, res) => {
    res.status(200).json({
      message: "Books REST API (Lab 3)",
      endpoints: [
        "GET /books",
        "GET /books/:id",
        "POST /books",
        "PUT /books/:id",
        "DELETE /books/:id",
      ],
    });
  });

  app.use("/books", booksRouter(db));

  // Unknown route
  app.use((req, res) => {
    res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} not found` });
  });

  // Central error handler: bad JSON body gives 400, anything else gives 500
  app.use((err, req, res, next) => {
    if (err.type === "entity.parse.failed") {
      return res.status(400).json({ message: "Request body is not valid JSON" });
    }
    console.error(err); // full error stays in the server log only
    res.status(500).json({ message: "Internal server error" });
  });

  return { app, db };
}

// Start the server only when this file is run directly (not when tests import it)
if (require.main === module) {
  createApp()
    .then(({ app }) => {
      // Express 5 passes startup errors (like EADDRINUSE) to this callback
      app.listen(PORT, (err) => {
        if (err) {
          console.error(`Could not start the server on port ${PORT}:`, err.message);
          process.exit(1);
        }
        console.log(`Books API running on http://localhost:${PORT}`);
      });
    })
    .catch((err) => {
      console.error("Failed to start the server:", err);
      process.exit(1);
    });
}

module.exports = { createApp };
