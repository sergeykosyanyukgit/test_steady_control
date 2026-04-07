const http = require("http");
const path = require("path");
const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();
const server = http.createServer(app);
const port = Number(process.env.PORT || 8080);
const apiTarget = process.env.API_TARGET || "http://api:3000";
const distPath = path.join(__dirname, "dist");

const apiProxy = createProxyMiddleware({
  target: apiTarget,
  changeOrigin: true,
  pathFilter: ["/api", "/docs"]
});

const wsProxy = createProxyMiddleware({
  target: apiTarget,
  changeOrigin: true,
  ws: true,
  pathFilter: ["/ws"]
});

app.use(apiProxy);
app.use(wsProxy);
app.use(express.static(distPath));

app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

server.on("upgrade", wsProxy.upgrade);

server.listen(port, () => {
  console.log(`Frontend server listening on port ${port}`);
});
