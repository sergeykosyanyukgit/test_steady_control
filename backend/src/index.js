const http = require("http");
const express = require("express");
const swaggerUi = require("swagger-ui-express");

const env = require("./config/env");
const { createSwaggerSpec } = require("./swagger");
const { DatabaseService } = require("./services/databaseService");
const { ForumNodeService } = require("./services/forumNodeService");
const { ForumScraper } = require("./services/forumScraper");
const { RutrackerClient } = require("./services/rutrackerClient");
const { ScrapeService } = require("./services/scrapeService");
const { WebSocketHub } = require("./services/webSocketHub");

const logger = {
  info: (message) => console.log(`[INFO] ${message}`),
  warn: (message) => console.warn(`[WARN] ${message}`),
  error: (message) => console.error(`[ERROR] ${message}`)
};

const bootstrap = async () => {
  const app = express();
  const server = http.createServer(app);

  const databaseService = new DatabaseService({
    mongoUri: env.mongoUri,
    dbName: env.mongoDbName,
    retryDelayMs: env.mongoRetryDelayMs,
    logger
  });
  const forumNodeService = new ForumNodeService();
  const forumScraper = new ForumScraper({
    baseUrl: env.rutrackerBaseUrl
  });
  const rutrackerClient = new RutrackerClient({
    baseUrl: env.rutrackerBaseUrl,
    indexPath: env.rutrackerIndexPath,
    bbSession: env.rutrackerBbSession,
    requestTimeoutMs: env.requestTimeoutMs
  });
  const webSocketHub = new WebSocketHub({
    server,
    path: "/ws",
    logger
  });
  const scrapeService = new ScrapeService({
    forumNodeService,
    forumScraper,
    rutrackerClient,
    webSocketHub,
    logger,
    scrapeOnStartup: env.scrapeOnStartup,
    scrapeStartupDelayMs: env.scrapeStartupDelayMs
  });
  const swaggerSpec = createSwaggerSpec({ port: env.port });

  app.use(express.json());
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));
  app.get("/docs/openapi.json", (req, res) => {
    res.json(swaggerSpec);
  });

  app.get("/api/health", (req, res) => {
    res.json({
      name: "rutracker-parser-api",
      uptimeSeconds: Math.round(process.uptime()),
      database: databaseService.getStatus(),
      scraper: scrapeService.getStatus(),
      now: new Date().toISOString()
    });
  });

  app.get("/api/forum-nodes/tree", async (req, res, next) => {
    if (!databaseService.isConnected()) {
      res.status(503).json({
        message: "MongoDB is not connected yet."
      });
      return;
    }

    try {
      const snapshot = await forumNodeService.getTreeSnapshot();
      res.json(snapshot);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/scrape/status", (req, res) => {
    res.json(scrapeService.getStatus());
  });

  app.post("/api/scrape/run", (req, res) => {
    const result = scrapeService.start("manual");

    if (!result.started) {
      res.status(409).json({
        message: "Scrape is already running.",
        status: result.status
      });
      return;
    }

    res.status(202).json({
      message: "Scrape has been started.",
      status: result.status
    });
  });

  app.use((req, res) => {
    res.status(404).json({
      message: "Route not found."
    });
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    res.status(500).json({
      message: error.message || "Internal server error."
    });
  });

  webSocketHub.onConnection(async (socket) => {
    webSocketHub.send(socket, "status", scrapeService.getStatus());

    if (!databaseService.isConnected()) {
      webSocketHub.send(socket, "status", {
        ...scrapeService.getStatus(),
        message: "Waiting for MongoDB connection."
      });
      return;
    }

    const snapshot = await forumNodeService.getTreeSnapshot();
    webSocketHub.send(socket, "tree_snapshot", snapshot);
  });

  databaseService.on("connected", () => {
    scrapeService.scheduleStartupScrape();
  });

  await databaseService.start();

  server.listen(env.port, () => {
    logger.info(`API listening on port ${env.port}`);
    logger.info(`Swagger UI available at http://localhost:${env.port}/docs`);
  });
};

bootstrap().catch((error) => {
  console.error(`[FATAL] ${error.message}`);
  process.exit(1);
});
