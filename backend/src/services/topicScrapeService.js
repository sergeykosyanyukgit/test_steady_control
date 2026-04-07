const TopicScrapeRun = require("../models/TopicScrapeRun");

class TopicScrapeService {
  constructor({
    forumNodeService,
    topicService,
    topicParser,
    rutrackerClient,
    webSocketHub,
    logger,
    topicMaxTopicsPerRun
  }) {
    this.forumNodeService = forumNodeService;
    this.topicService = topicService;
    this.topicParser = topicParser;
    this.rutrackerClient = rutrackerClient;
    this.webSocketHub = webSocketHub;
    this.logger = logger;
    this.topicMaxTopicsPerRun = topicMaxTopicsPerRun;
    this.currentPromise = null;
    this.startupResolved = false;
    this.state = {
      state: "idle",
      trigger: null,
      subforumExternalId: null,
      subforumTitle: null,
      startedAt: null,
      finishedAt: null,
      lastSuccessAt: null,
      lastSummary: null,
      lastError: null,
      message: "Topic scraper has not been started yet."
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
    this.webSocketHub.broadcast("topic_scrape_status", this.getStatus());
  }

  async broadcastLoadedSubforumsSummary() {
    try {
      const summary = await this.topicService.getLoadedSubforumsSummary();

      this.webSocketHub.broadcast("topics_summary", summary);
      return summary;
    } catch (error) {
      this.logger.warn(`Unable to broadcast topics summary: ${error.message}`);
      return null;
    }
  }

  broadcastResult(payload) {
    this.webSocketHub.broadcast("topic_scrape_result", payload);
  }

  async tryStartupScrape() {
    if (this.startupResolved || this.currentPromise) {
      return;
    }

    const hasTopics = await this.topicService.hasAnyTopics();

    if (hasTopics) {
      this.startupResolved = true;
      return;
    }

    const firstSubforum = await this.forumNodeService.getFirstTopicSourceNode();

    if (!firstSubforum) {
      return;
    }

    this.startupResolved = true;
    await this.start({
      subforumExternalId: firstSubforum.externalId,
      trigger: "startup-first-topic-source"
    });
  }

  async start({ subforumExternalId, trigger = "manual" }) {
    if (this.currentPromise) {
      return {
        started: false,
        status: this.getStatus()
      };
    }

    const subforum = await this.forumNodeService.getNodeByExternalId(subforumExternalId);
    const isTopicSourceNode = await this.forumNodeService.isTopicSourceNode(subforum);

    if (!isTopicSourceNode) {
      throw new Error(
        "A valid subforum or leaf forum must be selected for topic scraping."
      );
    }

    this.currentPromise = this.run({ subforum, trigger })
      .catch((error) => {
        this.logger.error(`Topic scrape failed: ${error.message}`);
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

  async collectTopicStubs(subforum) {
    const collected = [];
    const seenIds = new Set();
    const visitedStarts = new Set();
    let currentStart = 0;

    while (collected.length < this.topicMaxTopicsPerRun && !visitedStarts.has(currentStart)) {
      visitedStarts.add(currentStart);

      const pageUrl = currentStart > 0 ? `${subforum.url}&start=${currentStart}` : subforum.url;
      const html = await this.rutrackerClient.fetchHtmlByUrl(pageUrl);
      const pageResult = this.topicParser.parseTopicListPage(html, currentStart);

      if (pageResult.items.length === 0) {
        break;
      }

      pageResult.items.forEach((item) => {
        if (seenIds.has(item.topicId) || collected.length >= this.topicMaxTopicsPerRun) {
          return;
        }

        seenIds.add(item.topicId);
        collected.push(item);
      });

      if (pageResult.nextStart === null) {
        break;
      }

      currentStart = pageResult.nextStart;
    }

    return collected.slice(0, this.topicMaxTopicsPerRun);
  }

  async mapWithConcurrency(items, concurrency, worker) {
    const results = [];
    let cursor = 0;

    const runners = new Array(Math.min(concurrency, items.length)).fill(null).map(async () => {
      while (cursor < items.length) {
        const currentIndex = cursor;
        cursor += 1;
        results[currentIndex] = await worker(items[currentIndex], currentIndex);
      }
    });

    await Promise.all(runners);

    return results;
  }

  async run({ subforum, trigger }) {
    const startedAt = new Date();

    this.state = {
      ...this.state,
      state: "running",
      trigger,
      subforumExternalId: subforum.externalId,
      subforumTitle: subforum.title,
      startedAt: startedAt.toISOString(),
      finishedAt: null,
      lastError: null,
      message: `Scraping topics for "${subforum.title}".`
    };

    this.broadcastStatus();

    const runDocument = await TopicScrapeRun.create({
      subforumExternalId: subforum.externalId,
      subforumTitle: subforum.title,
      trigger,
      status: "running",
      maxTopics: this.topicMaxTopicsPerRun,
      startedAt,
      updatedAt: startedAt
    });

    try {
      const topicStubs = await this.collectTopicStubs(subforum);
      const results = await this.mapWithConcurrency(topicStubs, 5, async (topicStub) => {
        try {
          const html = await this.rutrackerClient.fetchHtmlByUrl(topicStub.url);
          const topic = this.topicParser.parseTopicPage(html, topicStub, subforum.externalId);
          let thankedUsers = [];

          if (topic.thanksRequest) {
            const thanksResponse = await this.rutrackerClient.fetchTopicThanks({
              topicId: topic.topicId,
              tHash: topic.thanksRequest.tHash,
              formToken: topic.thanksRequest.formToken,
              refererUrl: topic.url
            });

            thankedUsers = this.topicParser.parseTopicThanksHtml(
              thanksResponse && thanksResponse.html ? thanksResponse.html : "",
              topic.topicId
            );
          }

          return {
            ok: true,
            topic: {
              ...topic,
              thankedUsers
            }
          };
        } catch (error) {
          return {
            ok: false,
            topicId: topicStub.topicId,
            error: error.message
          };
        }
      });
      const successfulTopics = results.filter((item) => item.ok).map((item) => item.topic);
      const failedTopics = results.filter((item) => !item.ok);
      const persistenceSummary = await this.topicService.upsertTopics(successfulTopics);
      const finishedAt = new Date();
      const summary = {
        subforumExternalId: subforum.externalId,
        subforumTitle: subforum.title,
        maxTopics: this.topicMaxTopicsPerRun,
        discoveredTopics: topicStubs.length,
        processedTopics: successfulTopics.length,
        inserted: persistenceSummary.inserted,
        updated: persistenceSummary.updated,
        unchanged: persistenceSummary.unchanged,
        failedTopics: failedTopics.length
      };

      await TopicScrapeRun.updateOne(
        { _id: runDocument._id },
        {
          $set: {
            status: "completed",
            discoveredTopics: summary.discoveredTopics,
            processedTopics: summary.processedTopics,
            inserted: summary.inserted,
            updated: summary.updated,
            unchanged: summary.unchanged,
            failedTopics: summary.failedTopics,
            finishedAt,
            errorMessage: null,
            updatedAt: finishedAt
          }
        }
      );

      this.state = {
        ...this.state,
        state: "completed",
        finishedAt: finishedAt.toISOString(),
        lastSuccessAt: finishedAt.toISOString(),
        lastSummary: summary,
        lastError: null,
        message: `Topic scrape completed for "${subforum.title}". Saved ${summary.processedTopics} topics.`
      };

      this.broadcastStatus();
      await this.broadcastLoadedSubforumsSummary();
      this.broadcastResult(summary);
    } catch (error) {
      const finishedAt = new Date();

      await TopicScrapeRun.updateOne(
        { _id: runDocument._id },
        {
          $set: {
            status: "error",
            finishedAt,
            errorMessage: error.message,
            updatedAt: finishedAt
          }
        }
      );

      this.state = {
        ...this.state,
        state: "error",
        finishedAt: finishedAt.toISOString(),
        lastError: {
          message: error.message,
          occurredAt: finishedAt.toISOString()
        },
        message: `Topic scrape failed: ${error.message}`
      };

      this.broadcastStatus();
      throw error;
    }
  }
}

module.exports = {
  TopicScrapeService
};
