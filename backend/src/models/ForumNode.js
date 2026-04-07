const mongoose = require("mongoose");

const forumNodeSchema = new mongoose.Schema(
  {
    externalId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    url: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: null
    },
    type: {
      type: String,
      required: true,
      enum: ["category", "forum", "subforum"],
      index: true
    },
    parentExternalId: {
      type: String,
      default: null,
      index: true
    },
    sortOrder: {
      type: Number,
      required: true
    },
    source: {
      type: String,
      required: true,
      default: "rutracker",
      trim: true
    },
    lastSeenAt: {
      type: Date,
      required: true,
      index: true
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
    collection: "forum_nodes",
    bufferCommands: false,
    versionKey: false
  }
);

forumNodeSchema.index({ parentExternalId: 1, sortOrder: 1 });

module.exports = mongoose.model("ForumNode", forumNodeSchema);
