const cheerio = require("cheerio");

const normalizeWhitespace = (value) => {
  if (!value) {
    return "";
  }

  return value.replace(/\s+/g, " ").trim();
};

const asNullableText = (value) => {
  const normalized = normalizeWhitespace(value);

  return normalized.length > 0 ? normalized : null;
};

class ForumScraper {
  constructor({ baseUrl }) {
    this.baseUrl = baseUrl;
  }

  toAbsoluteUrl(relativeOrAbsoluteUrl) {
    return new URL(relativeOrAbsoluteUrl, this.baseUrl).toString();
  }

  parseForumId(url) {
    const parsedUrl = new URL(url, this.baseUrl);

    return parsedUrl.searchParams.get("f");
  }

  parseCategoryId(elementId, fallbackUrl) {
    if (elementId && elementId.startsWith("c-")) {
      return elementId.slice(2);
    }

    const parsedUrl = new URL(fallbackUrl, this.baseUrl);

    return parsedUrl.searchParams.get("c");
  }

  parseIndexPage(html) {
    const $ = cheerio.load(html, { decodeEntities: false });
    const scrapedAt = new Date();
    const nodes = [];
    const knownIds = new Set();
    const categoryElements = $("#categories-wrap > .category");

    if (categoryElements.length === 0) {
      throw new Error("Unable to find forum categories in the fetched HTML.");
    }

    categoryElements.each((categoryIndex, categoryElement) => {
      const categoryRoot = $(categoryElement);
      const categoryLink = categoryRoot.find("> .cat_title a").first();
      const categoryUrl = this.toAbsoluteUrl(categoryLink.attr("href"));
      const categoryId = this.parseCategoryId(categoryRoot.attr("id"), categoryUrl);
      const categoryExternalId = `category:${categoryId || categoryIndex + 1}`;

      nodes.push({
        externalId: categoryExternalId,
        title: normalizeWhitespace(categoryLink.text()),
        url: categoryUrl,
        description: null,
        type: "category",
        parentExternalId: null,
        sortOrder: categoryIndex,
        source: "rutracker",
        lastSeenAt: scrapedAt
      });

      knownIds.add(categoryExternalId);

      categoryRoot.find("table.forums tr[id^='f-']").each((forumIndex, forumElement) => {
        const forumRoot = $(forumElement);
        const forumLink = forumRoot.find("h4.forumlink a").first();

        if (forumLink.length === 0) {
          return;
        }

        const forumUrl = this.toAbsoluteUrl(forumLink.attr("href"));
        const forumId = this.parseForumId(forumUrl) || forumRoot.attr("id").replace(/^f-/, "");
        const forumExternalId = `forum:${forumId}`;

        if (knownIds.has(forumExternalId)) {
          return;
        }

        nodes.push({
          externalId: forumExternalId,
          title: normalizeWhitespace(forumLink.text()),
          url: forumUrl,
          description: asNullableText(
            forumRoot
              .find("p.subforums a[href*='viewforum.php?f=']")
              .map((_, anchor) => $(anchor).text())
              .get()
              .join(" | ")
          ),
          type: "forum",
          parentExternalId: categoryExternalId,
          sortOrder: forumIndex,
          source: "rutracker",
          lastSeenAt: scrapedAt
        });

        knownIds.add(forumExternalId);

        forumRoot.find("p.subforums a[href*='viewforum.php?f=']").each((subforumIndex, subforumElement) => {
          const subforumLink = $(subforumElement);
          const subforumUrl = this.toAbsoluteUrl(subforumLink.attr("href"));
          const subforumId = this.parseForumId(subforumUrl);

          if (!subforumId) {
            return;
          }

          const subforumExternalId = `forum:${subforumId}`;

          if (knownIds.has(subforumExternalId)) {
            return;
          }

          nodes.push({
            externalId: subforumExternalId,
            title: normalizeWhitespace(subforumLink.text()),
            url: subforumUrl,
            description: null,
            type: "subforum",
            parentExternalId: forumExternalId,
            sortOrder: subforumIndex,
            source: "rutracker",
            lastSeenAt: scrapedAt
          });

          knownIds.add(subforumExternalId);
        });
      });
    });

    return {
      scrapedAt,
      nodes,
      meta: {
        categories: nodes.filter((node) => node.type === "category").length,
        forums: nodes.filter((node) => node.type === "forum").length,
        subforums: nodes.filter((node) => node.type === "subforum").length
      }
    };
  }
}

module.exports = {
  ForumScraper
};
