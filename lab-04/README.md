# Lab 4: Registration, login and JWT

**Name:** Talla Yashwanth | **Registration number:** 252U1R3092 | **Section:** S-21/307

**Subject:** Backend Development Fundamentals (Year II, Term II)

**Live link:** https://YOUR-SERVICE-NAME.onrender.com *(replace this with your Render URL after deploying, see the Deployment section)*

---

## About this lab

This lab adds user accounts to the Express and SQLite setup from Labs 2 and 3. A user can **register** with a username, name and password, and then **log in** to receive a **JWT token**. Passwords are hashed with bcrypt before they are saved, so the database never holds a readable password, and the token holds only the username.

| Area | What was built |
| --- | --- |
| Registration | `POST /register` creates a user, rejects an existing username with 400 |
| Password safety | `bcrypt.hash` on register, `bcrypt.compare` on login, only the hash is stored |
| Login | `POST /login` returns `{ "jwt_token": "..." }`, 400 for an unknown user or a wrong password |
| Token | `jwt.sign` with only the username in the payload, a secret key constant and a 1 hour expiry |
| Validation | Username, name and password are checked before any database work |
| Database | SQLite `users` table with a unique username, parameterised queries only |
| Testing | 16 Postman requests (24 assertions) and 28 automated tests with `npm test` |

---

## Concepts used in this lab

### 1. Authentication vs authorization

| | Authentication | Authorization |
| --- | --- | --- |
| Question | Who are you? | What are you allowed to do? |
| This lab | Register and login, proving who the user is | Not yet, protecting routes with the token comes in a later lab |

*Real world analogy:* showing your college ID card at the gate is authentication. The gate guard then deciding which buildings you can enter is authorization.

### 2. Why passwords are hashed

If passwords are saved as plain text, anyone who gets the database (a leak, a stolen backup, a curious admin) can read every password, and many people reuse the same password on other sites. So the database stores a **hash**, a scrambled fingerprint of the password that cannot be turned back into the original.

### 3. Hash vs encrypt

| | Hashing | Encryption |
| --- | --- | --- |
| Direction | One way, the original cannot be recovered | Two way, the original can be recovered with the key |
| Needs a key? | No (bcrypt adds a random salt) | Yes |
| Used for | Passwords | Data that must be read again, like messages or files |
| Checking a password | Hash the typed password and compare the hashes | Decrypt and compare, which is the weaker design for passwords |

For passwords we never need to read the original again, we only need to check whether the typed password matches, so hashing is the right tool.

### 4. How bcrypt works

- **Salt:** a random value added before hashing. Two users with the same password get different hashes, and ready made lists of common password hashes (rainbow tables) do not work.
- **Cost factor:** `SALT_ROUNDS = 10` means 2 to the power of 10 rounds of work. bcrypt is slow on purpose, so guessing millions of passwords becomes expensive for an attacker.
- **Stored format:** a bcrypt hash is always 60 characters, like `$2b$10$` + 22 characters of salt + 31 characters of hash. The salt and cost are stored inside the hash, so no extra column is needed.
- **`bcrypt.hash(password, rounds)`** creates the hash on registration.
- **`bcrypt.compare(password, hash)`** reads the salt and cost from the stored hash, hashes the typed password the same way and tells true or false.
- bcrypt only reads the first **72 bytes** of a password, so longer passwords are refused with 400.

### 5. The two flows

**Registration**
1. Read and validate the JSON body (username, name, password).
2. Look for the username in the table. If it exists, return 400.
3. Hash the password with `bcrypt.hash`.
4. Insert username, name and the hash. Return 201 without the password or the hash.

**Login**
1. Read and validate the JSON body (username, password).
2. Find the user. If there is none, return 400.
3. `bcrypt.compare` the typed password with the stored hash. If false, return 400.
4. Create the token with `jwt.sign` and return `{ "jwt_token": "..." }` with 200.

### 6. Why POST for login

| Reason | Explanation |
| --- | --- |
| The password must not be in the URL | A GET request puts data in the URL, and URLs are saved in browser history, server logs and proxies. A POST sends it in the body |
| Not cached or bookmarked | Browsers and proxies can cache GET responses, a login response must never be cached |
| Login creates something new | It issues a token. GET is meant to be safe and only read data |

### 7. What is a JWT?

A JSON Web Token is a signed string that proves who the user is, so the server does not need to keep a session in memory (this is the stateless idea from Lab 3). It has **three parts joined by dots**:

| Part | What it holds | Example from this project |
| --- | --- | --- |
| Header | Token type and signing algorithm | `{"alg":"HS256","typ":"JWT"}` |
| Payload | The claims, the data about the user | `{"username":"yash_01","iat":...,"exp":...}` |
| Signature | A signature made from the header, payload and the secret key | Checks that nobody changed the token |

- The header and payload are only **Base64URL encoded, not encrypted**, so anyone can decode and read them. The signature is what protects the token from being changed, because creating a valid signature needs the secret key.
- `iat` (issued at) and `exp` (expires at) are added by the library. The only custom value is the username.

### 8. What `jwt.sign` needs

```js
const jwt_token = jwt.sign({ username: user.username }, SECRET_KEY, { expiresIn: "1h" });
```

| Argument | Meaning |
| --- | --- |
| Payload | The data to put in the token, here only the username |
| Secret key | The private string used to sign, it must stay secret |
| Options | Optional, like `expiresIn`. The default algorithm is HS256 |

To check a token later, the server calls `jwt.verify(token, SECRET_KEY)`. It throws an error if the token was changed, signed with a different key or has expired.

### 9. What should never go into the payload

Never put the **password or its hash**, card or bank details, OTPs or any other private data in the payload, because anyone who has the token can decode it. Keep the payload small, only what the server needs to know who the user is.

### 10. The secret key

For this lab the key is a constant in `config.js`, as the lab sheet says. It is a demo value only. In Lab 8 it moves to a `.env` file. If a real secret key leaks, anyone can create valid tokens for any user, so it must never be committed to GitHub.

### 11. Status codes in this lab

| Code | Used when |
| --- | --- |
| 201 Created | A new user was registered |
| 200 OK | Login succeeded and the token was returned |
| 400 Bad Request | Invalid input, an existing username, an unknown user, a wrong password or broken JSON |
| 404 Not Found | The route does not exist |
| 500 Internal Server Error | A server bug, only the short message `Internal server error` is sent and the details stay in the server log |

**Note on messages:** the lab asks for a 400 for an unknown user and a 400 for a wrong password, and this project uses two messages (`Invalid user` and `Invalid password`) so each case is clear while learning. A real application would often return one message such as `Invalid username or password`, because two different messages tell an attacker which usernames exist.

### 12. Validation rules

| Input | Rule | Failure |
| --- | --- | --- |
| `username` | Required, 3 to 30 characters: letters, numbers and underscore | 400 |
| `name` | Required, 60 characters or less | 400 |
| `password` | Required, at least 6 characters and 72 bytes or less | 400 |
| Request body | Must be valid JSON | 400 |

### 13. Safe database access

- All SQL uses `?` placeholders, so input like `' OR '1'='1` is only treated as a username that does not exist.
- The `username` column is `UNIQUE` with `COLLATE NOCASE`, so `Yash` and `yash` are the same username. If two requests with the same username arrive at the same moment, the table constraint stops the second one and the route still returns 400.

---

## Endpoints

| Method | Path | Description | Success | Failure |
| --- | --- | --- | --- | --- |
| GET | `/` | API name and endpoint list | 200 | |
| POST | `/register` | Create a user with a hashed password (also works as `/register/`) | 201 | 400 |
| POST | `/login` | Check the password and return a JWT (also works as `/login/`) | 200 | 400 |

### Request bodies

`POST /register`

```json
{ "username": "yash_01", "name": "Talla Yashwanth", "password": "secret123" }
```

`POST /login`

```json
{ "username": "yash_01", "password": "secret123" }
```

### Example responses

Register returns **201**:

```json
{ "message": "User created successfully", "data": { "id": 1, "username": "yash_01", "name": "Talla Yashwanth" } }
```

Login returns **200**:

```json
{ "jwt_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...." }
```

Wrong password returns **400**:

```json
{ "message": "Invalid password" }
```

---

## Decoding the token

Paste a token into https://jwt.io and the page shows the three parts. This is a real token from this project, signed with the demo key `lab4_demo_secret_key`:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6Inlhc2hfMDEiLCJpYXQiOjE3OTQ5NzQ4NDQsImV4cCI6MTc5NDk3ODQ0NH0.6u4SkGfpOLvJJkjrT6Zg-64GBdt2TsUnCxzJlnZzutQ
```

| Part | Decoded value |
| --- | --- |
| **Header** (`eyJhbGciOiJI...`) | `{"alg":"HS256","typ":"JWT"}` |
| **Payload** (`eyJ1c2VybmFt...`) | `{"username":"yash_01","iat":1794974844,"exp":1794978444}` |
| **Signature** (`6u4SkGfpOLvJ...`) | A hash of the header and payload made with the secret key, it cannot be read as text |

To see **Signature Verified** on jwt.io, type `lab4_demo_secret_key` in the secret box under the signature. Change one letter of the payload and the signature check fails, which shows why a changed token is rejected.

---

## How to run

**Requirements:** Node.js 20 or newer and npm.

```bash
# 1. go into the lab folder
cd lab-04

# 2. install the packages (express, sqlite, sqlite3, bcrypt, jsonwebtoken)
npm install

# 3. create your environment file (it is never committed)
cp .env.example .env        # on Windows: copy .env.example .env

# 4. start the server
npm start                   # or: npm run dev  (reads the .env file)
```

The server runs on http://localhost:3000.

### Environment variables

| Variable | Required | Description | Default |
| --- | --- | --- | --- |
| `PORT` | No | Port the server listens on (Render sets it automatically) | `3000` |
| `DB_PATH` | No | Path of the SQLite database file | `./users.db` |

`.env.example` lists the names with safe example values. The real `.env` file is in `.gitignore` and must never be committed. The JWT secret key is **not** an environment variable in this lab, it is a constant in `config.js` until Lab 8. The database file is created on the first start.

### Run the automated tests

```bash
npm test
```

This starts the app on a random port with a temporary database, runs 28 tests for success and failure cases, closes the database and deletes the temporary file.

### Run the Postman tests

1. Open Postman, choose **Import** and select `postman/BDF-Lab-04.postman_collection.json`.
2. Start the server (`npm start`).
3. The collection variable `baseUrl` is `http://localhost:3000`. Change it to the live link to test the deployed API.
4. Run the collection in order. It has 16 requests and 24 assertions. The first request creates a new random username each run, so the collection can be run again and again.

---

## Project structure

```
lab-04/
  server.js                 app setup, routes, 404 and error handler
  config.js                 secret key constant, token expiry, bcrypt rounds
  db.js                     opens SQLite and creates the users table
  routes/auth.js            POST /register and POST /login
  utils/validate.js         validation for the register and login bodies
  tests/auth.test.js        automated tests (npm test)
  postman/                  importable Postman collection
  screenshots/              proof of working output
  .env.example              environment variable names, no real values
  .gitignore                node_modules, .env and database files
  package.json
  README.md
```

---

## Postman test list

Each row is one request in the Postman collection. The same cases are also covered by the automated tests.

| ID | Type | Method | Request | Status | What to check |
| --- | --- | --- | --- | --- | --- |
| T01 | Success | POST | `/register` | 201 | message User created successfully, no password in the response |
| T02 | Success | POST | `/login` | 200 | jwt_token with 3 parts, saved for later |
| T03 | Success | POST | `/register/` | 201 | Works the same as /register |
| T04 | Failure | POST | `/register` | 400 | message: User already exists |
| T05 | Failure | POST | `/register` | 400 | message mentions name |
| T06 | Failure | POST | `/register` | 400 | message mentions username |
| T07 | Failure | POST | `/register` | 400 | message mentions password |
| T08 | Failure | POST | `/register` | 400 | message: password must be at least 6 characters |
| T09 | Failure | POST | `/register` | 400 | message explains the allowed characters |
| T10 | Failure | POST | `/register` | 400 | message: Request body is not valid JSON |
| T11 | Failure | POST | `/login` | 400 | message: Invalid user |
| T12 | Failure | POST | `/login` | 400 | message: Invalid password |
| T13 | Failure | POST | `/login` | 400 | message mentions password |
| T14 | Failure | POST | `/login` | 400 | message mentions username |
| T15 | Failure | POST | `/login` | 400 | message: Invalid user, nothing is exposed |
| T16 | Failure | GET | `/profile` | 404 | message: Route GET /profile not found |

---

## Screenshots

The outputs below are real responses from this server. The command is shown at the top of each image.

### Registration

![Register a new user returns 201](screenshots/01_register_201.png)

![Existing username returns 400](screenshots/02_register_duplicate_400.png)

![Missing name returns 400](screenshots/03_register_missing_name_400.png)

![Short password returns 400](screenshots/04_register_short_password_400.png)

![Broken JSON returns 400](screenshots/09_register_invalid_json_400.png)

### Login

![Correct login returns 200 and a token](screenshots/05_login_200.png)

![Unknown user returns 400](screenshots/06_login_unknown_user_400.png)

![Wrong password returns 400](screenshots/07_login_wrong_password_400.png)

![Missing password returns 400](screenshots/08_login_missing_password_400.png)

### Database, token and tests

![The users table stores hashes only](screenshots/10_database_view.png)

![The token decoded into header, payload and signature](screenshots/11_jwt_decoded.png)

![28 automated tests passing](screenshots/12_automated_tests_pass.png)

---

## Deployment

The API can be deployed on Render as a Web Service.

| Setting | Value |
| --- | --- |
| Repository | the course repository, branch `main` |
| Root Directory | `lab-04` |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Instance type | Free |
| Environment variables | `NODE_VERSION` = `22` (`PORT` is set by Render) |

**Package versions:** `sqlite3` is pinned to 5.1.7 because the newest version ships a file that needs a newer Linux library than Render has (`GLIBC_2.38 not found`). `bcrypt` 6 ships prebuilt files for Linux, Windows and macOS, so it installs without compiling anything.

The free plan sleeps when idle, so the first request after a break can take around 50 seconds. SQLite stores data in a file and the free plan's disk is not permanent, so **registered users are deleted when the service restarts or redeploys**. Register again before logging in after a restart. This is fine for a lab, and a real project would use a hosted database.

---

## Security checklist

- [x] Passwords are hashed with bcrypt and never stored or logged in plain text
- [x] The register response never contains the password or the hash
- [x] The token payload has only the username
- [x] The secret key is a demo constant for this lab and moves to `.env` in Lab 8
- [x] `.env` is in `.gitignore`, only `.env.example` is committed
- [x] `node_modules` and the database file are not committed
- [x] All SQL uses parameterised queries
- [x] Every route returns the right status code
- [x] Internal error details stay in the server log and the request body is never logged

---

## Notes: problems faced and how I solved them

| Problem | Solution |
| --- | --- |
| Two requests with the same username at the same time could both pass the "does it exist" check | Added a `UNIQUE` constraint on the column and handled the constraint error as a 400 |
| `Yash` and `yash` could be registered as two different users | Used `COLLATE NOCASE` on the username column |
| bcrypt silently ignores everything after 72 bytes of a password | Refused passwords longer than 72 bytes with 400 |
| Putting the password or hash in the token or the response would expose it | Kept only the username in the payload and returned only id, username and name from register |
| A leaked secret key lets anyone forge tokens | Kept it as a clearly marked demo constant for this lab and added an expiry of 1 hour. It moves to `.env` in Lab 8 |
| `sqlite3` 6 crashed on Render with `GLIBC_2.38 not found` | Pinned `sqlite3` to 5.1.7 and Node 22, as in Lab 3 |
| On Windows the test run could not delete its temporary database while it was still open | Closed the database connection before deleting the file |
