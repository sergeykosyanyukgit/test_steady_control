const cheerio = require("cheerio");

const MONTH_MAP = {
  янв: 1,
  фев: 2,
  мар: 3,
  апр: 4,
  май: 5,
  июн: 6,
  июл: 7,
  авг: 8,
  сен: 9,
  окт: 10,
  ноя: 11,
  дек: 12,
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12
};

const normalizeWhitespace = (value) => {
  if (!value) {
    return "";
  }

  return value.replace(/\s+/g, " ").trim();
};

const normalizeLine = (value) => value.replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n");

const extractPlainTextFromHtml = (html) => {
  const $ = cheerio.load(`<div id="root">${html}</div>`, {
    decodeEntities: false
  });
  const root = $("#root");

  root.find("script, style, var.postImg, .q-post").remove();
  root.find("wbr").replaceWith("");
  root.find("br").replaceWith("\n");
  root.find("hr").replaceWith("\n");
  root.find("img.smile").each((index, element) => {
    const smile = $(element);
    const alt = smile.attr("alt") || "";

    smile.replaceWith(alt);
  });

  root.find("li").each((index, element) => {
    const item = $(element);

    item.prepend("• ");
    item.append("\n");
  });

  root.find("p, div, table, tr, fieldset, legend, blockquote").each((index, element) => {
    $(element).append("\n");
  });

  return normalizeLine(root.text()).replace(/\n{3,}/g, "\n\n").trim();
};

const parseRutrackerDate = (value) => {
  const normalized = normalizeWhitespace(value).replace(/\./g, "");
  const match = normalized.match(/^(\d{1,2})-([A-Za-zА-Яа-я]{3})-(\d{2}) (\d{2}):(\d{2})$/);

  if (!match) {
    return null;
  }

  const day = match[1].padStart(2, "0");
  const monthKey = match[2].toLowerCase();
  const month = MONTH_MAP[monthKey];
  const shortYear = Number(match[3]);
  const year = shortYear < 70 ? 2000 + shortYear : 1900 + shortYear;
  const hours = match[4];
  const minutes = match[5];

  if (!month) {
    return null;
  }

  return new Date(`${year}-${String(month).padStart(2, "0")}-${day}T${hours}:${minutes}:00+03:00`);
};

const parseRutrackerShortDate = (value) => {
  const normalized = normalizeWhitespace(value).replace(/[().]/g, "");
  const match = normalized.match(/^(\d{1,2})-([A-Za-zА-Яа-я]{3})-(\d{2})$/);

  if (!match) {
    return null;
  }

  const day = match[1].padStart(2, "0");
  const monthKey = match[2].toLowerCase();
  const month = MONTH_MAP[monthKey];
  const shortYear = Number(match[3]);
  const year = shortYear < 70 ? 2000 + shortYear : 1900 + shortYear;

  if (!month) {
    return null;
  }

  return new Date(`${year}-${String(month).padStart(2, "0")}-${day}T00:00:00+03:00`);
};

module.exports = {
  extractPlainTextFromHtml,
  normalizeWhitespace,
  parseRutrackerDate,
  parseRutrackerShortDate
};
