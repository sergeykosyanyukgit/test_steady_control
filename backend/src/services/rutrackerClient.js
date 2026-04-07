const axios = require("axios");
const iconv = require("iconv-lite");

class RutrackerClient {
  constructor({ baseUrl, indexPath, bbSession, requestTimeoutMs }) {
    this.bbSession = bbSession;
    this.baseUrl = baseUrl;
    this.targetUrl = new URL(indexPath, baseUrl).toString();
    this.httpClient = axios.create({
      timeout: requestTimeoutMs,
      responseType: "arraybuffer",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
        "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8"
      }
    });
  }

  async fetchForumIndexHtml() {
    if (!this.bbSession) {
      throw new Error("Environment variable RUTRACKER_BB_SESSION is required for scraping.");
    }

    return this.fetchHtmlByUrl(this.targetUrl);
  }

  async fetchHtmlByUrl(url) {
    if (!this.bbSession) {
      throw new Error("Environment variable RUTRACKER_BB_SESSION is required for scraping.");
    }

    const response = await this.httpClient.get(new URL(url, this.baseUrl).toString(), {
      headers: {
        Cookie: `bb_session=${this.bbSession}`
      }
    });

    return iconv.decode(Buffer.from(response.data), "win1251");
  }

  async fetchTopicThanks({ topicId, tHash, formToken, refererUrl }) {
    if (!this.bbSession) {
      throw new Error("Environment variable RUTRACKER_BB_SESSION is required for scraping.");
    }

    const response = await this.httpClient.post(
      new URL("/forum/ajax.php", this.baseUrl).toString(),
      new URLSearchParams({
        action: "thx",
        mode: "get",
        topic_id: String(topicId),
        t_hash: tHash,
        form_token: formToken
      }).toString(),
      {
        responseType: "json",
        headers: {
          Cookie: `bb_session=${this.bbSession}`,
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "X-Requested-With": "XMLHttpRequest",
          Accept: "application/json, text/javascript, */*; q=0.01",
          Referer: new URL(refererUrl, this.baseUrl).toString()
        }
      }
    );

    if (typeof response.data === "string") {
      return JSON.parse(response.data);
    }

    return response.data;
  }
}

module.exports = {
  RutrackerClient
};
