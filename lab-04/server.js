const express = require("express");
const { initDb } = require("./db");
const authRouter = require("./routes/auth");

const PORT = process.env.PORT || 3000;

async function createApp() {
  const db = await initDb();
  const app = express();

  // lets the routes read the JSON body as req.body
  app.use(express.json());

  app.get("/", (req, res) => {
    res.status(200).json({
      message: "Registration, login and JWT API (Lab 4)",
      endpoints: ["POST /register", "POST /login"],
    });
  });

  app.use("/", authRouter(db));

  // Unknown route
  app.use((req, res) => {
    res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} not found` });
  });

  // Central error handler: bad JSON gives 400, anything else gives 500.
  // The request body is never logged, because it can hold a password.
  app.use((err, req, res, next) => {
    if (err.type === "entity.parse.failed") {
      return res.status(400).json({ message: "Request body is not valid JSON" });
    }
    console.error(err.message);
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
        console.log(`Auth API running on http://localhost:${PORT}`);
      });
    })
    .catch((err) => {
      console.error("Failed to start the server:", err);
      process.exit(1);
    });
}

module.exports = { createApp };
