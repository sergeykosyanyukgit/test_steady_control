const swaggerJSDoc = require("swagger-jsdoc");

const createSwaggerSpec = ({ port }) =>
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
          url: `http://localhost:${port}`,
          description: "Local server"
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
        }
      }
    },
    apis: []
  });

module.exports = {
  createSwaggerSpec
};
