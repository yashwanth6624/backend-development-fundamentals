const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { SECRET_KEY, TOKEN_EXPIRY, SALT_ROUNDS } = require("../config");
const { validateRegister, validateLogin } = require("../utils/validate");

// The router gets the open database connection from server.js
module.exports = function authRouter(db) {
  const router = express.Router();

  // POST /register/  -> create a user with a hashed password
  router.post("/register", async (req, res) => {
    const parsed = validateRegister(req.body);
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    const { username, name, password } = parsed.value;

    // 1. an existing username is rejected with 400
    const existing = await db.get("SELECT id FROM users WHERE username = ?", [username]);
    if (existing) return res.status(400).json({ message: "User already exists" });

    // 2. hash the password, only the hash is saved
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    try {
      const result = await db.run(
        "INSERT INTO users (username, name, password) VALUES (?, ?, ?)",
        [username, name, hashedPassword]
      );
      res.status(201).json({
        message: "User created successfully",
        data: { id: result.lastID, username, name },
      });
    } catch (err) {
      // two requests with the same username at the same time: the UNIQUE
      // constraint in the table stops the second one
      if (err.code === "SQLITE_CONSTRAINT") {
        return res.status(400).json({ message: "User already exists" });
      }
      throw err;
    }
  });

  // POST /login/  -> check the password and return a JWT
  router.post("/login", async (req, res) => {
    const parsed = validateLogin(req.body);
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    const { username, password } = parsed.value;

    // 1. unknown user gives 400
    const user = await db.get("SELECT * FROM users WHERE username = ?", [username]);
    if (!user) return res.status(400).json({ message: "Invalid user" });

    // 2. compare the typed password with the stored hash, wrong password gives 400
    const isPasswordMatched = await bcrypt.compare(password, user.password);
    if (!isPasswordMatched) return res.status(400).json({ message: "Invalid password" });

    // 3. success: the payload holds only the username, never the password
    const jwt_token = jwt.sign({ username: user.username }, SECRET_KEY, {
      expiresIn: TOKEN_EXPIRY,
    });
    res.status(200).json({ jwt_token });
  });

  return router;
};
