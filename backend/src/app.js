const express = require("express");
const swaggerUi = require("swagger-ui-express");

const INVALID_TOPIC_SOURCE_MESSAGE =
  "A valid subforum or leaf forum must be selected for topic scraping.";

const createApp = ({
  databaseService,
  forumNodeService,
  topicService,
  scrapeService,
  topicScrapeService,
  swaggerSpec
}) => {
  const app = express();

  app.use(express.json());
  app.get("/docs/openapi.json", (req, res) => {
    res.json(swaggerSpec);
  });
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));

  app.get("/api/health", (req, res) => {
    res.json({
      name: "rutracker-parser-api",
      uptimeSeconds: Math.round(process.uptime()),
      database: databaseService.getStatus(),
      scraper: scrapeService.getStatus(),
      topicScraper: topicScrapeService.getStatus(),
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

  app.get("/api/topics/subforums/summary", async (req, res, next) => {
    try {
      const summary = await topicService.getLoadedSubforumsSummary();
      res.json(summary);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/topics", async (req, res, next) => {
    const { subforumExternalId, page = 1, pageSize = 10 } = req.query;

    if (!subforumExternalId) {
      res.status(400).json({
        message: "Query parameter subforumExternalId is required."
      });
      return;
    }

    try {
      const result = await topicService.getTopicsPage({
        subforumExternalId,
        page,
        pageSize
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/topics/scrape/status", (req, res) => {
    res.json(topicScrapeService.getStatus());
  });

  app.post("/api/topics/scrape", async (req, res, next) => {
    const { subforumExternalId } = req.body || {};

    if (!subforumExternalId) {
      res.status(400).json({
        message: "Field subforumExternalId is required."
      });
      return;
    }

    try {
      const result = await topicScrapeService.start({
        subforumExternalId,
        trigger: "manual"
      });

      if (!result.started) {
        res.status(409).json({
          message: "Topic scrape is already running.",
          status: result.status
        });
        return;
      }

      res.status(202).json({
        message: "Topic scrape has been started.",
        status: result.status
      });
    } catch (error) {
      if (error.message === INVALID_TOPIC_SOURCE_MESSAGE) {
        res.status(400).json({
          message: error.message
        });
        return;
      }

      next(error);
    }
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

  return app;
};

const registerWebSocketHandlers = ({
  webSocketHub,
  databaseService,
  forumNodeService,
  topicService,
  scrapeService,
  topicScrapeService
}) => {
  webSocketHub.onConnection(async (socket) => {
    webSocketHub.send(socket, "status", scrapeService.getStatus());
    webSocketHub.send(socket, "topic_scrape_status", topicScrapeService.getStatus());

    if (!databaseService.isConnected()) {
      webSocketHub.send(socket, "status", {
        ...scrapeService.getStatus(),
        message: "Waiting for MongoDB connection."
      });
      webSocketHub.send(socket, "topic_scrape_status", {
        ...topicScrapeService.getStatus(),
        message: "Waiting for MongoDB connection."
      });
      return;
    }

    const snapshot = await forumNodeService.getTreeSnapshot();
    const topicsSummary = await topicService.getLoadedSubforumsSummary();
    webSocketHub.send(socket, "tree_snapshot", snapshot);
    webSocketHub.send(socket, "topics_summary", topicsSummary);
  });
};

module.exports = {
  createApp,
  registerWebSocketHandlers,
  INVALID_TOPIC_SOURCE_MESSAGE
};
