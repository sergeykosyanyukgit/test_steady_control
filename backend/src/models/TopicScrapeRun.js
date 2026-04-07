const mongoose = require("mongoose");

const topicScrapeRunSchema = new mongoose.Schema(
  {
    subforumExternalId: {
      type: String,
      required: true,
      index: true,
      trim: true
    },
    subforumTitle: {
      type: String,
      required: true,
      trim: true
    },
    trigger: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      required: true,
      enum: ["running", "completed", "error"],
      index: true
    },
    maxTopics: {
      type: Number,
      required: true
    },
    discoveredTopics: {
      type: Number,
      default: 0
    },
    processedTopics: {
      type: Number,
      default: 0
    },
    inserted: {
      type: Number,
      default: 0
    },
    updated: {
      type: Number,
      default: 0
    },
    unchanged: {
      type: Number,
      default: 0
    },
    failedTopics: {
      type: Number,
      default: 0
    },
    startedAt: {
      type: Date,
      required: true,
      index: true
    },
    finishedAt: {
      type: Date,
      default: null
    },
    errorMessage: {
      type: String,
      default: null
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    bufferCommands: false,
    collection: "topic_scrape_runs",
    versionKey: false
  }
);

topicScrapeRunSchema.index({ subforumExternalId: 1, startedAt: -1 });

module.exports = mongoose.model("TopicScrapeRun", topicScrapeRunSchema);
