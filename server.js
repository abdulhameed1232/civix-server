const express = require('express');
const cors = require('cors');
const Parser = require('rss-parser');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Free video keys for Reels (set them on Render, never here).
// Pixabay is used first; Pexels is used too if you ever get a key.
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY || '';
const PEXELS_API_KEY = process.env.PEXELS_API_KEY || '';

const app = express();
app.use(cors());

const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  },
  customFields: {
    item: [
      ['media:content', 'mediaContent', { keepArray: true }],
      ['media:thumbnail', 'mediaThumbnail', { keepArray: true }],
    ],
  },
});

// name, url, language, country, category
const f = (name, url, language, country, category = 'World') =>
  ({ name, url, language, country, category });

const BBC = 'https://feeds.bbci.co.uk';
const GU = 'https://www.theguardian.com';
const FEEDS = [
  // ---------- World, politics, business ----------
  f('BBC News', `${BBC}/news/world/rss.xml`, 'en', 'World'),
  f('BBC Politics', `${BBC}/news/politics/rss.xml`, 'en', 'United Kingdom', 'Politics'),
  f('BBC Business', `${BBC}/news/business/rss.xml`, 'en', 'World', 'Business'),
  f('Al Jazeera', 'https://www.aljazeera.com/xml/rss/all.xml', 'en', 'Qatar'),
  f('The Guardian', `${GU}/world/rss`, 'en', 'United Kingdom'),
  f('NPR', 'https://feeds.npr.org/1001/rss.xml', 'en', 'United States'),
  f('DW', 'https://rss.dw.com/rdf/rss-en-all', 'en', 'Germany'),
  f('France 24', 'https://www.france24.com/en/rss', 'en', 'France'),
  f('The Hindu', 'https://www.thehindu.com/news/feeder/default.rss', 'en', 'India'),
  f('Times of India', 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms', 'en', 'India'),
  f('NDTV', 'https://feeds.feedburner.com/ndtvnews-top-stories', 'en', 'India'),
  f('Dawn', 'https://www.dawn.com/feeds/home', 'en', 'Pakistan'),
  f('The National', 'https://www.thenationalnews.com/arc/outboundfeeds/rss/?outputType=xml', 'en', 'UAE'),

  // ---------- Topics ----------
  f('BBC Technology', `${BBC}/news/technology/rss.xml`, 'en', 'World', 'Technology'),
  f('The Verge', 'https://www.theverge.com/rss/index.xml', 'en', 'United States', 'Technology'),
  f('TechCrunch', 'https://techcrunch.com/feed/', 'en', 'United States', 'Technology'),
  f('IGN', 'https://feeds.feedburner.com/ign/all', 'en', 'United States', 'Gaming'),
  f('Polygon', 'https://www.polygon.com/rss/index.xml', 'en', 'United States', 'Gaming'),
  f('PC Gamer', 'https://www.pcgamer.com/rss/', 'en', 'United Kingdom', 'Gaming'),
  f('BBC Sport', `${BBC}/sport/rss.xml`, 'en', 'World', 'Sports'),
  f('BBC Science', `${BBC}/news/science_and_environment/rss.xml`, 'en', 'World', 'Science'),
  f('NASA', 'https://www.nasa.gov/feed/', 'en', 'United States', 'Science'),
  f('BBC Entertainment', `${BBC}/news/entertainment_and_arts/rss.xml`, 'en', 'World', 'Entertainment'),
  f('Guardian Film', `${GU}/film/rss`, 'en', 'United Kingdom', 'Movies'),
  f('Variety', 'https://variety.com/feed/', 'en', 'United States', 'Movies'),
  f('Rolling Stone', 'https://www.rollingstone.com/music/feed/', 'en', 'United States', 'Music'),
  f('NME', 'https://www.nme.com/feed', 'en', 'United Kingdom', 'Music'),
  f('Guardian Travel', `${GU}/travel/rss`, 'en', 'United Kingdom', 'Travel'),
  f('Guardian Food', `${GU}/food/rss`, 'en', 'United Kingdom', 'Food'),
  f('Guardian Fashion', `${GU}/fashion/rss`, 'en', 'United Kingdom', 'Fashion'),
  f('Guardian Art', `${GU}/artanddesign/rss`, 'en', 'United Kingdom', 'Art'),
  f('PetaPixel', 'https://petapixel.com/feed/', 'en', 'United States', 'Photography'),
  f('Guardian Environment', `${GU}/environment/rss`, 'en', 'United Kingdom', 'Nature'),
  f('Mongabay', 'https://news.mongabay.com/feed/', 'en', 'World', 'Nature'),
  f('Guardian Education', `${GU}/education/rss`, 'en', 'United Kingdom', 'Education'),

  // ---------- Other languages ----------
  f('BBC Hindi', `${BBC}/hindi/rss.xml`, 'hi', 'India'),
  f('BBC Telugu', `${BBC}/telugu/rss.xml`, 'te', 'India'),
  f('BBC Tamil', `${BBC}/tamil/rss.xml`, 'ta', 'India'),
  f('BBC Marathi', `${BBC}/marathi/rss.xml`, 'mr', 'India'),
  f('BBC Bengali', `${BBC}/bengali/rss.xml`, 'bn', 'Bangladesh'),
  f('BBC Urdu', `${BBC}/urdu/rss.xml`, 'ur', 'Pakistan'),
  f('BBC Arabic', `${BBC}/arabic/rss.xml`, 'ar', 'World'),
  f('BBC Mundo', `${BBC}/mundo/rss.xml`, 'es', 'World'),
  f('BBC Brasil', `${BBC}/portuguese/rss.xml`, 'pt', 'World'),
  f('BBC Russian', `${BBC}/russian/rss.xml`, 'ru', 'World'),
  f('BBC Chinese', `${BBC}/zhongwen/simp/rss.xml`, 'zh', 'World'),
  f('BBC Indonesia', `${BBC}/indonesia/rss.xml`, 'id', 'World'),
  f('BBC Turkce', `${BBC}/turkce/rss.xml`, 'tr', 'World'),
  f('BBC Swahili', `${BBC}/swahili/rss.xml`, 'sw', 'World'),
  f('BBC Persian', `${BBC}/persian/rss.xml`, 'fa', 'World'),
  f('DW Deutsch', 'https://rss.dw.com/rdf/rss-de-all', 'de', 'Germany'),
  f('DW Arabic', 'https://rss.dw.com/rdf/rss-ar-all', 'ar', 'Germany'),
  f('France 24 Francais', 'https://www.france24.com/fr/rss', 'fr', 'France'),
  f('France 24 Espanol', 'https://www.france24.com/es/rss', 'es', 'France'),
  f('France 24 Arabic', 'https://www.france24.com/ar/rss', 'ar', 'France'),
  f('NHK', 'https://www3.nhk.or.jp/rss/news/cat0.xml', 'ja', 'Japan'),
];

// ---------- Reels: vertical videos from Pexels (search word -> app topic) ----------
const REEL_TOPICS = [
  ['nature', 'Nature'], ['animals', 'Nature'], ['ocean', 'Nature'], ['mountains', 'Nature'],
  ['travel', 'Travel'], ['city', 'Travel'],
  ['food', 'Food'], ['cooking', 'Food'],
  ['sports', 'Sports'], ['fitness', 'Sports'],
  ['technology', 'Technology'], ['science', 'Science'],
  ['music', 'Music'], ['dance', 'Music'],
  ['fashion', 'Fashion'], ['art', 'Art'],
  ['photography', 'Photography'], ['study', 'Education'],
];

const TTL = 10 * 60 * 1000;          // news: refresh every 10 minutes
const REELS_TTL = 60 * 60 * 1000;    // reels: every hour (keeps Pexels free limits safe)
const RETRY = 3 * 60 * 1000;
const MAX_PER_FEED = 15;
const REELS_PER_TOPIC = 15;
const CACHE_FILE = path.join(__dirname, 'feed-cache.json');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const md5 = s => crypto.createHash('md5').update(s).digest('hex');

let lastGood = {};
try {
  lastGood = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  console.log(`Loaded saved copy of ${Object.keys(lastGood).length} feeds from disk`);
} catch (e) {
  lastGood = {};
}

const stripHtml = s =>
  String(s || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

const imgInHtml = html => {
  const m = /<img[^>]+src=["']([^"']+)["']/i.exec(html || '');
  return m ? m[1] : undefined;
};

// Use the biggest picture a source offers
function pickMedia(item) {
  let image;
  let imageWidth = -1;
  let video;
  for (const c of item.mediaContent || []) {
    const a = c.$ || {};
    if (!a.url) continue;
    const type = (a.type || '').toLowerCase();
    const medium = (a.medium || '').toLowerCase();
    if (type.startsWith('video/') || medium === 'video') {
      video = video || a.url;
    } else if (type.startsWith('image/') || medium === 'image' || /\.(jpe?g|png|webp)(\?|$)/i.test(a.url)) {
      const w = parseInt(a.width, 10) || 0;
      if (!image || w > imageWidth) {
        image = a.url;
        imageWidth = w;
      }
    }
  }
  const thumb = (item.mediaThumbnail || [])[0];
  if (!image && thumb && thumb.$ && thumb.$.url) image = thumb.$.url;

  const enc = item.enclosure;
  if (enc && enc.url) {
    const t = (enc.type || '').toLowerCase();
    if (t.startsWith('video/')) video = video || enc.url;
    else if (t.startsWith('image/') && !image) image = enc.url;
  }
  if (!image) image = imgInHtml(item['content:encoded'] || item.content || item.description);

  if (image) {
    image = image.replace('http://', 'https://');
    if (/bbci\.co\.uk|bbc\.co\.uk/.test(image)) image = image.replace('/240/', '/976/'); // BBC: bigger version
  }
  return { image, video };
}

function toArticle(feed, item) {
  if (!item.link) return null;
  const date = new Date(item.isoDate || item.pubDate || Date.now());
  const { image, video } = pickMedia(item);

  const article = {
    id: md5(item.link.split('?')[0]),
    title: stripHtml(item.title),
    description: stripHtml(item.contentSnippet || item.content || item.description).slice(0, 400),
    author: item.creator || item.author || undefined,
    link: item.link,
    publishedAt: isNaN(date) ? new Date().toISOString() : date.toISOString(),
    source: feed.name,
    language: feed.language,
    country: feed.country,
    category: feed.category,
    imageUrl: image,
  };
  if (video) {
    article.videoUrl = video;
    article.videoType = 'file';
  }
  return article.title ? article : null;
}

async function fetchFeed(feed) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const data = await parser.parseURL(feed.url);
      const articles = (data.items || [])
        .slice(0, MAX_PER_FEED)
        .map(item => toArticle(feed, item))
        .filter(Boolean);
      if (!articles.length) throw new Error('feed was empty');
      lastGood[feed.url] = articles;
      return { articles, stale: false };
    } catch (e) {
      lastError = e;
      await sleep(800);
    }
  }
  console.log(`  x ${feed.name}: ${lastError.message}`);
  if (lastGood[feed.url]) return { articles: lastGood[feed.url], stale: true };
  throw lastError;
}

// ---------- Pexels reels ----------

// "https://www.pexels.com/video/a-dog-running-on-grass-123/" -> "A dog running on grass"
function titleFromPexelsUrl(url) {
  const slug = String(url || '').split('/video/')[1] || '';
  const words = slug.replace(/\/$/, '').replace(/-\d+$/, '').replace(/-/g, ' ').trim();
  return words ? words[0].toUpperCase() + words.slice(1) : '';
}

// Choose an mp4 that is tall and not too heavy for phones (about 720p to 1080p)
function pickVideoFile(files) {
  const mp4 = (files || []).filter(
    v => v.link && (v.file_type || '').includes('mp4') && v.height > v.width
  );
  if (!mp4.length) return null;
  mp4.sort((a, b) => Math.abs(a.height - 1280) - Math.abs(b.height - 1280));
  return mp4[0];
}

async function fetchPexelsTopic([query, category]) {
  const page = 1 + Math.floor(Math.random() * 20); // different videos each refresh
  const url =
    'https://api.pexels.com/videos/search' +
    `?query=${encodeURIComponent(query)}&orientation=portrait&size=medium` +
    `&per_page=${REELS_PER_TOPIC}&page=${page}`;
  const res = await fetch(url, { headers: { Authorization: PEXELS_API_KEY } });
  if (!res.ok) throw new Error(`Pexels status ${res.status}`);
  const data = await res.json();

  return (data.videos || [])
    .filter(v => v.duration > 0 && v.duration <= 60) // short clips only
    .map(v => {
      const file = pickVideoFile(v.video_files);
      if (!file) return null;
      const name = (v.user && v.user.name) || 'Pexels';
      return {
        id: md5('pexels:' + v.id),
        title: titleFromPexelsUrl(v.url) || `${category} video`,
        description: `Video by ${name} on Pexels`,
        author: name,
        link: v.url,
        publishedAt: new Date().toISOString(),
        source: 'Pexels',
        language: 'any',   // no speech, so it fits every language
        country: 'World',
        category,
        imageUrl: v.image,
        videoUrl: file.link,
        videoType: 'file',
        isShort: true,
        width: file.width,
        height: file.height,
        duration: v.duration,
      };
    })
    .filter(Boolean);
}

// ---------- Pixabay reels ----------
// Pick the file closest to 720p tall-ish, small enough for phones
function pickPixabayFile(videos) {
  const files = ['medium', 'small', 'large', 'tiny']
    .map(k => videos && videos[k])
    .filter(v => v && v.url && v.width && v.height);
  if (!files.length) return null;
  files.sort((a, b) => Math.abs(Math.max(a.width, a.height) - 1280) - Math.abs(Math.max(b.width, b.height) - 1280));
  return files[0];
}

async function fetchPixabayTopic([query, category]) {
  const page = 1 + Math.floor(Math.random() * 5); // different videos each round
  const url =
    'https://pixabay.com/api/videos/' +
    `?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(query)}` +
    `&safesearch=true&per_page=50&page=${page}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Pixabay status ${res.status}`);
  const data = await res.json();

  return (data.hits || [])
    .filter(v => v.duration > 0 && v.duration <= 60) // short clips only
    .map(v => {
      const file = pickPixabayFile(v.videos);
      if (!file) return null;
      const name = v.user || 'Pixabay';
      const tags = String(v.tags || '').split(',').map(t => t.trim()).filter(Boolean);
      const title = tags.length ? tags.slice(0, 3).join(' · ') : `${category} video`;
      return {
        id: md5('pixabay:' + v.id),
        title: title[0].toUpperCase() + title.slice(1),
        description: `Video by ${name} on Pixabay`,
        author: name,
        link: v.pageURL,
        publishedAt: new Date().toISOString(),
        source: 'Pixabay',
        language: 'any',   // no speech, so it fits every language
        country: 'World',
        category,
        imageUrl: file.thumbnail,
        videoUrl: file.url,
        videoType: 'file',
        isShort: true,
        vertical: file.height > file.width,
        width: file.width,
        height: file.height,
        duration: v.duration,
      };
    })
    .filter(Boolean);
}

// Use every video source that has a key
async function fetchReelsTopic(topic) {
  const jobs = [];
  if (PIXABAY_API_KEY) jobs.push(fetchPixabayTopic(topic));
  if (PEXELS_API_KEY) jobs.push(fetchPexelsTopic(topic));
  const results = await Promise.allSettled(jobs);
  const ok = results.filter(r => r.status === 'fulfilled').flatMap(r => r.value);
  if (!ok.length && results.length) {
    const err = results.find(r => r.status === 'rejected');
    if (err) throw err.reason;
  }
  return ok;
}

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function runLimited(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = { status: 'fulfilled', value: await fn(items[i]) };
      } catch (e) {
        results[i] = { status: 'rejected', reason: e };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// ---------- News cache ----------
let cache = { at: 0, articles: [], failed: [] };
let refreshing = null;
let timer = null;

function refresh() {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const results = await runLimited(FEEDS, 6, fetchFeed);
    const all = [];
    const failed = [];
    const stale = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        all.push(...r.value.articles);
        if (r.value.stale) stale.push(FEEDS[i].name);
      } else {
        failed.push(FEEDS[i].name);
      }
    });

    const seen = new Set();
    const articles = all
      .filter(a => (seen.has(a.id) ? false : seen.add(a.id)))
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    cache = { at: Date.now(), articles, failed };
    console.log(
      `Loaded ${articles.length} news items. ` +
      `Failed: ${failed.join(', ') || 'none'}. ` +
      `Using saved copy: ${stale.join(', ') || 'none'}`
    );

    try {
      fs.writeFileSync(CACHE_FILE, JSON.stringify(lastGood));
    } catch (e) {
      console.log('Could not save cache file:', e.message);
    }
  })()
    .catch(e => console.error('Refresh error:', e))
    .finally(() => {
      refreshing = null;
      clearTimeout(timer);
      timer = setTimeout(refresh, cache.articles.length ? TTL : RETRY);
    });
  return refreshing;
}

// ---------- Reels pool (keeps growing with fresh videos) ----------
const REELS_EVERY = 10 * 60 * 1000;  // add fresh reels every 10 minutes
const TOPICS_EACH_TIME = 4;          // 4 topics per round stays well inside free limits
const POOL_MAX = 1500;               // keep the newest 1500 reels

let reels = { at: 0, items: [], failed: [] };
let reelsRefreshing = null;
let reelsTimer = null;
let topicTurn = 0;

function refreshReels() {
  if (reelsRefreshing) return reelsRefreshing;
  reelsRefreshing = (async () => {
    if (!PIXABAY_API_KEY && !PEXELS_API_KEY) {
      console.log('No PIXABAY_API_KEY set on Render, so Reels are empty');
      return;
    }
    // First time: all topics. After that: a few topics each round, taking turns.
    let topics;
    if (!reels.items.length) topics = REEL_TOPICS;
    else {
      topics = [];
      for (let k = 0; k < TOPICS_EACH_TIME; k++) {
        topics.push(REEL_TOPICS[topicTurn % REEL_TOPICS.length]);
        topicTurn++;
      }
    }

    const results = await runLimited(topics, 4, fetchReelsTopic);
    const fresh = [];
    const failed = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') fresh.push(...r.value);
      else {
        failed.push(topics[i][0]);
        console.log(`  x reels "${topics[i][0]}": ${r.reason.message}`);
      }
    });

    // New reels go first, old copies are removed, pool is capped
    const seen = new Set();
    const items = [...fresh, ...reels.items]
      .filter(a => (seen.has(a.id) ? false : seen.add(a.id)))
      .slice(0, POOL_MAX);
    if (items.length) reels = { at: Date.now(), items, failed };
    console.log(`Reels: +${fresh.length} new, ${items.length} in pool. Failed: ${failed.join(', ') || 'none'}`);
  })()
    .catch(e => console.error('Reels refresh error:', e))
    .finally(() => {
      reelsRefreshing = null;
      clearTimeout(reelsTimer);
      reelsTimer = setTimeout(refreshReels, reels.items.length ? REELS_EVERY : RETRY);
    });
  return reelsRefreshing;
}

// "en,hi" -> ['en', 'hi']
const parts = v => String(v).toLowerCase().split(',').map(s => s.trim()).filter(Boolean);

function applyFilters(list, q) {
  const { country, language, category } = q;
  if (country) {
    const set = parts(country);
    list = list.filter(a => a.country === 'World' || set.includes(String(a.country).toLowerCase()));
  }
  if (language) {
    const set = parts(language);
    list = list.filter(a => a.language === 'any' || set.includes(String(a.language).toLowerCase()));
  }
  if (category) {
    const set = parts(category);
    list = list.filter(a => set.includes(String(a.category).toLowerCase()));
  }
  return list;
}

app.get('/api/news', async (req, res) => {
  try {
    const { video, shorts, stories, limit } = req.query;
    const max = Number(limit) || 300;

    // Reels
    if (shorts) {
      if (!reels.items.length) await refreshReels();
      // Newest 60 first (mixed), then the rest of the pool in random order,
      // so every visit shows a different set
      // Tall (phone-shaped) videos come first, wide ones after
      const list = applyFilters(reels.items, req.query);
      const tall = list.filter(a => a.vertical !== false);
      const wide = list.filter(a => a.vertical === false);
      const mix = l => [...shuffle(l.slice(0, 60)), ...shuffle(l.slice(60))];
      const mixed = [...mix(tall), ...mix(wide)];
      return res.json({
        articles: mixed.slice(0, max),
        updatedAt: new Date(reels.at).toISOString(),
        feedsFailed: reels.failed,
      });
    }

    // News
    if (!cache.articles.length) await refresh();
    else if (Date.now() - cache.at > TTL) refresh();

    let list = applyFilters(cache.articles, req.query);
    if (video) list = list.filter(a => !!a.videoUrl);
    if (stories) list = list.filter(a => !a.videoUrl);

    res.json({
      articles: list.slice(0, max),
      updatedAt: new Date(cache.at).toISOString(),
      feedsFailed: cache.failed,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not load news' });
  }
});

app.get('/', (req, res) => res.send('CIVIX server is running'));

refresh();
refreshReels();
app.listen(process.env.PORT || 4000, '0.0.0.0', () => console.log('CIVIX server running'));
