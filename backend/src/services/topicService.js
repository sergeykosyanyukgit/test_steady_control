const Topic = require("../models/Topic");

class TopicService {
  normalizeThankedUsers(thankedUsers) {
    return (thankedUsers || []).map((item) => ({
      userId: item.userId || null,
      nickname: item.nickname,
      thankedAt:
        item.thankedAt instanceof Date ? item.thankedAt.toISOString() : new Date(item.thankedAt).toISOString()
    }));
  }

  async hasAnyTopics() {
    const total = await Topic.countDocuments();

    return total > 0;
  }

  async upsertTopics(topics) {
    if (topics.length === 0) {
      return {
        total: 0,
        inserted: 0,
        updated: 0,
        unchanged: 0
      };
    }

    const now = new Date();
    const topicIds = topics.map((topic) => topic.topicId);
    const existingTopics = await Topic.find({
      topicId: { $in: topicIds }
    }).lean();
    const existingMap = new Map(existingTopics.map((topic) => [topic.topicId, topic]));

    let inserted = 0;
    let updated = 0;
    let unchanged = 0;

    const operations = topics.map((topic) => {
      const current = existingMap.get(topic.topicId);
      const payload = {
        topicId: topic.topicId,
        subforumExternalId: topic.subforumExternalId,
        title: topic.title,
        url: topic.url,
        description: topic.description,
        releaseDate: topic.releaseDate,
        authorNickname: topic.authorNickname,
        thankedUsers: topic.thankedUsers,
        magnetLinks: topic.magnetLinks,
        torrentLinks: topic.torrentLinks,
        source: topic.source,
        lastSeenAt: topic.lastSeenAt,
        updatedAt: now
      };

      if (!current) {
        inserted += 1;
      } else {
        const hasChanges =
          current.subforumExternalId !== payload.subforumExternalId ||
          current.title !== payload.title ||
          current.url !== payload.url ||
          current.description !== payload.description ||
          new Date(current.releaseDate).getTime() !== payload.releaseDate.getTime() ||
          current.authorNickname !== payload.authorNickname ||
          JSON.stringify(this.normalizeThankedUsers(current.thankedUsers)) !==
            JSON.stringify(this.normalizeThankedUsers(payload.thankedUsers)) ||
          JSON.stringify(current.magnetLinks || []) !== JSON.stringify(payload.magnetLinks) ||
          JSON.stringify(current.torrentLinks || []) !== JSON.stringify(payload.torrentLinks) ||
          current.source !== payload.source;

        if (hasChanges) {
          updated += 1;
        } else {
          unchanged += 1;
        }
      }

      return {
        updateOne: {
          filter: { topicId: topic.topicId },
          update: {
            $set: payload,
            $setOnInsert: {
              createdAt: now
            }
          },
          upsert: true
        }
      };
    });

    await Topic.bulkWrite(operations, { ordered: false });

    return {
      total: topics.length,
      inserted,
      updated,
      unchanged
    };
  }

  async getLoadedSubforumsSummary() {
    const subforums = await Topic.aggregate([
      {
        $group: {
          _id: "$subforumExternalId",
          topicsCount: { $sum: 1 },
          lastSeenAt: { $max: "$lastSeenAt" },
          lastReleaseDate: { $max: "$releaseDate" }
        }
      },
      {
        $sort: {
          topicsCount: -1,
          _id: 1
        }
      }
    ]);
    const totalTopics = subforums.reduce((sum, item) => sum + item.topicsCount, 0);

    return {
      generatedAt: new Date().toISOString(),
      totalTopics,
      totalSubforums: subforums.length,
      subforums: subforums.map((item) => ({
        subforumExternalId: item._id,
        topicsCount: item.topicsCount,
        lastSeenAt: item.lastSeenAt,
        lastReleaseDate: item.lastReleaseDate
      }))
    };
  }

  async getTopicsPage({ subforumExternalId, page = 1, pageSize = 10 }) {
    const safePage = Math.max(Number(page) || 1, 1);
    const safePageSize = Math.max(Number(pageSize) || 10, 1);
    const filter = { subforumExternalId };
    const total = await Topic.countDocuments(filter);
    const items = await Topic.find(filter)
      .sort({ releaseDate: -1, topicId: -1 })
      .skip((safePage - 1) * safePageSize)
      .limit(safePageSize)
      .lean();

    return {
      page: safePage,
      pageSize: safePageSize,
      total,
      totalPages: total > 0 ? Math.ceil(total / safePageSize) : 0,
      items
    };
  }
}

module.exports = {
  TopicService
};
