const express = require('express');
const cors = require('cors');
const axios = require('axios');
const Parser = require('rss-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const CACHE_MS = 35 * 1000;
const BREAKING_CACHE_MS = 12 * 1000;
let NEWS_CACHE = { updatedAt: 0, news: [] };
let LAST_ERRORS = [];

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const parser = new Parser({
  timeout: 2500,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/605.1.15 WarNewsArabic/3.0',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*'
  }
});

const rssSources = [
  // Google News Arabic super-searches
  { name: 'Google News عربي - حرب إسرائيل إيران', lang: 'ar', url: 'https://news.google.com/rss/search?q=%D8%A5%D8%B3%D8%B1%D8%A7%D8%A6%D9%8A%D9%84%20%D8%A5%D9%8A%D8%B1%D8%A7%D9%86%20%D8%AD%D8%B1%D8%A8%20%D8%B5%D9%88%D8%A7%D8%B1%D9%8A%D8%AE&hl=ar&gl=IL&ceid=IL:ar' },
  { name: 'Google News عربي - عاجل صواريخ', lang: 'ar', url: 'https://news.google.com/rss/search?q=%D8%B9%D8%A7%D8%AC%D9%84%20%D8%B5%D9%88%D8%A7%D8%B1%D9%8A%D8%AE%20%D8%A5%D8%B7%D9%84%D8%A7%D9%82%20%D8%A7%D8%B9%D8%AA%D8%B1%D8%A7%D8%B6%20%D8%A5%D8%B3%D8%B1%D8%A7%D8%A6%D9%8A%D9%84%20%D8%A5%D9%8A%D8%B1%D8%A7%D9%86&hl=ar&gl=IL&ceid=IL:ar' },
  { name: 'Google News عربي - أمريكا إيران إسرائيل', lang: 'ar', url: 'https://news.google.com/rss/search?q=%D8%A3%D9%85%D8%B1%D9%8A%D9%83%D8%A7%20%D8%A5%D9%8A%D8%B1%D8%A7%D9%86%20%D8%A5%D8%B3%D8%B1%D8%A7%D8%A6%D9%8A%D9%84%20%D8%AA%D8%B1%D8%A7%D9%85%D8%A8%20%D8%B6%D8%B1%D8%A8%D8%A9&hl=ar&gl=IL&ceid=IL:ar' },
  { name: 'Google News عربي - مضيق هرمز والنفط', lang: 'ar', url: 'https://news.google.com/rss/search?q=%D9%85%D8%B6%D9%8A%D9%82%20%D9%87%D8%B1%D9%85%D8%B2%20%D9%86%D9%81%D8%B7%20%D8%A5%D9%8A%D8%B1%D8%A7%D9%86%20%D8%A3%D9%85%D8%B1%D9%8A%D9%83%D8%A7&hl=ar&gl=IL&ceid=IL:ar' },
  { name: 'Google News عربي - لبنان سوريا العراق', lang: 'ar', url: 'https://news.google.com/rss/search?q=%D9%84%D8%A8%D9%86%D8%A7%D9%86%20%D8%B3%D9%88%D8%B1%D9%8A%D8%A7%20%D8%A7%D9%84%D8%B9%D8%B1%D8%A7%D9%82%20%D8%A5%D9%8A%D8%B1%D8%A7%D9%86%20%D8%A5%D8%B3%D8%B1%D8%A7%D8%A6%D9%8A%D9%84%20%D9%82%D8%B5%D9%81&hl=ar&gl=IL&ceid=IL:ar' },

  // Google News English / Hebrew searches
  { name: 'Google News EN - Israel Iran US', lang: 'en', url: 'https://news.google.com/rss/search?q=Israel%20Iran%20United%20States%20missiles%20war%20Hormuz&hl=en-US&gl=US&ceid=US:en' },
  { name: 'Google News EN - Breaking missile alert', lang: 'en', url: 'https://news.google.com/rss/search?q=breaking%20missile%20launch%20interception%20Israel%20Iran%20attack&hl=en-US&gl=US&ceid=US:en' },
  { name: 'Google News EN - oil markets war', lang: 'en', url: 'https://news.google.com/rss/search?q=oil%20gold%20markets%20Hormuz%20Israel%20Iran%20war&hl=en-US&gl=US&ceid=US:en' },
  { name: 'Google News עברית - ישראל איראן', lang: 'he', url: 'https://news.google.com/rss/search?q=%D7%99%D7%A9%D7%A8%D7%90%D7%9C%20%D7%90%D7%99%D7%A8%D7%90%D7%9F%20%D7%98%D7%99%D7%9C%D7%99%D7%9D%20%D7%AA%D7%A7%D7%99%D7%A4%D7%94&hl=he&gl=IL&ceid=IL:he' },

  // Arabic outlets with public RSS
  { name: 'BBC Arabic', lang: 'ar', url: 'https://feeds.bbci.co.uk/arabic/rss.xml' },
  { name: 'BBC Arabic Middle East', lang: 'ar', url: 'https://feeds.bbci.co.uk/arabic/middleeast/rss.xml' },
  { name: 'CNN Arabic', lang: 'ar', url: 'https://arabic.cnn.com/rss' },
  { name: 'Sky News Arabia', lang: 'ar', url: 'https://www.skynewsarabia.com/rss' },
  { name: 'France24 Arabic', lang: 'ar', url: 'https://www.france24.com/ar/rss' },
  { name: 'DW Arabic', lang: 'ar', url: 'https://rss.dw.com/rdf/rss-ar-all' },
  { name: 'RT Arabic', lang: 'ar', url: 'https://arabic.rt.com/rss/' },
  { name: 'TRT Arabic', lang: 'ar', url: 'https://www.trtarabi.com/rss' },
  { name: 'Al Mayadeen', lang: 'ar', url: 'https://www.almayadeen.net/rss' },
  { name: 'Al Manar', lang: 'ar', url: 'https://www.almanar.com.lb/rss' },
  { name: 'Asharq Al-Awsat', lang: 'ar', url: 'https://aawsat.com/feed' },
  { name: 'Al Arabiya', lang: 'ar', url: 'https://www.alarabiya.net/.mrss/ar.xml' },
  { name: 'Al Hadath', lang: 'ar', url: 'https://www.alhadath.net/.mrss/ar.xml' },
  { name: 'Al Jazeera Arabic', lang: 'ar', url: 'https://www.aljazeera.net/aljazeerarss/ar.xml' },
  { name: 'Al Jazeera Mubasher', lang: 'ar', url: 'https://mubasher.aljazeera.net/rss' },
  { name: 'Arabi21', lang: 'ar', url: 'https://arabi21.com/rss' },
  { name: 'Anadolu Arabic', lang: 'ar', url: 'https://www.aa.com.tr/ar/rss/default?cat=guncel' },

  // Global English outlets / agencies
  { name: 'Reuters World', lang: 'en', url: 'https://www.reutersagency.com/feed/?best-topics=world&post_type=best' },
  { name: 'AP Top News', lang: 'en', url: 'https://apnews.com/hub/ap-top-news?output=rss' },
  { name: 'BBC World', lang: 'en', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { name: 'BBC Middle East', lang: 'en', url: 'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml' },
  { name: 'CNN World', lang: 'en', url: 'http://rss.cnn.com/rss/edition_world.rss' },
  { name: 'Al Jazeera English', lang: 'en', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { name: 'The Guardian World', lang: 'en', url: 'https://www.theguardian.com/world/rss' },
  { name: 'Politico', lang: 'en', url: 'https://www.politico.com/rss/politicopicks.xml' },
  { name: 'NPR World', lang: 'en', url: 'https://feeds.npr.org/1004/rss.xml' },
  { name: 'ABC News International', lang: 'en', url: 'https://abcnews.go.com/abcnews/internationalheadlines' },

  // Israel / regional Google aggregations
  { name: 'Google News EN - IDF Israel alerts', lang: 'en', url: 'https://news.google.com/rss/search?q=IDF%20Home%20Front%20Command%20sirens%20missile%20Israel&hl=en-US&gl=IL&ceid=IL:en' },
  { name: 'Google News HE - פיקוד העורף', lang: 'he', url: 'https://news.google.com/rss/search?q=%D7%A4%D7%99%D7%A7%D7%95%D7%93%20%D7%94%D7%A2%D7%95%D7%A8%D7%A3%20%D7%90%D7%96%D7%A2%D7%A7%D7%95%D7%AA%20%D7%98%D7%99%D7%9C%D7%99%D7%9D&hl=he&gl=IL&ceid=IL:he' },
  { name: 'Google News AR - صفارات إسرائيل', lang: 'ar', url: 'https://news.google.com/rss/search?q=%D8%B5%D9%81%D8%A7%D8%B1%D8%A7%D8%AA%20%D8%A5%D9%86%D8%B0%D8%A7%D8%B1%20%D8%A5%D8%B3%D8%B1%D8%A7%D8%A6%D9%8A%D9%84%20%D8%B5%D9%88%D8%A7%D8%B1%D9%8A%D8%AE&hl=ar&gl=IL&ceid=IL:ar' }
];

const backupNews = [
  { title: 'مصادر الأخبار لم ترجع نتائج الآن، لكن لوحة المتابعة تعمل', summary: 'هذا تنبيه احتياطي فقط. اضغط “فحص الاتصال” لمعرفة أي مصدر فشل. عند رجوع RSS سيعرض الموقع الأخبار الحقيقية تلقائياً.', source: 'النظام', category: 'عام', country: 'إقليمي', severity: 20, credibility: 50, url: '#'},
  { title: 'نصيحة تشغيل: افتح /api/debug لفحص مصادر RSS', summary: 'إذا كان كل شيء failed فالمشكلة من اتصال Mac أو حظر DNS/مزود الإنترنت لمصادر RSS.', source: 'النظام', category: 'تشخيص', country: 'إقليمي', severity: 15, credibility: 90, url: '/api/debug'}
];

function stripHtml(s='') { return String(s).replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim(); }
function categoryFor(text) { const t = text.toLowerCase(); if (/oil|brent|crude|نفط|برنت|هرمز|خليج/.test(t)) return 'اقتصاد / نفط'; if (/missile|rocket|صاروخ|صواريخ|اعتراض|دفاع/.test(t)) return 'صواريخ / دفاعات'; if (/trump|white house|واشنطن|أمريكا|امريكا|ترامب/.test(t)) return 'أمريكا'; if (/iran|إيران|ايران|طهران|خامنئي|الحرس/.test(t)) return 'إيران'; if (/israel|إسرائيل|اسرائيل|تل أبيب|نتنياهو/.test(t)) return 'إسرائيل'; return 'عام'; }
function severityFor(text) { const t = text.toLowerCase(); let score = 25; if (/عاجل|breaking|urgent/.test(t)) score += 25; if (/missile|صاروخ|صواريخ|attack|هجوم|strike|ضربة|قصف|airstrike/.test(t)) score += 25; if (/dead|killed|قتلى|مقتل|إصابات|اصابات/.test(t)) score += 15; if (/hormuz|هرمز|oil|نفط/.test(t)) score += 10; if (/official|رسمي|بيان|البنتاغون|البيت الأبيض/.test(t)) score += 8; return Math.min(100, score); }
function credibilityFor(source, text) { let c = 62; const s = source.toLowerCase(); if (/reuters|ap|bbc|cnn|france24|sky/.test(s)) c += 18; if (/google news/.test(s)) c += 12; if (/مصادر|reportedly|تقول مصادر/.test(text.toLowerCase())) c -= 8; if (/رسمي|official|statement|بيان/.test(text.toLowerCase())) c += 10; return Math.max(20, Math.min(98, c)); }
function relevant(text) { const t = text.toLowerCase(); return /(إيران|ايران|إسرائيل|اسرائيل|أمريكا|امريكا|ترامب|نتنياهو|صاروخ|صواريخ|قصف|هجوم|هرمز|نفط|iran|israel|trump|missile|hormuz|attack|strike|war|oil)/i.test(t); }
function timeout(p, ms) { return Promise.race([p, new Promise((_, reject)=>setTimeout(()=>reject(new Error('timeout '+ms+'ms')), ms))]); }

async function fetchOneSource(src) {
  const started = Date.now();
  try {
    // axios first gives clearer errors than parseURL on some Macs/networks
    const response = await timeout(axios.get(src.url, { timeout: 3000, headers: { 'User-Agent': 'Mozilla/5.0 WarNewsArabic/3.0' } }), 3500);
    const feed = await parser.parseString(response.data);
    const items = [];
    for (const item of (feed.items || []).slice(0, 16)) {
      const full = `${item.title || ''} ${item.contentSnippet || item.content || ''}`;
      if (!relevant(full)) continue;
      const title = stripHtml(item.title || 'بدون عنوان');
      const summaryRaw = stripHtml(item.contentSnippet || item.content || item.summary || title);
      const summary = summaryRaw.length > 220 ? summaryRaw.slice(0, 220) + '…' : summaryRaw;
      items.push({
        id: Buffer.from((item.link || title)).toString('base64').replace(/[^a-zA-Z0-9]/g,'').slice(0, 24),
        title,
        summary,
        original: summaryRaw,
        url: item.link || '#',
        source: src.name,
        lang: src.lang,
        published: item.isoDate || item.pubDate || new Date().toISOString(),
        category: categoryFor(full),
        severity: severityFor(full),
        credibility: credibilityFor(src.name, full),
        country: /Iran|إيران|ايران|طهران/.test(full) ? 'إيران' : /Israel|إسرائيل|اسرائيل|تل أبيب/.test(full) ? 'إسرائيل' : /Trump|USA|US|أمريكا|امريكا|واشنطن/.test(full) ? 'أمريكا' : 'إقليمي'
      });
    }
    return { ok: true, source: src.name, ms: Date.now()-started, count: items.length, items };
  } catch (e) {
    return { ok: false, source: src.name, ms: Date.now()-started, error: e.message, items: [] };
  }
}

async function fetchAllNews() {
  LAST_ERRORS = [];
  const settled = await Promise.allSettled(rssSources.map(fetchOneSource));
  const diagnostics = settled.map(x => x.status === 'fulfilled' ? x.value : { ok:false, source:'unknown', error:x.reason?.message || 'unknown' });
  LAST_ERRORS = diagnostics.filter(d => !d.ok || d.count === 0);
  let out = diagnostics.flatMap(d => d.items || []);
  const seen = new Set();
  out = out.sort((a,b)=>new Date(b.published)-new Date(a.published)).filter(n => { const k = n.title.toLowerCase().slice(0,90); if(seen.has(k)) return false; seen.add(k); return true; }).slice(0, 90);
  if (out.length) NEWS_CACHE = { updatedAt: Date.now(), news: out };
  return out.length ? out : (NEWS_CACHE.news.length ? NEWS_CACHE.news : backupNews.map((n,i)=>({ id:'backup-'+i, published:new Date().toISOString(), lang:'ar', ...n })));
}

app.get('/api/news', async (req,res)=>{
  try {
    if (NEWS_CACHE.news.length && Date.now() - NEWS_CACHE.updatedAt < CACHE_MS) {
      return res.json({ ok:true, cached:true, updatedAt:new Date(NEWS_CACHE.updatedAt).toISOString(), count:NEWS_CACHE.news.length, warnings:LAST_ERRORS, news:NEWS_CACHE.news });
    }
    const news = await fetchAllNews();
    res.json({ ok:true, cached:false, updatedAt:new Date().toISOString(), count:news.length, warnings:LAST_ERRORS, news });
  } catch(e) {
    const news = NEWS_CACHE.news.length ? NEWS_CACHE.news : backupNews.map((n,i)=>({ id:'error-'+i, published:new Date().toISOString(), lang:'ar', ...n }));
    res.json({ ok:true, cached:!!NEWS_CACHE.news.length, error:e.message, updatedAt:new Date().toISOString(), count:news.length, warnings:LAST_ERRORS, news });
  }
});


app.get('/api/breaking', async (req,res)=>{
  try {
    const freshEnough = NEWS_CACHE.news.length && Date.now() - NEWS_CACHE.updatedAt < BREAKING_CACHE_MS;
    const news = freshEnough ? NEWS_CACHE.news : await fetchAllNews();
    const breakingWords = /(عاجل|breaking|urgent|missile|missiles|rocket|attack|strike|airstrike|قصف|هجوم|صاروخ|صواريخ|انفجار|ضربة|اعتراض|صفارات|إطلاق)/i;
    const item = (news || []).find(n => (n.severity >= 72) || breakingWords.test(`${n.title||''} ${n.summary||''}`));
    res.json({ ok:true, updatedAt:new Date().toISOString(), hasBreaking:!!item, item:item || null, count:(news||[]).length });
  } catch(e) {
    res.json({ ok:false, error:e.message, hasBreaking:false, item:null });
  }
});

app.get('/api/debug', async (req,res)=>{
  const diagnostics = await Promise.all(rssSources.map(fetchOneSource));
  res.json({ ok:true, time:new Date().toISOString(), diagnostics: diagnostics.map(d => ({ source:d.source, ok:d.ok, count:d.count, ms:d.ms, error:d.error || null })) });
});

app.get('/api/markets', async (req,res)=>{
  // No paid API needed. This never fails; it is a market-impact board, not exact quote feed.
  res.json({ ok:true, updatedAt:new Date().toISOString(), markets:[
    { symbol:'Brent', name:'نفط برنت', value:'راقب السعر المباشر من TradingView/Investing', impact:'أي تصعيد بمضيق هرمز قد يدفع النفط للصعود.' },
    { symbol:'WTI', name:'النفط الأمريكي', value:'مؤشر حساس للتوتر بالخليج', impact:'يتأثر بتصريحات أمريكا والمخزون النفطي.' },
    { symbol:'XAUUSD', name:'الذهب', value:'ملاذ آمن وقت الحرب', impact:'قد يرتفع مع الخوف وانخفاض شهية المخاطرة.' },
    { symbol:'USD/ILS', name:'دولار/شيكل', value:'يتأثر بالتوتر المحلي', impact:'التصعيد ضد إسرائيل قد يضغط على الشيكل.' }
  ]});
});

app.get('*', (req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(PORT, () => {
  console.log(`✅ WarScope Elite Live running: http://localhost:${PORT}`);
  fetchAllNews().catch(()=>{});
  setInterval(()=>fetchAllNews().catch(()=>{}), 30000);
});
