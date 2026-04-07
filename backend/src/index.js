const http = require("http");

const { createApp, registerWebSocketHandlers } = require("./app");
const env = require("./config/env");
const { createSwaggerSpec } = require("./swagger");
const { DatabaseService } = require("./services/databaseService");
const { ForumNodeService } = require("./services/forumNodeService");
const { ForumScraper } = require("./services/forumScraper");
const { RutrackerClient } = require("./services/rutrackerClient");
const { ScrapeService } = require("./services/scrapeService");
const { TopicParser } = require("./services/topicParser");
const { TopicScrapeService } = require("./services/topicScrapeService");
const { TopicService } = require("./services/topicService");
const { WebSocketHub } = require("./services/webSocketHub");

const logger = {
  info: (message) => console.log(`[INFO] ${message}`),
  warn: (message) => console.warn(`[WARN] ${message}`),
  error: (message) => console.error(`[ERROR] ${message}`)
};

const bootstrap = async () => {
  const server = http.createServer();
  const databaseService = new DatabaseService({
    mongoUri: env.mongoUri,
    dbName: env.mongoDbName,
    retryDelayMs: env.mongoRetryDelayMs,
    logger
  });
  const forumNodeService = new ForumNodeService();
  const topicService = new TopicService();
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
  const topicParser = new TopicParser({
    baseUrl: env.rutrackerBaseUrl
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
  const topicScrapeService = new TopicScrapeService({
    forumNodeService,
    topicService,
    topicParser,
    rutrackerClient,
    webSocketHub,
    logger,
    topicMaxTopicsPerRun: env.topicMaxTopicsPerRun
  });
  const swaggerSpec = createSwaggerSpec({ port: env.port });
  const app = createApp({
    databaseService,
    forumNodeService,
    topicService,
    scrapeService,
    topicScrapeService,
    swaggerSpec
  });
  server.on("request", app);

  registerWebSocketHandlers({
    webSocketHub,
    databaseService,
    forumNodeService,
    topicService,
    scrapeService,
    topicScrapeService
  });

  databaseService.on("connected", () => {
    scrapeService.scheduleStartupScrape();
    topicScrapeService.tryStartupScrape().catch((error) => {
      logger.warn(`Unable to start initial topic scrape: ${error.message}`);
    });
  });

  scrapeService.on("completed", () => {
    topicScrapeService.tryStartupScrape().catch((error) => {
      logger.warn(`Unable to start initial topic scrape after forum scrape: ${error.message}`);
    });
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
