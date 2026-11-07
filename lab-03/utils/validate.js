// All validation lives here so the route handlers stay short.
// Every function returns either { value } or { error: "message" }.

const ORDER_BY_COLUMNS = ["id", "title", "author", "price"];

// Accepts numbers and numeric strings like "250.5", rejects "abc", "", null, true
function toNumber(raw) {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : NaN;
  if (typeof raw === "string" && raw.trim() !== "") return Number(raw);
  return NaN;
}

function validateId(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    return { error: "id must be a positive whole number" };
  }
  return { value: n };
}

// Used by POST and PUT
function validateBookBody(body) {
  const errors = [];
  const data = body && typeof body === "object" ? body : {};

  const title = typeof data.title === "string" ? data.title.trim() : "";
  const author = typeof data.author === "string" ? data.author.trim() : "";
  if (!title) errors.push("title is required and must be a non-empty string");
  if (!author) errors.push("author is required and must be a non-empty string");

  let price;
  if (data.price === undefined || data.price === null || data.price === "") {
    errors.push("price is required");
  } else {
    price = toNumber(data.price);
    if (Number.isNaN(price)) errors.push("price must be a number");
    else if (price < 0) errors.push("price cannot be negative");
  }

  if (errors.length > 0) return { error: errors.join("; ") };
  return { value: { title, author, price } };
}

// Used by GET /books
function validateListQuery(query) {
  const out = {
    search_q: "",
    order_by: "id",
    order: "ASC",
    limit: 10,
    offset: 0,
    min_price: null,
    max_price: null,
  };

  if (query.search_q !== undefined) out.search_q = String(query.search_q).trim();

  if (query.order_by !== undefined) {
    const col = String(query.order_by).toLowerCase();
    if (!ORDER_BY_COLUMNS.includes(col)) {
      return { error: `order_by must be one of: ${ORDER_BY_COLUMNS.join(", ")}` };
    }
    out.order_by = col;
  }

  if (query.order !== undefined) {
    const dir = String(query.order).toUpperCase();
    if (dir !== "ASC" && dir !== "DESC") {
      return { error: "order must be ASC or DESC" };
    }
    out.order = dir;
  }

  if (query.limit !== undefined) {
    const n = Number(query.limit);
    if (!Number.isInteger(n) || n < 1 || n > 100) {
      return { error: "limit must be a whole number between 1 and 100" };
    }
    out.limit = n;
  }

  if (query.offset !== undefined) {
    const n = Number(query.offset);
    if (!Number.isInteger(n) || n < 0) {
      return { error: "offset must be a whole number, 0 or more" };
    }
    out.offset = n;
  }

  for (const key of ["min_price", "max_price"]) {
    if (query[key] !== undefined) {
      const n = toNumber(query[key]);
      if (Number.isNaN(n)) return { error: `${key} must be a number` };
      out[key] = n;
    }
  }
  if (out.min_price !== null && out.max_price !== null && out.min_price > out.max_price) {
    return { error: "min_price cannot be greater than max_price" };
  }

  return { value: out };
}

module.exports = { validateId, validateBookBody, validateListQuery, ORDER_BY_COLUMNS };
