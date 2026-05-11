const express = require("express");
const cors = require("cors");
const Parser = require("rss-parser");
const path = require("path");

const app = express();

const parser = new Parser({
  timeout: 7000,
  headers: {
    "User-Agent": "Mozilla/5.0 WarRoomNewsBot/1.0"
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const NEWS_FEEDS = [
  {
    name: "Google News Arabic",
    url: "https://news.google.com/rss/search?q=%D8%A5%D8%B3%D8%B1%D8%A7%D8%A6%D9%8A%D9%84%20%D8%A5%D9%8A%D8%B1%D8%A7%D9%86%20%D8%A3%D9%85%D8%B1%D9%8A%D9%83%D8%A7%20%D8%B5%D9%88%D8%A7%D8%B1%D9%8A%D8%AE%20%D8%AD%D8%B1%D8%A8&hl=ar&gl=IL&ceid=IL:ar"
  },
  {
    name: "Google News English",
    url: "https://news.google.com/rss/search?q=Iran%20Israel%20US%20missiles%20war%20breaking&hl=en-US&gl=US&ceid=US:en"
  },
  {
    name: "Google News Hebrew",
    url: "https://news.google.com/rss/search?q=%D7%90%D7%99%D7%A8%D7%90%D7%9F%20%D7%99%D7%A9%D7%A8%D7%90%D7%9C%20%D7%98%D7%99%D7%9C%D7%99%D7%9D&hl=he&gl=IL&ceid=IL:he"
  },
  { name: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { name: "CNN World", url: "https://rss.cnn.com/rss/edition_world.rss" },
  { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml" },
  { name: "NYTimes World", url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml" }
];

const ECONOMY_FEEDS = [
  {
    name: "Google Economy English",
    url: "https://news.google.com/rss/search?q=oil%20gold%20Iran%20Israel%20markets%20Hormuz&hl=en-US&gl=US&ceid=US:en"
  },
  {
    name: "Google Economy Arabic",
    url: "https://news.google.com/rss/search?q=%D8%A7%D9%84%D9%86%D9%81%D8%B7%20%D8%A7%D9%84%D8%B0%D9%87%D8%A8%20%D9%87%D8%B1%D9%85%D8%B2%20%D8%A5%D9%8A%D8%B1%D8%A7%D9%86%20%D8%A5%D8%B3%D8%B1%D8%A7%D8%A6%D9%8A%D9%84&hl=ar&gl=IL&ceid=IL:ar"
  }
];

const cache = {
  news: { time: 0, data: [] },
  economy: { time: 0, data: [] }
};

function classify(title, content) {
  const text = `${title || ""} ${content || ""}`.toLowerCase();
  const urgentWords = ["breaking", "urgent", "عاجل", "missile", "missiles", "صاروخ", "صواريخ", "attack", "strike", "قصف", "هجوم", "intercept", "اعتراض", "launch", "أطلق"];
  const missileWords = ["missile", "missiles", "صاروخ", "صواريخ", "ballistic", "باليستي"];
  const urgent = urgentWords.some(w => text.includes(w.toLowerCase()));
  const missile = missileWords.some(w => text.includes(w.toLowerCase()));
  let level = "مراقبة";
  if (urgent) level = "عاجل";
  if (missile) level = "تحذير صواريخ";
  return { urgent, missile, level };
}

async function fetchMany(feeds, limitPerFeed = 12) {
  const settled = await Promise.allSettled(
    feeds.map(async feed => {
      const parsed = await parser.parseURL(feed.url);
      return (parsed.items || []).slice(0, limitPerFeed).map(item => {
        const title = item.title || "بدون عنوان";
        const raw = item.contentSnippet || item.summary || item.content || "";
        const clean = String(raw).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
        const c = classify(title, clean);
        return {
          title,
          link: item.link || "#",
          pubDate: item.isoDate || item.pubDate || new Date().toISOString(),
          source: parsed.title || feed.name,
          feed: feed.name,
          content: clean.slice(0, 320),
          urgent: c.urgent,
          missile: c.missile,
          level: c.level
        };
      });
    })
  );

  let items = [];
  const errors = [];
  for (const r of settled) {
    if (r.status === "fulfilled") items = items.concat(r.value);
    else errors.push(String(r.reason && r.reason.message ? r.reason.message : r.reason));
  }

  const seen = new Set();
  items = items
    .filter(x => {
      const key = (x.title || "").toLowerCase().trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
    .slice(0, 90);

  return { items, errors };
}

app.get("/api/news", async (req, res) => {
  try {
    if (Date.now() - cache.news.time < 20000 && cache.news.data.length) {
      return res.json({ ok: true, cached: true, updatedAt: cache.news.time, items: cache.news.data });
    }
    const result = await fetchMany(NEWS_FEEDS, 14);
    cache.news = { time: Date.now(), data: result.items };
    res.json({ ok: true, cached: false, updatedAt: cache.news.time, count: result.items.length, errors: result.errors.slice(0, 6), items: result.items });
  } catch (err) {
    res.status(500).json({ ok: false, error: "فشل جلب الأخبار", details: err.message, items: cache.news.data || [] });
  }
});

app.get("/api/economy", async (req, res) => {
  try {
    if (Date.now() - cache.economy.time < 60000 && cache.economy.data.length) {
      return res.json({ ok: true, cached: true, updatedAt: cache.economy.time, items: cache.economy.data });
    }
    const result = await fetchMany(ECONOMY_FEEDS, 10);
    cache.economy = { time: Date.now(), data: result.items };
    res.json({ ok: true, cached: false, updatedAt: cache.economy.time, count: result.items.length, errors: result.errors.slice(0, 4), items: result.items });
  } catch (err) {
    res.json({ ok: false, error: "تعذر جلب الاقتصاد", details: err.message, items: cache.economy.data || [] });
  }
});

app.get("/api/debug", async (req, res) => {
  const checks = [];
  for (const feed of NEWS_FEEDS.slice(0, 4)) {
    try {
      const parsed = await parser.parseURL(feed.url);
      checks.push({ feed: feed.name, ok: true, count: (parsed.items || []).length });
    } catch (e) {
      checks.push({ feed: feed.name, ok: false, error: e.message });
    }
  }
  res.json({ ok: true, node: process.version, time: new Date().toISOString(), checks });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`WarRoom running on port ${PORT}`);
});
