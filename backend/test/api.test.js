const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { createApp, INVALID_TOPIC_SOURCE_MESSAGE } = require("../src/app");
const { createSwaggerSpec } = require("../src/swagger");

const createTestContext = (overrides = {}) => {
  const calls = {
    scrapeStart: [],
    getTopicsPage: [],
    topicScrapeStart: []
  };

  const scrapeStatus = {
    state: "idle",
    isRunning: false,
    message: "Scrape idle."
  };
  const topicScrapeStatus = {
    state: "idle",
    isRunning: false,
    message: "Topic scrape idle."
  };
  const treeSnapshot = {
    generatedAt: "2026-04-07T10:00:00.000Z",
    totalNodes: 1,
    categories: 1,
    forums: 0,
    subforums: 0,
    tree: [
      {
        externalId: "category:1",
        title: "Category",
        url: "https://rutracker.org/forum/index.php?c=1",
        description: null,
        type: "category",
        parentExternalId: null,
        sortOrder: 0,
        source: "rutracker",
        lastSeenAt: "2026-04-07T10:00:00.000Z",
        children: []
      }
    ]
  };
  const topicsSummary = {
    generatedAt: "2026-04-07T10:05:00.000Z",
    totalTopics: 1,
    totalSubforums: 1,
    subforums: [
      {
        subforumExternalId: "forum:635",
        topicsCount: 1,
        lastSeenAt: "2026-04-07T10:05:00.000Z",
        lastReleaseDate: "2026-04-06T20:00:00.000Z"
      }
    ]
  };
  const topicsPage = {
    page: 2,
    pageSize: 5,
    total: 7,
    totalPages: 2,
    items: [
      {
        topicId: "6529617",
        subforumExternalId: "forum:635",
        title: "Как пополнить баланс Steam в России?",
        url: "https://rutracker.org/forum/viewtopic.php?t=6529617",
        description: "description",
        releaseDate: "2026-04-06T20:00:00.000Z",
        authorNickname: "Rutracker",
        thankedUsers: [
          {
            userId: "36223309",
            nickname: "processorx4x64",
            thankedAt: "2026-04-06T21:00:00.000Z"
          }
        ],
        magnetLinks: [],
        torrentLinks: [],
        source: "rutracker",
        lastSeenAt: "2026-04-07T10:05:00.000Z"
      }
    ]
  };

  const context = {
    databaseService: {
      isConnected: () => true,
      getStatus: () => ({
        state: "connected",
        lastConnectedAt: "2026-04-07T10:00:00.000Z",
        lastError: null
      })
    },
    forumNodeService: {
      getTreeSnapshot: async () => treeSnapshot
    },
    topicService: {
      getLoadedSubforumsSummary: async () => topicsSummary,
      getTopicsPage: async (params) => {
        calls.getTopicsPage.push(params);
        return topicsPage;
      }
    },
    scrapeService: {
      getStatus: () => scrapeStatus,
      start: (trigger) => {
        calls.scrapeStart.push(trigger);
        return {
          started: true,
          status: {
            ...scrapeStatus,
            state: "running",
            isRunning: true,
            message: "Scrape running."
          }
        };
      }
    },
    topicScrapeService: {
      getStatus: () => topicScrapeStatus,
      start: async (payload) => {
        calls.topicScrapeStart.push(payload);
        return {
          started: true,
          status: {
            ...topicScrapeStatus,
            state: "running",
            isRunning: true,
            subforumExternalId: payload.subforumExternalId,
            message: "Topic scrape running."
          }
        };
      }
    },
    swaggerSpec: createSwaggerSpec({ port: 3000 })
  };

  Object.assign(context, overrides);

  const app = createApp({
    databaseService: context.databaseService,
    forumNodeService: context.forumNodeService,
    topicService: context.topicService,
    scrapeService: context.scrapeService,
    topicScrapeService: context.topicScrapeService,
    swaggerSpec: context.swaggerSpec
  });

  return {
    app,
    calls,
    fixtures: {
      scrapeStatus,
      topicScrapeStatus,
      treeSnapshot,
      topicsSummary,
      topicsPage
    }
  };
};

test("GET /docs/openapi.json returns generated spec", async () => {
  const { app } = createTestContext();
  const response = await request(app).get("/docs/openapi.json");

  assert.equal(response.status, 200);
  assert.equal(response.body.openapi, "3.0.3");
  assert.equal(response.body.info.title, "RuTracker Parser API");
});

test("GET /api/health returns aggregated runtime status", async () => {
  const { app } = createTestContext();
  const response = await request(app).get("/api/health");

  assert.equal(response.status, 200);
  assert.equal(response.body.name, "rutracker-parser-api");
  assert.equal(response.body.database.state, "connected");
  assert.equal(response.body.scraper.state, "idle");
  assert.equal(response.body.topicScraper.state, "idle");
  assert.ok(response.body.now);
});

test("GET /api/forum-nodes/tree returns 503 when database is disconnected", async () => {
  const { app } = createTestContext({
    databaseService: {
      isConnected: () => false,
      getStatus: () => ({
        state: "disconnected",
        lastConnectedAt: null,
        lastError: null
      })
    }
  });
  const response = await request(app).get("/api/forum-nodes/tree");

  assert.equal(response.status, 503);
  assert.deepEqual(response.body, {
    message: "MongoDB is not connected yet."
  });
});

test("GET /api/forum-nodes/tree returns current snapshot when database is connected", async () => {
  const { app, fixtures } = createTestContext();
  const response = await request(app).get("/api/forum-nodes/tree");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, fixtures.treeSnapshot);
});

test("POST /api/scrape/run starts scraping in manual mode", async () => {
  const { app, calls } = createTestContext();
  const response = await request(app).post("/api/scrape/run");

  assert.equal(response.status, 202);
  assert.equal(response.body.message, "Scrape has been started.");
  assert.deepEqual(calls.scrapeStart, ["manual"]);
});

test("POST /api/scrape/run returns 409 when scrape is already running", async () => {
  const busyStatus = {
    state: "running",
    isRunning: true,
    message: "Scrape already running."
  };
  const { app } = createTestContext({
    scrapeService: {
      getStatus: () => busyStatus,
      start: () => ({
        started: false,
        status: busyStatus
      })
    }
  });
  const response = await request(app).post("/api/scrape/run");

  assert.equal(response.status, 409);
  assert.equal(response.body.message, "Scrape is already running.");
});

test("GET /api/topics/subforums/summary returns saved topics summary", async () => {
  const { app, fixtures } = createTestContext();
  const response = await request(app).get("/api/topics/subforums/summary");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, fixtures.topicsSummary);
});

test("GET /api/topics validates required subforumExternalId query parameter", async () => {
  const { app } = createTestContext();
  const response = await request(app).get("/api/topics");

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, {
    message: "Query parameter subforumExternalId is required."
  });
});

test("GET /api/topics returns paginated topics and forwards query params", async () => {
  const { app, calls, fixtures } = createTestContext();
  const response = await request(app).get(
    "/api/topics?subforumExternalId=forum:635&page=2&pageSize=5"
  );

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, fixtures.topicsPage);
  assert.deepEqual(calls.getTopicsPage, [
    {
      subforumExternalId: "forum:635",
      page: "2",
      pageSize: "5"
    }
  ]);
});

test("GET /api/topics/scrape/status returns current topic-scrape status", async () => {
  const { app } = createTestContext();
  const response = await request(app).get("/api/topics/scrape/status");

  assert.equal(response.status, 200);
  assert.equal(response.body.state, "idle");
  assert.equal(response.body.message, "Topic scrape idle.");
});

test("POST /api/topics/scrape validates required request body field", async () => {
  const { app } = createTestContext();
  const response = await request(app).post("/api/topics/scrape").send({});

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, {
    message: "Field subforumExternalId is required."
  });
});

test("POST /api/topics/scrape returns 400 for an invalid topic source node", async () => {
  const { app } = createTestContext({
    topicScrapeService: {
      getStatus: () => ({
        state: "idle",
        isRunning: false,
        message: "Topic scrape idle."
      }),
      start: async () => {
        throw new Error(INVALID_TOPIC_SOURCE_MESSAGE);
      }
    }
  });
  const response = await request(app)
    .post("/api/topics/scrape")
    .send({ subforumExternalId: "forum:bad" });

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, {
    message: INVALID_TOPIC_SOURCE_MESSAGE
  });
});

test("POST /api/topics/scrape returns 409 when topic scrape is already running", async () => {
  const busyStatus = {
    state: "running",
    isRunning: true,
    message: "Topic scrape already running."
  };
  const { app } = createTestContext({
    topicScrapeService: {
      getStatus: () => busyStatus,
      start: async () => ({
        started: false,
        status: busyStatus
      })
    }
  });
  const response = await request(app)
    .post("/api/topics/scrape")
    .send({ subforumExternalId: "forum:635" });

  assert.equal(response.status, 409);
  assert.equal(response.body.message, "Topic scrape is already running.");
});

test("POST /api/topics/scrape starts topic scrape in manual mode", async () => {
  const { app, calls } = createTestContext();
  const response = await request(app)
    .post("/api/topics/scrape")
    .send({ subforumExternalId: "forum:635" });

  assert.equal(response.status, 202);
  assert.equal(response.body.message, "Topic scrape has been started.");
  assert.deepEqual(calls.topicScrapeStart, [
    {
      subforumExternalId: "forum:635",
      trigger: "manual"
    }
  ]);
});

test("service failures bubble into the shared 500 error handler", async () => {
  const { app } = createTestContext({
    topicService: {
      getLoadedSubforumsSummary: async () => {
        throw new Error("summary exploded");
      },
      getTopicsPage: async () => ({
        page: 1,
        pageSize: 10,
        total: 0,
        totalPages: 0,
        items: []
      })
    }
  });
  const response = await request(app).get("/api/topics/subforums/summary");

  assert.equal(response.status, 500);
  assert.deepEqual(response.body, {
    message: "summary exploded"
  });
});

test("unknown routes return a JSON 404 response", async () => {
  const { app } = createTestContext();
  const response = await request(app).get("/api/does-not-exist");

  assert.equal(response.status, 404);
  assert.deepEqual(response.body, {
    message: "Route not found."
  });
});
