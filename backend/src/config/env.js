const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), "..", ".env") });
dotenv.config();

const toNumber = (value, fallback) => {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
};

module.exports = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: toNumber(process.env.PORT, 3000),
  mongoUri: process.env.MONGO_URI || "mongodb://mongo:27017/rutracker_parser",
  mongoDbName: process.env.MONGO_DB_NAME || "rutracker_parser",
  mongoRetryDelayMs: toNumber(process.env.MONGO_RETRY_DELAY_MS, 5000),
  rutrackerBaseUrl: process.env.RUTRACKER_BASE_URL || "https://rutracker.org/forum/",
  rutrackerIndexPath: process.env.RUTRACKER_INDEX_PATH || "index.php",
  rutrackerBbSession: process.env.RUTRACKER_BB_SESSION || "",
  requestTimeoutMs: toNumber(process.env.REQUEST_TIMEOUT_MS, 20000),
  scrapeOnStartup: process.env.SCRAPE_ON_STARTUP !== "false",
  scrapeStartupDelayMs: toNumber(process.env.SCRAPE_STARTUP_DELAY_MS, 3000)
};
