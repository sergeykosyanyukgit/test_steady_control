const mongoose = require("mongoose");

const topicSchema = new mongoose.Schema(
  {
    topicId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true
    },
    subforumExternalId: {
      type: String,
      required: true,
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
      required: true
    },
    releaseDate: {
      type: Date,
      required: true,
      index: true
    },
    authorNickname: {
      type: String,
      required: true,
      trim: true
    },
    thankedUsers: {
      type: [
        {
          _id: false,
          userId: {
            type: String,
            default: null,
            trim: true
          },
          nickname: {
            type: String,
            required: true,
            trim: true
          },
          thankedAt: {
            type: Date,
            required: true
          }
        }
      ],
      default: []
    },
    magnetLinks: {
      type: [String],
      default: []
    },
    torrentLinks: {
      type: [String],
      default: []
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
    bufferCommands: false,
    collection: "topics",
    versionKey: false
  }
);

topicSchema.index({ subforumExternalId: 1, releaseDate: -1 });

module.exports = mongoose.model("Topic", topicSchema);
