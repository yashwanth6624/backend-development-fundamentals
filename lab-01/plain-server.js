const http = require("http");

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/plain");
  res.end("Hello");
});

server.listen(3000, () => {
  console.log("Plain http server running on http://localhost:3000");
});
