const ForumNode = require("../models/ForumNode");

class ForumNodeService {
  async upsertNodes(nodes) {
    if (nodes.length === 0) {
      return {
        total: 0,
        inserted: 0,
        updated: 0,
        unchanged: 0
      };
    }

    const now = new Date();
    const externalIds = nodes.map((node) => node.externalId);
    const existingNodes = await ForumNode.find({
      externalId: { $in: externalIds }
    }).lean();
    const existingMap = new Map(existingNodes.map((node) => [node.externalId, node]));

    let inserted = 0;
    let updated = 0;
    let unchanged = 0;

    const operations = nodes.map((node) => {
      const current = existingMap.get(node.externalId);
      const payload = {
        externalId: node.externalId,
        title: node.title,
        url: node.url,
        description: node.description,
        type: node.type,
        parentExternalId: node.parentExternalId,
        sortOrder: node.sortOrder,
        source: node.source,
        lastSeenAt: node.lastSeenAt,
        updatedAt: now
      };

      if (!current) {
        inserted += 1;
      } else {
        const hasChanges =
          current.title !== payload.title ||
          current.url !== payload.url ||
          current.description !== payload.description ||
          current.type !== payload.type ||
          current.parentExternalId !== payload.parentExternalId ||
          current.sortOrder !== payload.sortOrder ||
          current.source !== payload.source;

        if (hasChanges) {
          updated += 1;
        } else {
          unchanged += 1;
        }
      }

      return {
        updateOne: {
          filter: { externalId: node.externalId },
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

    await ForumNode.bulkWrite(operations, { ordered: false });

    return {
      total: nodes.length,
      inserted,
      updated,
      unchanged
    };
  }

  async getFlatNodes() {
    return ForumNode.find().sort({ sortOrder: 1, title: 1 }).lean();
  }

  async getNodeByExternalId(externalId) {
    return ForumNode.findOne({ externalId }).lean();
  }

  isTopicSourceTreeNode(node) {
    if (!node) {
      return false;
    }

    if (node.type === "subforum") {
      return true;
    }

    return node.type === "forum" && (!node.children || node.children.length === 0);
  }

  async isTopicSourceNode(node) {
    if (!node) {
      return false;
    }

    if (node.type === "subforum") {
      return true;
    }

    if (node.type !== "forum") {
      return false;
    }

    const childrenCount = await ForumNode.countDocuments({
      parentExternalId: node.externalId
    });

    return childrenCount === 0;
  }

  buildTree(nodes) {
    const roots = [];
    const map = new Map();

    nodes.forEach((node) => {
      map.set(node.externalId, {
        externalId: node.externalId,
        title: node.title,
        url: node.url,
        description: node.description,
        type: node.type,
        parentExternalId: node.parentExternalId,
        sortOrder: node.sortOrder,
        source: node.source,
        lastSeenAt: node.lastSeenAt,
        children: []
      });
    });

    map.forEach((node) => {
      if (node.parentExternalId && map.has(node.parentExternalId)) {
        map.get(node.parentExternalId).children.push(node);
        return;
      }

      roots.push(node);
    });

    const sortNodes = (items) => {
      items.sort((left, right) => {
        if (left.sortOrder !== right.sortOrder) {
          return left.sortOrder - right.sortOrder;
        }

        return left.title.localeCompare(right.title, "ru");
      });

      items.forEach((item) => {
        if (item.children.length > 0) {
          sortNodes(item.children);
        }
      });
    };

    sortNodes(roots);

    return roots;
  }

  async getTreeSnapshot() {
    const nodes = await this.getFlatNodes();

    return {
      generatedAt: new Date().toISOString(),
      totalNodes: nodes.length,
      categories: nodes.filter((node) => node.type === "category").length,
      forums: nodes.filter((node) => node.type === "forum").length,
      subforums: nodes.filter((node) => node.type === "subforum").length,
      tree: this.buildTree(nodes)
    };
  }

  async getFirstTopicSourceNode() {
    const snapshot = await this.getTreeSnapshot();
    const stack = [...snapshot.tree];

    while (stack.length > 0) {
      const node = stack.shift();

      if (this.isTopicSourceTreeNode(node)) {
        return node;
      }

      if (node.children && node.children.length > 0) {
        stack.unshift(...node.children);
      }
    }

    return null;
  }
}

module.exports = {
  ForumNodeService
};
