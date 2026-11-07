// Automated version of the Postman test list. Run with: npm test
// It starts the app on a random port with a temporary database file.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");
const fs = require("fs");

const dbFile = path.join(os.tmpdir(), `lab03-test-${Date.now()}.db`);
process.env.DB_PATH = dbFile;
const { createApp } = require("../server");

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
  await db.close();
  try {
    fs.rmSync(dbFile, { force: true, maxRetries: 5, retryDelay: 100 });
  } catch (err) {
    console.warn("Could not delete the temporary test database:", err.code);
  }
});

async function call(method, url, body, rawBody) {
  const options = { method, headers: {} };
  if (body !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  if (rawBody !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = rawBody;
  }
  const res = await fetch(base + url, options);
  return { status: res.status, json: await res.json() };
}

// ---------- success cases ----------
test("GET /books returns 200 with defaults (limit 10, offset 0, ordered by id)", async () => {
  const { status, json } = await call("GET", "/books");
  assert.equal(status, 200);
  assert.equal(json.limit, 10);
  assert.equal(json.offset, 0);
  assert.equal(json.total, 12);
  assert.equal(json.count, 10);
  assert.equal(json.data[0].id, 1);
});

test("search_q does a partial, case-insensitive title match", async () => {
  const { status, json } = await call("GET", "/books?search_q=sql");
  assert.equal(status, 200);
  assert.equal(json.total, 2);
  assert.ok(json.data.every((b) => b.title.toLowerCase().includes("sql")));
});

test("order_by=price&order=DESC sorts from highest price", async () => {
  const { json } = await call("GET", "/books?order_by=price&order=DESC");
  const prices = json.data.map((b) => b.price);
  assert.deepEqual(prices, [...prices].sort((a, b) => b - a));
});

test("limit and offset paginate the result", async () => {
  const { json } = await call("GET", "/books?limit=5&offset=5");
  assert.equal(json.count, 5);
  assert.equal(json.data[0].id, 6);
});

test("min_price and max_price filter the price range", async () => {
  const { json } = await call("GET", "/books?min_price=300&max_price=450");
  assert.ok(json.total > 0);
  assert.ok(json.data.every((b) => b.price >= 300 && b.price <= 450));
});

test("filters can be combined", async () => {
  const { status, json } = await call("GET", "/books?search_q=java&max_price=400&order_by=title");
  assert.equal(status, 200);
  assert.ok(json.data.every((b) => b.title.toLowerCase().includes("java") && b.price <= 400));
});

test("a LIKE wildcard typed by the user is treated as normal text", async () => {
  const { json } = await call("GET", "/books?search_q=%25");
  assert.equal(json.total, 0);
});

test("a SQL injection attempt in search_q returns no rows and no error", async () => {
  const { status, json } = await call("GET", "/books?search_q=' OR '1'='1");
  assert.equal(status, 200);
  assert.equal(json.total, 0);
});

test("GET /books/:id returns 200 for an existing book", async () => {
  const { status, json } = await call("GET", "/books/1");
  assert.equal(status, 200);
  assert.equal(json.data.id, 1);
});

let createdId;
test("POST /books creates a book and returns 201", async () => {
  const { status, json } = await call("POST", "/books", { title: "Test Book", author: "Tester", price: 199.5 });
  assert.equal(status, 201);
  assert.equal(json.message, "Book created");
  assert.equal(json.data.title, "Test Book");
  createdId = json.data.id;
});

test("PUT /books/:id updates the book and returns 200", async () => {
  const { status, json } = await call("PUT", `/books/${createdId}`, { title: "Test Book v2", author: "Tester", price: 250 });
  assert.equal(status, 200);
  assert.equal(json.data.title, "Test Book v2");
});

test("DELETE /books/:id deletes the book and returns 200", async () => {
  const { status } = await call("DELETE", `/books/${createdId}`);
  assert.equal(status, 200);
});

// ---------- failure cases ----------
test("deleted book now gives 404", async () => {
  const { status, json } = await call("GET", `/books/${createdId}`);
  assert.equal(status, 404);
  assert.ok(json.message);
});

test("POST with missing title returns 400", async () => {
  const { status, json } = await call("POST", "/books", { author: "A", price: 100 });
  assert.equal(status, 400);
  assert.match(json.message, /title/);
});

test("POST with missing author returns 400", async () => {
  const { status, json } = await call("POST", "/books", { title: "T", price: 100 });
  assert.equal(status, 400);
  assert.match(json.message, /author/);
});

test("POST with a non-numeric price returns 400", async () => {
  const { status, json } = await call("POST", "/books", { title: "T", author: "A", price: "abc" });
  assert.equal(status, 400);
  assert.match(json.message, /price must be a number/);
});

test("POST with a negative price returns 400", async () => {
  const { status } = await call("POST", "/books", { title: "T", author: "A", price: -5 });
  assert.equal(status, 400);
});

test("POST with an empty body returns 400 and lists every problem", async () => {
  const { status, json } = await call("POST", "/books", {});
  assert.equal(status, 400);
  assert.match(json.message, /title/);
  assert.match(json.message, /author/);
  assert.match(json.message, /price/);
});

test("POST with broken JSON returns 400", async () => {
  const { status, json } = await call("POST", "/books", undefined, "{ title: ");
  assert.equal(status, 400);
  assert.equal(json.message, "Request body is not valid JSON");
});

test("PUT with an unknown id returns 404", async () => {
  const { status } = await call("PUT", "/books/9999", { title: "T", author: "A", price: 1 });
  assert.equal(status, 404);
});

test("PUT with invalid data returns 400", async () => {
  const { status } = await call("PUT", "/books/1", { title: "", author: "A", price: 1 });
  assert.equal(status, 400);
});

test("DELETE with an unknown id returns 404", async () => {
  const { status } = await call("DELETE", "/books/9999");
  assert.equal(status, 404);
});

test("a non-numeric id returns 400 (bad input, not a missing record)", async () => {
  const { status } = await call("GET", "/books/abc");
  assert.equal(status, 400);
});

test("invalid order_by returns 400 (whitelist protects ORDER BY)", async () => {
  const { status, json } = await call("GET", "/books?order_by=price;DROP TABLE books");
  assert.equal(status, 400);
  assert.match(json.message, /order_by/);
});

test("invalid order returns 400", async () => {
  const { status } = await call("GET", "/books?order=sideways");
  assert.equal(status, 400);
});

test("limit out of range returns 400", async () => {
  assert.equal((await call("GET", "/books?limit=0")).status, 400);
  assert.equal((await call("GET", "/books?limit=1000")).status, 400);
  assert.equal((await call("GET", "/books?limit=abc")).status, 400);
});

test("negative offset returns 400", async () => {
  assert.equal((await call("GET", "/books?offset=-1")).status, 400);
});

test("non-numeric min_price returns 400", async () => {
  assert.equal((await call("GET", "/books?min_price=cheap")).status, 400);
});

test("min_price greater than max_price returns 400", async () => {
  const { status, json } = await call("GET", "/books?min_price=500&max_price=100");
  assert.equal(status, 400);
  assert.match(json.message, /min_price/);
});

test("unknown route returns 404 in the same JSON format", async () => {
  const { status, json } = await call("GET", "/authors");
  assert.equal(status, 404);
  assert.ok(json.message);
});
