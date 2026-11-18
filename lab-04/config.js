// Lab 4 keeps the secret key in a constant, as the lab sheet says.
// This is a demo value for learning only. In Lab 8 it moves to a .env file,
// and a real secret key must never be committed to GitHub.
const SECRET_KEY = "lab4_demo_secret_key";

const TOKEN_EXPIRY = "1h"; // the token stops working after one hour
const SALT_ROUNDS = 10;    // bcrypt cost factor, higher is slower and safer

module.exports = { SECRET_KEY, TOKEN_EXPIRY, SALT_ROUNDS };
