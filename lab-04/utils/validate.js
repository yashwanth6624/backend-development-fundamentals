// Every function returns either { value } or { error: "message" }.

function validateRegister(body) {
  const data = body && typeof body === "object" ? body : {};
  const errors = [];

  const username = typeof data.username === "string" ? data.username.trim() : "";
  const name = typeof data.name === "string" ? data.name.trim() : "";
  const password = typeof data.password === "string" ? data.password : "";

  if (!username) {
    errors.push("username is required");
  } else if (!/^[A-Za-z0-9_]{3,30}$/.test(username)) {
    errors.push("username must be 3 to 30 characters: letters, numbers and underscore only");
  }

  if (!name) errors.push("name is required");
  else if (name.length > 60) errors.push("name must be 60 characters or less");

  if (!password) {
    errors.push("password is required");
  } else if (password.length < 6) {
    errors.push("password must be at least 6 characters");
  } else if (Buffer.byteLength(password, "utf8") > 72) {
    // bcrypt only reads the first 72 bytes, so longer passwords are refused
    errors.push("password must be 72 bytes or less");
  }

  if (errors.length > 0) return { error: errors.join("; ") };
  return { value: { username, name, password } };
}

function validateLogin(body) {
  const data = body && typeof body === "object" ? body : {};
  const errors = [];
  const username = typeof data.username === "string" ? data.username.trim() : "";
  const password = typeof data.password === "string" ? data.password : "";

  if (!username) errors.push("username is required");
  if (!password) errors.push("password is required");

  if (errors.length > 0) return { error: errors.join("; ") };
  return { value: { username, password } };
}

module.exports = { validateRegister, validateLogin };
