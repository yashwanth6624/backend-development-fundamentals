const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

// GET /  -> welcome text
app.get("/", (req, res) => {
  res.send("Welcome to my first Express server!");
});

// GET /about  -> JSON with name and section
app.get("/about", (req, res) => {
  res.json({
    name: "Talla Yashwanth",
    section: "S-21/307"
  });
});

// GET /time  -> current date and time
app.get("/time", (req, res) => {
  const now = new Date();
  res.send("Current date and time: " + now.toString());
});

// Any other path -> 404 message (this must stay at the bottom)
app.use((req, res) => {
  res.status(404).send("404 Not Found: this route does not exist");
});

app.listen(PORT, () => {
  console.log("Express server running on http://localhost:" + PORT);
});
