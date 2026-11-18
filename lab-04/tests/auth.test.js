// Automated version of the Postman test list. Run with: npm test
// It starts the app on a random port with a temporary database file.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");

const dbFile = path.join(os.tmpdir(), `lab04-test-${Date.now()}.db`);
process.env.DB_PATH = dbFile;
const { createApp } = require("../server");
const { SECRET_KEY } = require("../config");

let server;
let db;
let base;

before(async () => {
  const created = await createApp();
  const app = created.app;
  db = created.db;
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://localhost:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  // Close the database first. Windows cannot delete a file that is still open.
  await db.close();
  try {
    fs.rmSync(dbFile, { force: true, maxRetries: 5, retryDelay: 100 });
  } catch (err) {
    console.warn("Could not delete the temporary test database:", err.code);
  }
});

async function post(url, body, rawBody) {
  const options = { method: "POST", headers: { "Content-Type": "application/json" } };
  options.body = rawBody !== undefined ? rawBody : JSON.stringify(body);
  const res = await fetch(base + url, options);
  return { status: res.status, json: await res.json() };
}

const user = { username: "yash_01", name: "Talla Yashwanth", password: "secret123" };

// ---------- registration ----------
test("register: a new user returns 201 and no password in the response", async () => {
  const { status, json } = await post("/register", user);
  assert.equal(status, 201);
  assert.equal(json.message, "User created successfully");
  assert.equal(json.data.username, "yash_01");
  assert.ok(!JSON.stringify(json).includes("secret123"));
  assert.equal(json.data.password, undefined);
});

test("register: the database stores a bcrypt hash and not the password", async () => {
  const row = await db.get("SELECT password FROM users WHERE username = ?", ["yash_01"]);
  assert.notEqual(row.password, "secret123");
  assert.match(row.password, /^\$2[aby]\$10\$/);
  assert.equal(row.password.length, 60);
});

test("register: an existing username returns 400", async () => {
  const { status, json } = await post("/register", user);
  assert.equal(status, 400);
  assert.equal(json.message, "User already exists");
});

test("register: usernames are not case sensitive", async () => {
  const { status } = await post("/register", { ...user, username: "YASH_01" });
  assert.equal(status, 400);
});

test("register: two users with the same password get different hashes (salt)", async () => {
  await post("/register", { username: "friend_02", name: "Friend", password: "secret123" });
  const a = await db.get("SELECT password FROM users WHERE username = ?", ["yash_01"]);
  const b = await db.get("SELECT password FROM users WHERE username = ?", ["friend_02"]);
  assert.notEqual(a.password, b.password);
});

test("register: missing username returns 400", async () => {
  const { status, json } = await post("/register", { name: "A", password: "secret123" });
  assert.equal(status, 400);
  assert.match(json.message, /username/);
});

test("register: missing name returns 400", async () => {
  const { status, json } = await post("/register", { username: "no_name", password: "secret123" });
  assert.equal(status, 400);
  assert.match(json.message, /name/);
});

test("register: missing password returns 400", async () => {
  const { status, json } = await post("/register", { username: "no_pass", name: "A" });
  assert.equal(status, 400);
  assert.match(json.message, /password/);
});

test("register: a short password returns 400", async () => {
  const { status, json } = await post("/register", { username: "short_pw", name: "A", password: "123" });
  assert.equal(status, 400);
  assert.match(json.message, /at least 6/);
});

test("register: a password longer than 72 bytes returns 400", async () => {
  const { status } = await post("/register", { username: "long_pw", name: "A", password: "x".repeat(73) });
  assert.equal(status, 400);
});

test("register: a username with spaces or symbols returns 400", async () => {
  const { status } = await post("/register", { username: "bad name!", name: "A", password: "secret123" });
  assert.equal(status, 400);
});

test("register: an empty body lists every problem", async () => {
  const { status, json } = await post("/register", {});
  assert.equal(status, 400);
  assert.match(json.message, /username/);
  assert.match(json.message, /name/);
  assert.match(json.message, /password/);
});

test("register: broken JSON returns 400", async () => {
  const { status, json } = await post("/register", undefined, "{ username: ");
  assert.equal(status, 400);
  assert.equal(json.message, "Request body is not valid JSON");
});

test("register: the trailing slash version of the path also works", async () => {
  const { status } = await post("/register/", { username: "slash_03", name: "Slash", password: "secret123" });
  assert.equal(status, 201);
});

// ---------- login ----------
let token;
test("login: correct credentials return 200 and a jwt_token", async () => {
  const { status, json } = await post("/login", { username: "yash_01", password: "secret123" });
  assert.equal(status, 200);
  assert.equal(typeof json.jwt_token, "string");
  assert.equal(json.jwt_token.split(".").length, 3);
  token = json.jwt_token;
});

test("login: the token verifies with the secret and holds only the username", async () => {
  const payload = jwt.verify(token, SECRET_KEY);
  assert.equal(payload.username, "yash_01");
  assert.deepEqual(Object.keys(payload).sort(), ["exp", "iat", "username"]);
  assert.ok(!JSON.stringify(payload).includes("secret123"));
});

test("login: the token header says HS256", async () => {
  const header = JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString());
  assert.equal(header.alg, "HS256");
  assert.equal(header.typ, "JWT");
});

test("login: a token checked with a wrong secret is rejected", async () => {
  assert.throws(() => jwt.verify(token, "some_other_secret"));
});

test("login: the username is not case sensitive", async () => {
  const { status } = await post("/login", { username: "YASH_01", password: "secret123" });
  assert.equal(status, 200);
});

test("login: an unknown user returns 400", async () => {
  const { status, json } = await post("/login", { username: "nobody", password: "secret123" });
  assert.equal(status, 400);
  assert.equal(json.message, "Invalid user");
});

test("login: a wrong password returns 400", async () => {
  const { status, json } = await post("/login", { username: "yash_01", password: "wrongpass" });
  assert.equal(status, 400);
  assert.equal(json.message, "Invalid password");
});

test("login: a password with the wrong letter case is rejected", async () => {
  const { status } = await post("/login", { username: "yash_01", password: "SECRET123" });
  assert.equal(status, 400);
});

test("login: a missing password returns 400", async () => {
  const { status, json } = await post("/login", { username: "yash_01" });
  assert.equal(status, 400);
  assert.match(json.message, /password/);
});

test("login: a missing username returns 400", async () => {
  const { status } = await post("/login", { password: "secret123" });
  assert.equal(status, 400);
});

test("login: a SQL injection attempt in the username is just an unknown user", async () => {
  const { status, json } = await post("/login", { username: "' OR '1'='1", password: "x" });
  assert.equal(status, 400);
  assert.equal(json.message, "Invalid user");
});

test("login: a failed login does not return a token", async () => {
  const { json } = await post("/login", { username: "yash_01", password: "wrongpass" });
  assert.equal(json.jwt_token, undefined);
});

// ---------- general ----------
test("GET / returns the endpoint list", async () => {
  const res = await fetch(base + "/");
  const json = await res.json();
  assert.equal(res.status, 200);
  assert.equal(json.endpoints.length, 2);
});

test("unknown route returns 404 in the same JSON format", async () => {
  const res = await fetch(base + "/profile");
  const json = await res.json();
  assert.equal(res.status, 404);
  assert.ok(json.message);
});
