
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

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "cache-control": "no-store"
    }
  });
}

function decodeEntities(text = "") {
  return text
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function stripTags(text = "") {
  return decodeEntities(text).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function pick(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = xml.match(re);
  return m ? decodeEntities(m[1]).trim() : "";
}

function parseRSS(xml, feedName) {
  const items = [];
  const matches = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  for (const block of matches.slice(0, 16)) {
    let title = stripTags(pick(block, "title")) || "بدون عنوان";
    let link = stripTags(pick(block, "link"));
    const linkHref = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i);
    if ((!link || link === "") && linkHref) link = linkHref[1];

    const pubDate = stripTags(pick(block, "pubDate")) || stripTags(pick(block, "published")) || stripTags(pick(block, "updated")) || new Date().toISOString();
    const desc = stripTags(pick(block, "description") || pick(block, "summary") || pick(block, "content"));
    const c = classify(title, desc);

    items.push({
      title,
      link: link || "#",
      pubDate,
      source: feedName,
      feed: feedName,
      content: desc.slice(0, 320),
      urgent: c.urgent,
      missile: c.missile,
      level: c.level
    });
  }
  return items;
}

function classify(title, content) {
  const text = `${title || ""} ${content || ""}`.toLowerCase();
  const urgentWords = ["breaking", "urgent", "عاجل", "missile", "missiles", "صاروخ", "صواريخ", "attack", "strike", "قصف", "هجوم", "intercept", "اعتراض", "launch", "أطلق", "أطلقت"];
  const missileWords = ["missile", "missiles", "صاروخ", "صواريخ", "ballistic", "باليستي"];
  const urgent = urgentWords.some(w => text.includes(w.toLowerCase()));
  const missile = missileWords.some(w => text.includes(w.toLowerCase()));
  let level = "مراقبة";
  if (urgent) level = "عاجل";
  if (missile) level = "تحذير صواريخ";
  return { urgent, missile, level };
}

async function fetchWithTimeout(url, ms = 5500) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "Mozilla/5.0 WarRoomX/7.0" },
      cf: { cacheTtl: 15, cacheEverything: true }
    });
  } finally {
    clearTimeout(id);
  }
}

async function fetchMany(feeds) {
  const settled = await Promise.allSettled(feeds.map(async feed => {
    const res = await fetchWithTimeout(feed.url);
    if (!res.ok) throw new Error(`${feed.name}: HTTP ${res.status}`);
    const xml = await res.text();
    return parseRSS(xml, feed.name);
  }));

  let items = [];
  const errors = [];
  for (const r of settled) {
    if (r.status === "fulfilled") items = items.concat(r.value);
    else errors.push(String(r.reason?.message || r.reason));
  }

  const seen = new Set();
  items = items.filter(x => {
    const key = (x.title || "").toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate)).slice(0, 90);

  return { items, errors };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/news") {
      try {
        const result = await fetchMany(NEWS_FEEDS);
        return json({ ok: true, updatedAt: Date.now(), count: result.items.length, errors: result.errors.slice(0, 6), items: result.items });
      } catch (e) {
        return json({ ok: false, error: "فشل جلب الأخبار", details: e.message, items: [] }, 500);
      }
    }

    if (url.pathname === "/api/economy") {
      try {
        const result = await fetchMany(ECONOMY_FEEDS);
        return json({ ok: true, updatedAt: Date.now(), count: result.items.length, errors: result.errors.slice(0, 4), items: result.items });
      } catch (e) {
        return json({ ok: false, error: "تعذر جلب الاقتصاد", details: e.message, items: [] });
      }
    }

    if (url.pathname === "/api/debug") {
      const checks = [];
      for (const feed of NEWS_FEEDS.slice(0, 5)) {
        try {
          const res = await fetchWithTimeout(feed.url, 5000);
          checks.push({ feed: feed.name, ok: res.ok, status: res.status });
        } catch (e) {
          checks.push({ feed: feed.name, ok: false, error: e.message });
        }
      }
      return json({ ok: true, worker: true, time: new Date().toISOString(), checks });
    }

    if (url.pathname === "/api/health") {
      return json({ status: "ok", worker: true, time: new Date().toISOString() });
    }

    return env.ASSETS.fetch(request);
  }
};
