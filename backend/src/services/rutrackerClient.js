const axios = require("axios");
const iconv = require("iconv-lite");

class RutrackerClient {
  constructor({ baseUrl, indexPath, bbSession, requestTimeoutMs }) {
    this.bbSession = bbSession;
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

    const response = await this.httpClient.get(this.targetUrl, {
      headers: {
        Cookie: `bb_session=${this.bbSession}`
      }
    });

    return iconv.decode(Buffer.from(response.data), "win1251");
  }
}

module.exports = {
  RutrackerClient
};
