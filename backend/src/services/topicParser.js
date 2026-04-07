const cheerio = require("cheerio");

const {
  extractPlainTextFromHtml,
  normalizeWhitespace,
  parseRutrackerDate,
  parseRutrackerShortDate
} = require("../utils/rutracker");

class TopicParser {
  constructor({ baseUrl }) {
    this.baseUrl = baseUrl;
    this.forumBaseUrl = new URL("/forum/", baseUrl).toString();
  }

  toAbsoluteUrl(relativeOrAbsoluteUrl) {
    if (!relativeOrAbsoluteUrl) {
      return "";
    }

    if (/^https?:\/\//i.test(relativeOrAbsoluteUrl)) {
      return relativeOrAbsoluteUrl;
    }

    if (relativeOrAbsoluteUrl.startsWith("/")) {
      return new URL(relativeOrAbsoluteUrl, this.baseUrl).toString();
    }

    return new URL(relativeOrAbsoluteUrl, this.forumBaseUrl).toString();
  }

  parseStartValue(url) {
    const parsedUrl = new URL(url, this.baseUrl);

    return Number(parsedUrl.searchParams.get("start") || "0");
  }

  parseTopicListPage(html, currentStart) {
    const $ = cheerio.load(html, {
      decodeEntities: false
    });
    const items = [];
    const seenIds = new Set();

    $("tr[data-topic_id]").each((index, rowElement) => {
      const row = $(rowElement);
      const topicId = normalizeWhitespace(row.attr("data-topic_id"));
      const titleLink = row.find("a.tt-text, a.torTopic, a.topictitle.tt-text").first();

      if (!topicId || titleLink.length === 0 || seenIds.has(topicId)) {
        return;
      }

      seenIds.add(topicId);

      items.push({
        topicId,
        title: normalizeWhitespace(titleLink.text()),
        url: this.toAbsoluteUrl(titleLink.attr("href"))
      });
    });

    const paginationStarts = $("#pagination a.pg[href*='viewforum.php']")
      .map((index, link) => this.parseStartValue($(link).attr("href")))
      .get()
      .filter((value) => Number.isFinite(value))
      .sort((left, right) => left - right);
    const nextStart = paginationStarts.find((value) => value > currentStart) ?? null;

    return {
      items,
      nextStart
    };
  }

  parseTopicPage(html, topicStub, subforumExternalId) {
    const $ = cheerio.load(html, {
      decodeEntities: false
    });
    const firstPost = $(".post_body").first();

    if (firstPost.length === 0) {
      throw new Error(`Unable to find the first post for topic ${topicStub.topicId}.`);
    }

    const row = firstPost.closest("tr");
    const authorNickname = normalizeWhitespace(row.find(".nick-author").first().text());
    const releaseDateText = normalizeWhitespace(row.find(".post_head .p-link").first().text());
    const releaseDate = parseRutrackerDate(releaseDateText);

    if (!authorNickname) {
      throw new Error(`Unable to find the author nickname for topic ${topicStub.topicId}.`);
    }

    if (!releaseDate) {
      throw new Error(`Unable to parse the release date for topic ${topicStub.topicId}.`);
    }

    const magnetLinks = [
      ...new Set(
        row
          .find("a[href^='magnet:']")
          .map((index, link) => $(link).attr("href"))
          .get()
          .filter(Boolean)
      )
    ];
    const torrentLinks = [
      ...new Set(
        row
          .find("a[href*='dl.php?t='], a[href*='download.php?id=']")
          .map((index, link) => this.toAbsoluteUrl($(link).attr("href")))
          .get()
          .filter(Boolean)
      )
    ];
    const thanksRequest = this.parseThanksRequest(html, topicStub.topicId);

    return {
      topicId: topicStub.topicId,
      subforumExternalId,
      title: topicStub.title,
      url: topicStub.url,
      description: extractPlainTextFromHtml($.html(firstPost)),
      releaseDate,
      authorNickname,
      thankedUsers: [],
      magnetLinks,
      torrentLinks,
      thanksRequest,
      source: "rutracker",
      lastSeenAt: new Date()
    };
  }

  parseThanksRequest(html, topicId) {
    const formTokenMatch = html.match(/form_token:\s*'([^']+)'/i);
    const tHashMatch = html.match(/t_hash:\s*'([^']+)'/i);
    const formToken = normalizeWhitespace(formTokenMatch ? formTokenMatch[1] : "");
    const tHash = normalizeWhitespace(tHashMatch ? tHashMatch[1] : "");

    if (!tHash) {
      return null;
    }

    if (!formToken) {
      throw new Error(`Unable to find form token for topic ${topicId}.`);
    }

    return {
      topicId,
      formToken,
      tHash
    };
  }

  parseTopicThanksHtml(html, topicId) {
    if (!html) {
      return [];
    }

    const $ = cheerio.load(`<div id="root">${html}</div>`, {
      decodeEntities: false
    });
    const thankedUsers = [];
    const seenEntries = new Set();

    $("#root b").each((index, element) => {
      const item = $(element);
      const userId = normalizeWhitespace(item.find("u").first().text()) || null;
      const dateText = normalizeWhitespace(item.find("i").first().text());
      const thankedAt = parseRutrackerShortDate(dateText);
      const nicknameNode = item.clone();

      nicknameNode.find("u, i").remove();
      const nickname = normalizeWhitespace(nicknameNode.text());

      if (!nickname || !thankedAt) {
        return;
      }

      const entryKey = `${userId || "unknown"}:${nickname}:${thankedAt.toISOString()}`;

      if (seenEntries.has(entryKey)) {
        return;
      }

      seenEntries.add(entryKey);
      thankedUsers.push({
        userId,
        nickname,
        thankedAt
      });
    });

    if (html.trim() && thankedUsers.length === 0) {
      throw new Error(`Unable to parse thanked users for topic ${topicId}.`);
    }

    return thankedUsers;
  }
}

module.exports = {
  TopicParser
};
