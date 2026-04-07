const EventEmitter = require("events");

class ScrapeService extends EventEmitter {
  constructor({
    forumNodeService,
    forumScraper,
    rutrackerClient,
    webSocketHub,
    logger,
    scrapeOnStartup,
    scrapeStartupDelayMs
  }) {
    super();
    this.forumNodeService = forumNodeService;
    this.forumScraper = forumScraper;
    this.rutrackerClient = rutrackerClient;
    this.webSocketHub = webSocketHub;
    this.logger = logger;
    this.scrapeOnStartup = scrapeOnStartup;
    this.scrapeStartupDelayMs = scrapeStartupDelayMs;
    this.currentPromise = null;
    this.startupScheduled = false;
    this.state = {
      state: "idle",
      trigger: null,
      startedAt: null,
      finishedAt: null,
      lastSuccessAt: null,
      lastSummary: null,
      lastError: null,
      message: "Scraper has not been started yet."
    };
  }

  isRunning() {
    return Boolean(this.currentPromise);
  }

  getStatus() {
    return {
      ...this.state,
      isRunning: this.isRunning()
    };
  }

  broadcastStatus() {
    this.webSocketHub.broadcast("status", this.getStatus());
  }

  async broadcastTreeSnapshot() {
    try {
      const snapshot = await this.forumNodeService.getTreeSnapshot();
      this.webSocketHub.broadcast("tree_snapshot", snapshot);
    } catch (error) {
      this.logger.warn(`Unable to broadcast tree snapshot: ${error.message}`);
    }
  }

  scheduleStartupScrape() {
    if (!this.scrapeOnStartup || this.startupScheduled) {
      return;
    }

    this.startupScheduled = true;

    setTimeout(() => {
      this.start("startup");
    }, this.scrapeStartupDelayMs);
  }

  start(trigger = "manual") {
    if (this.currentPromise) {
      return {
        started: false,
        status: this.getStatus()
      };
    }

    this.currentPromise = this.run(trigger)
      .catch((error) => {
        this.logger.error(`Scrape failed: ${error.message}`);
      })
      .finally(() => {
        this.currentPromise = null;
        this.broadcastStatus();
      });

    return {
      started: true,
      status: this.getStatus()
    };
  }

  async run(trigger) {
    const startedAt = new Date().toISOString();

    this.state = {
      ...this.state,
      state: "running",
      trigger,
      startedAt,
      finishedAt: null,
      lastError: null,
      message: `Scraping RuTracker forum structure (${trigger}).`
    };

    this.broadcastStatus();

    try {
      const html = await this.rutrackerClient.fetchForumIndexHtml();
      const scrapeResult = this.forumScraper.parseIndexPage(html);
      const persistenceSummary = await this.forumNodeService.upsertNodes(scrapeResult.nodes);
      const finishedAt = new Date().toISOString();

      this.state = {
        ...this.state,
        state: "completed",
        finishedAt,
        lastSuccessAt: finishedAt,
        lastSummary: {
          scrapedAt: scrapeResult.scrapedAt.toISOString(),
          categories: scrapeResult.meta.categories,
          forums: scrapeResult.meta.forums,
          subforums: scrapeResult.meta.subforums,
          total: persistenceSummary.total,
          inserted: persistenceSummary.inserted,
          updated: persistenceSummary.updated,
          unchanged: persistenceSummary.unchanged
        },
        lastError: null,
        message: `Scrape completed. Saved ${persistenceSummary.total} nodes.`
      };

      this.broadcastStatus();
      await this.broadcastTreeSnapshot();
      this.emit("completed", this.getStatus());
    } catch (error) {
      const finishedAt = new Date().toISOString();

      this.state = {
        ...this.state,
        state: "error",
        finishedAt,
        lastError: {
          message: error.message,
          occurredAt: finishedAt
        },
        message: `Scrape failed: ${error.message}`
      };

      this.broadcastStatus();
      this.emit("failed", this.getStatus());
      throw error;
    }
  }
}

module.exports = {
  ScrapeService
};
