const swaggerJSDoc = require("swagger-jsdoc");

const createSwaggerSpec = () =>
  swaggerJSDoc({
    definition: {
      openapi: "3.0.3",
      info: {
        title: "RuTracker Parser API",
        version: "1.0.0",
        description:
          "API for scraping RuTracker forum categories, forums and subforums, persisting them in MongoDB and streaming updates over WebSocket."
      },
      servers: [
        {
          url: "/",
          description: "Current origin"
        }
      ],
      components: {
        schemas: {
          ErrorResponse: {
            type: "object",
            properties: {
              message: {
                type: "string"
              }
            }
          },
          ScrapeError: {
            type: "object",
            nullable: true,
            properties: {
              message: {
                type: "string"
              },
              occurredAt: {
                type: "string",
                format: "date-time"
              }
            }
          },
          ScrapeSummary: {
            type: "object",
            nullable: true,
            properties: {
              scrapedAt: {
                type: "string",
                format: "date-time"
              },
              categories: {
                type: "integer"
              },
              forums: {
                type: "integer"
              },
              subforums: {
                type: "integer"
              },
              total: {
                type: "integer"
              },
              inserted: {
                type: "integer"
              },
              updated: {
                type: "integer"
              },
              unchanged: {
                type: "integer"
              }
            }
          },
          ScrapeStatus: {
            type: "object",
            properties: {
              state: {
                type: "string",
                enum: ["idle", "running", "completed", "error"]
              },
              trigger: {
                type: "string",
                nullable: true
              },
              startedAt: {
                type: "string",
                format: "date-time",
                nullable: true
              },
              finishedAt: {
                type: "string",
                format: "date-time",
                nullable: true
              },
              lastSuccessAt: {
                type: "string",
                format: "date-time",
                nullable: true
              },
              lastSummary: {
                $ref: "#/components/schemas/ScrapeSummary"
              },
              lastError: {
                $ref: "#/components/schemas/ScrapeError"
              },
              message: {
                type: "string"
              },
              isRunning: {
                type: "boolean"
              }
            }
          },
          Topic: {
            type: "object",
            properties: {
              topicId: {
                type: "string"
              },
              subforumExternalId: {
                type: "string"
              },
              title: {
                type: "string"
              },
              url: {
                type: "string"
              },
              description: {
                type: "string"
              },
              releaseDate: {
                type: "string",
                format: "date-time"
              },
              authorNickname: {
                type: "string"
              },
              thankedUsers: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    userId: {
                      type: "string",
                      nullable: true
                    },
                    nickname: {
                      type: "string"
                    },
                    thankedAt: {
                      type: "string",
                      format: "date-time"
                    }
                  }
                }
              },
              magnetLinks: {
                type: "array",
                items: {
                  type: "string"
                }
              },
              torrentLinks: {
                type: "array",
                items: {
                  type: "string"
                }
              },
              source: {
                type: "string"
              },
              lastSeenAt: {
                type: "string",
                format: "date-time"
              }
            }
          },
          TopicsPage: {
            type: "object",
            properties: {
              page: {
                type: "integer"
              },
              pageSize: {
                type: "integer"
              },
              total: {
                type: "integer"
              },
              totalPages: {
                type: "integer"
              },
              items: {
                type: "array",
                items: {
                  $ref: "#/components/schemas/Topic"
                }
              }
            }
          },
          TopicsSummaryItem: {
            type: "object",
            properties: {
              subforumExternalId: {
                type: "string"
              },
              topicsCount: {
                type: "integer"
              },
              lastSeenAt: {
                type: "string",
                format: "date-time"
              },
              lastReleaseDate: {
                type: "string",
                format: "date-time"
              }
            }
          },
          TopicsSummary: {
            type: "object",
            properties: {
              generatedAt: {
                type: "string",
                format: "date-time"
              },
              totalTopics: {
                type: "integer"
              },
              totalSubforums: {
                type: "integer"
              },
              subforums: {
                type: "array",
                items: {
                  $ref: "#/components/schemas/TopicsSummaryItem"
                }
              }
            }
          },
          TopicScrapeSummary: {
            type: "object",
            nullable: true,
            properties: {
              subforumExternalId: {
                type: "string"
              },
              subforumTitle: {
                type: "string"
              },
              maxTopics: {
                type: "integer"
              },
              discoveredTopics: {
                type: "integer"
              },
              processedTopics: {
                type: "integer"
              },
              inserted: {
                type: "integer"
              },
              updated: {
                type: "integer"
              },
              unchanged: {
                type: "integer"
              },
              failedTopics: {
                type: "integer"
              }
            }
          },
          TopicScrapeStatus: {
            type: "object",
            properties: {
              state: {
                type: "string",
                enum: ["idle", "running", "completed", "error"]
              },
              trigger: {
                type: "string",
                nullable: true
              },
              subforumExternalId: {
                type: "string",
                nullable: true
              },
              subforumTitle: {
                type: "string",
                nullable: true
              },
              startedAt: {
                type: "string",
                format: "date-time",
                nullable: true
              },
              finishedAt: {
                type: "string",
                format: "date-time",
                nullable: true
              },
              lastSuccessAt: {
                type: "string",
                format: "date-time",
                nullable: true
              },
              lastSummary: {
                $ref: "#/components/schemas/TopicScrapeSummary"
              },
              lastError: {
                $ref: "#/components/schemas/ScrapeError"
              },
              message: {
                type: "string"
              },
              isRunning: {
                type: "boolean"
              }
            }
          },
          TreeNode: {
            type: "object",
            properties: {
              externalId: {
                type: "string"
              },
              title: {
                type: "string"
              },
              url: {
                type: "string"
              },
              description: {
                type: "string",
                nullable: true
              },
              type: {
                type: "string",
                enum: ["category", "forum", "subforum"]
              },
              parentExternalId: {
                type: "string",
                nullable: true
              },
              sortOrder: {
                type: "integer"
              },
              source: {
                type: "string"
              },
              lastSeenAt: {
                type: "string",
                format: "date-time"
              },
              children: {
                type: "array",
                items: {
                  $ref: "#/components/schemas/TreeNode"
                }
              }
            }
          },
          TreeSnapshot: {
            type: "object",
            properties: {
              generatedAt: {
                type: "string",
                format: "date-time"
              },
              totalNodes: {
                type: "integer"
              },
              categories: {
                type: "integer"
              },
              forums: {
                type: "integer"
              },
              subforums: {
                type: "integer"
              },
              tree: {
                type: "array",
                items: {
                  $ref: "#/components/schemas/TreeNode"
                }
              }
            }
          },
          HealthResponse: {
            type: "object",
            properties: {
              name: {
                type: "string"
              },
              uptimeSeconds: {
                type: "integer"
              },
              database: {
                type: "object"
              },
              scraper: {
                $ref: "#/components/schemas/ScrapeStatus"
              },
              topicScraper: {
                $ref: "#/components/schemas/TopicScrapeStatus"
              },
              now: {
                type: "string",
                format: "date-time"
              }
            }
          }
        }
      },
      paths: {
        "/api/health": {
          get: {
            summary: "Get API and infrastructure health",
            responses: {
              200: {
                description: "Health information",
                content: {
                  "application/json": {
                    schema: {
                      $ref: "#/components/schemas/HealthResponse"
                    }
                  }
                }
              }
            }
          }
        },
        "/api/forum-nodes/tree": {
          get: {
            summary: "Get the current forum tree snapshot",
            responses: {
              200: {
                description: "Tree snapshot",
                content: {
                  "application/json": {
                    schema: {
                      $ref: "#/components/schemas/TreeSnapshot"
                    }
                  }
                }
              },
              503: {
                description: "MongoDB is not connected",
                content: {
                  "application/json": {
                    schema: {
                      $ref: "#/components/schemas/ErrorResponse"
                    }
                  }
                }
              }
            }
          }
        },
        "/api/scrape/status": {
          get: {
            summary: "Get current scrape status",
            responses: {
              200: {
                description: "Scrape status",
                content: {
                  "application/json": {
                    schema: {
                      $ref: "#/components/schemas/ScrapeStatus"
                    }
                  }
                }
              }
            }
          }
        },
        "/api/scrape/run": {
          post: {
            summary: "Start a manual scrape in the background",
            responses: {
              202: {
                description: "Scrape started"
              },
              409: {
                description: "Scrape is already running"
              }
            }
          }
        },
        "/api/topics/subforums/summary": {
          get: {
            summary: "Get the list of subforums or leaf forums that already have saved topics",
            responses: {
              200: {
                description: "Saved topics grouped by forum node",
                content: {
                  "application/json": {
                    schema: {
                      $ref: "#/components/schemas/TopicsSummary"
                    }
                  }
                }
              }
            }
          }
        },
        "/api/topics": {
          get: {
            summary: "Get paginated topics for a selected subforum or leaf forum",
            parameters: [
              {
                in: "query",
                name: "subforumExternalId",
                required: true,
                schema: {
                  type: "string"
                }
              },
              {
                in: "query",
                name: "page",
                required: false,
                schema: {
                  type: "integer",
                  default: 1
                }
              },
              {
                in: "query",
                name: "pageSize",
                required: false,
                schema: {
                  type: "integer",
                  default: 10
                }
              }
            ],
            responses: {
              200: {
                description: "Paginated topics for the selected forum node",
                content: {
                  "application/json": {
                    schema: {
                      $ref: "#/components/schemas/TopicsPage"
                    }
                  }
                }
              },
              400: {
                description: "Missing subforumExternalId",
                content: {
                  "application/json": {
                    schema: {
                      $ref: "#/components/schemas/ErrorResponse"
                    }
                  }
                }
              }
            }
          }
        },
        "/api/topics/scrape/status": {
          get: {
            summary: "Get current topic scrape status",
            responses: {
              200: {
                description: "Topic scrape status",
                content: {
                  "application/json": {
                    schema: {
                      $ref: "#/components/schemas/TopicScrapeStatus"
                    }
                  }
                }
              }
            }
          }
        },
        "/api/topics/scrape": {
          post: {
            summary: "Start scraping topics for a selected subforum or leaf forum",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["subforumExternalId"],
                    properties: {
                      subforumExternalId: {
                        type: "string"
                      }
                    }
                  }
                }
              }
            },
            responses: {
              202: {
                description: "Topic scrape started"
              },
              400: {
                description: "Invalid request"
              },
              409: {
                description: "Topic scrape is already running"
              }
            }
          }
        }
      }
    },
    apis: []
  });

module.exports = {
  createSwaggerSpec
};
