const express = require('express');
const cors = require('cors');
const Parser = require('rss-parser');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Optional free YouTube Data API key (set it on Render as YT_API_KEY, not here)
const YT_API_KEY = process.env.YT_API_KEY || '';

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
      ['media:group', 'mediaGroup'],
      ['yt:videoId', 'ytVideoId'],
    ],
  },
});

// name, url, language, country, category
const f = (name, url, language, country, category = 'World') =>
  ({ name, url, language, country, category });

// YouTube Shorts of a channel (vertical videos for Reels)
const ytShort = (name, channelId, language, country) => ({
  name: `${name} Shorts`,
  url: `https://www.youtube.com/feeds/videos.xml?playlist_id=UUSH${channelId.slice(2)}`,
  playlistId: `UUSH${channelId.slice(2)}`,
  language, country, category: 'World', youtube: true, short: true,
});

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
  f('ESPN', 'https://www.espn.com/espn/rss/news', 'en', 'United States', 'Sports'),
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

  // ---------- Reels: YouTube Shorts ----------
  ytShort('BBC News', 'UCCj956IF62FbT7Gouszaj9w', 'en', 'World'),
  ytShort('Al Jazeera English', 'UCNye-wNBqNL5ZzHSJj3l8Bg', 'en', 'Qatar'),
  ytShort('DW News', 'UCknLrEdhRCp1aegoMqRaCZg', 'en', 'Germany'),
  ytShort('France 24 English', 'UCQfwfsi5VrQ8yKZ-UWmAEFg', 'en', 'France'),
  ytShort('Sky News', 'UCoMdktPbSTixAyNGwb-UYkQ', 'en', 'United Kingdom'),
  ytShort('euronews', 'UCSrZ3UV4jOidv8ppoVuvW9Q', 'en', 'World'),
  ytShort('WION', 'UC_gUM8rL-Lrg6O3adPW9K1g', 'en', 'India'),
  ytShort('NDTV', 'UCZFMm1mMw0F81Z37aaEzTUA', 'en', 'India'),
  ytShort('India Today', 'UCYPvAwZP8pZhSMW8qs7cVCw', 'en', 'India'),
  ytShort('Aaj Tak', 'UCt4t-jeY85JegMlZ-E5UWtA', 'hi', 'India'),
  ytShort('ABP News', 'UCRWFSbif-RFENbBrSiez1DA', 'hi', 'India'),
  ytShort('TRT World', 'UC7fWeaHhqgM4Ry-RMpZKQEA', 'en', 'World'),
  ytShort('Al Jazeera Arabic', 'UCfiwzLy-8yKzIbsmZTzxDgw', 'ar', 'Qatar'),
  ytShort('Dhruv Rathee', 'UC-CSyyi47VX1lD9zyeABW3w', 'hi', 'India'),
];

const TTL = 10 * 60 * 1000;
const RETRY = 3 * 60 * 1000;
const MAX_PER_FEED = 15;
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

  if (feed.youtube) {
    const id = item.ytVideoId || String(item.id || '').replace('yt:video:', '');
    if (!id) return null;
    article.id = md5('yt:' + id);
    article.videoUrl = `https://www.youtube.com/embed/${id}`;
    article.videoType = 'youtube';
    article.isShort = !!feed.short;
    article.imageUrl = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    const desc = item.mediaGroup && item.mediaGroup['media:description'];
    if (desc && desc[0]) article.description = stripHtml(desc[0]).slice(0, 300);
  } else if (video) {
    article.videoUrl = video;
    article.videoType = 'file';
  }
  return article.title ? article : null;
}

// ---- Keep only YouTube videos that are allowed to play inside other apps ----
const embedCache = new Map();

async function canEmbed(videoId) {
  if (embedCache.has(videoId)) return embedCache.get(videoId);
  try {
    const res = await fetch(
      'https://www.youtube.com/oembed?format=json&url=' +
      encodeURIComponent('https://www.youtube.com/watch?v=' + videoId)
    );
    if (res.status === 200) {
      embedCache.set(videoId, true);
      return true;
    }
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      embedCache.set(videoId, false);
      return false;
    }
    return true;
  } catch (e) {
    return true;
  }
}

async function filterEmbeddable(articles) {
  const checks = await runLimited(articles, 8, a =>
    canEmbed(String(a.videoUrl).split('/embed/')[1])
  );
  return articles.filter((a, i) => (checks[i].status === 'fulfilled' ? checks[i].value : true));
}

async function fetchYoutubeApi(feed) {
  const url =
    'https://www.googleapis.com/youtube/v3/playlistItems?part=snippet' +
    `&maxResults=${MAX_PER_FEED}&playlistId=${feed.playlistId}&key=${YT_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube API status ${res.status}`);
  const data = await res.json();
  return (data.items || [])
    .map(it => {
      const s = it.snippet || {};
      const id = s.resourceId && s.resourceId.videoId;
      if (!id || s.title === 'Private video' || s.title === 'Deleted video') return null;
      return {
        id: md5('yt:' + id),
        title: stripHtml(s.title),
        description: stripHtml(s.description).slice(0, 300),
        link: `https://www.youtube.com/watch?v=${id}`,
        publishedAt: new Date(s.publishedAt).toISOString(),
        source: feed.name,
        language: feed.language,
        country: feed.country,
        category: feed.category,
        imageUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        videoUrl: `https://www.youtube.com/embed/${id}`,
        videoType: 'youtube',
        isShort: !!feed.short,
      };
    })
    .filter(Boolean);
}

async function fetchFeed(feed) {
  let lastError;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const data = await parser.parseURL(feed.url);
      let articles = (data.items || [])
        .slice(0, MAX_PER_FEED)
        .map(item => toArticle(feed, item))
        .filter(Boolean);
      if (feed.youtube) articles = await filterEmbeddable(articles);
      if (!articles.length) throw new Error('feed was empty');
      lastGood[feed.url] = articles;
      return { articles, stale: false };
    } catch (e) {
      lastError = e;
      await sleep(800);
    }
  }

  if (feed.youtube && YT_API_KEY) {
    try {
      const articles = await filterEmbeddable(await fetchYoutubeApi(feed));
      if (articles.length) {
        lastGood[feed.url] = articles;
        return { articles, stale: false };
      }
    } catch (e) {
      lastError = e;
    }
  }

  console.log(`  x ${feed.name}: ${lastError.message}`);
  if (lastGood[feed.url]) return { articles: lastGood[feed.url], stale: true };
  throw lastError;
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
    const shorts = articles.filter(a => a.isShort).length;
    console.log(
      `Loaded ${articles.length} items (${shorts} shorts). ` +
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
      const shorts = cache.articles.filter(a => a.isShort).length;
      timer = setTimeout(refresh, shorts === 0 ? RETRY : TTL);
    });
  return refreshing;
}

// "en,hi" -> ['en', 'hi']
const parts = v => String(v).toLowerCase().split(',').map(s => s.trim()).filter(Boolean);

app.get('/api/news', async (req, res) => {
  try {
    if (!cache.articles.length) await refresh();
    else if (Date.now() - cache.at > TTL) refresh();

    const { country, language, category, video, shorts, stories, limit } = req.query;
    let list = cache.articles;
    if (country) {
      const set = parts(country);
      list = list.filter(a => set.includes(String(a.country).toLowerCase()));
    }
    if (language) {
      const set = parts(language);
      list = list.filter(a => set.includes(String(a.language).toLowerCase()));
    }
    if (category) {
      const set = parts(category);
      list = list.filter(a => set.includes(String(a.category).toLowerCase()));
    }
    if (video) list = list.filter(a => !!a.videoUrl);
    if (shorts) list = list.filter(a => a.isShort);
    if (stories) list = list.filter(a => !a.videoUrl);

    res.json({
      articles: list.slice(0, Number(limit) || 300),
      updatedAt: new Date(cache.at).toISOString(),
      feedsFailed: cache.failed,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not load news' });
  }
});

app.get('/', (req, res) => res.send('CIVIX news server is running'));

refresh();
app.listen(process.env.PORT || 4000, '0.0.0.0', () => console.log('CIVIX server running'));
