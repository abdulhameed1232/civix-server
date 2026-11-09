const express = require('express');
const cors = require('cors');
const Parser = require('rss-parser');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Free video keys for Reels (set them on Render, never here).
// Pixabay is used first; Pexels is used too if you ever get a key.
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY || '';
// Free YouTube Data API key for news Shorts (set it on Render as YT_API_KEY)
const YT_API_KEY = process.env.YT_API_KEY || '';
const PEXELS_API_KEY = process.env.PEXELS_API_KEY || '';

// Voice calls (LiveKit). Set these 3 on Render. The secret must never be in the app.
const LIVEKIT_URL = process.env.LIVEKIT_URL || '';
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || '';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || '';
// Supabase project (public values, same as in the app) to check who is calling
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qwrgbgobzvzitzmlrpip.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_dgi4izBtp0AqX_D7-zYa3Q_lhXtFgfs';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10kb' }));

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

// ---------- Reels: YouTube Shorts from news and other channels (need YT_API_KEY) ----------
// name, channel id, language, country, topic
const YT_CHANNELS = [
  ['BBC News', 'UC16niRr50-MSBwiO3YDb3RA', 'en', 'United Kingdom', 'World'],
  ['Al Jazeera English', 'UCNye-wNBqNL5ZzHSJj3l8Bg', 'en', 'Qatar', 'World'],
  ['DW News', 'UCknLrEdhRCp1aegoMqRaCZg', 'en', 'Germany', 'World'],
  ['France 24 English', 'UCQfwfsi5VrQ8yKZ-UWmAEFg', 'en', 'France', 'World'],
  ['Sky News', 'UCoMdktPbSTixAyNGwb-UYkQ', 'en', 'United Kingdom', 'World'],
  ['euronews', 'UCSrZ3UV4jOidv8ppoVuvW9Q', 'en', 'World', 'World'],
  ['WION', 'UC_gUM8rL-Lrg6O3adPW9K1g', 'en', 'India', 'World'],
  ['NDTV', 'UCZFMm1mMw0F81Z37aaEzTUA', 'en', 'India', 'World'],
  ['India Today', 'UCYPvAwZP8pZhSMW8qs7cVCw', 'en', 'India', 'World'],
  ['Aaj Tak', 'UCt4t-jeY85JegMlZ-E5UWtA', 'hi', 'India', 'World'],
  ['ABP News', 'UCRWFSbif-RFENbBrSiez1DA', 'hi', 'India', 'World'],
  ['Dhruv Rathee', 'UC-CSyyi47VX1lD9zyeABW3w', 'hi', 'India', 'Education'],
  ['Al Jazeera Arabic', 'UCfiwzLy-8yKzIbsmZTzxDgw', 'ar', 'Qatar', 'World'],
  ['ESPN', 'UCiWLfSweyRNmLpgEHekhoAg', 'en', 'United States', 'Sports'],
  ['NASA', 'UCLA_DiR1FfKNvjuUpBHmylQ', 'en', 'United States', 'Science'],
  ['National Geographic', 'UCpVm7bg6pXKo1Pr6k5kxG9A', 'en', 'World', 'Nature'],
];
const YT_EVERY = 60 * 60 * 1000; // check channels for new Shorts every hour

// ---------- Reels: popular creators (not news). Each costs only 2 units, checked every 3 hours ----------
const CREATOR_CHANNELS = [
  ['MrBeast', 'UCX6OQ3DkcsbYNE6H8uQQuVA', 'en', 'World', 'Entertainment'],
  ['Dude Perfect', 'UCRijo3ddMTht_IHyNSNXpNQ', 'en', 'United States', 'Sports'],
  ['Zach King', 'UCq8DICunczvLuJJq414110A', 'en', 'World', 'Entertainment'],
  ['Mark Rober', 'UCY1kMZp36IQSyNx_9h4mpCg', 'en', 'United States', 'Science'],
  ['Marques Brownlee', 'UCBJycsmduvYEL83R_U4JriQ', 'en', 'United States', 'Technology'],
  ['Veritasium', 'UCHnyfMqiRRG1u-2MsSQLbXA', 'en', 'World', 'Science'],
  ['Kurzgesagt', 'UCsXVk37bltHxD1rDPwtNM8Q', 'en', 'World', 'Education'],
  ['Gordon Ramsay', 'UCIEv3lZ_tNXHzL3ox-_uUGQ', 'en', 'World', 'Food'],
  ['Tasty', 'UCJFp8uSYCjXOMnkUyb3CQ3Q', 'en', 'World', 'Food'],
  ['5-Minute Crafts', 'UC295-Dw_tDNtZXFeAPAW6Aw', 'en', 'World', 'Art'],
  ['Nas Daily', 'UCJsUvAqDzczYv2UpFmu4PcA', 'en', 'World', 'Travel'],
  ['BBC Earth', 'UCwmZiChSryoWQCZMIQezgTg', 'en', 'World', 'Nature'],
  ['IGN', 'UCKy1dAqELo0zrOtPkf0eTMw', 'en', 'United States', 'Gaming'],
  ['NBA', 'UCWJ2lWNubArHWmf3FIHbfcQ', 'en', 'United States', 'Sports'],
  ['FIFA', 'UCpcTrCXblq78GZrTUTLWeBw', 'en', 'World', 'Sports'],
  ['ICC', 'UCt2JXOLNxqry7B_4rRZME3Q', 'en', 'World', 'Sports'],
  ['T-Series', 'UCq-Fj5jknLsUf-MWSy4_brA', 'hi', 'India', 'Music'],
  ['CarryMinati', 'UCj22tfcQrWG7EMEKS0qLeEg', 'hi', 'India', 'Entertainment'],
  ['BB Ki Vines', 'UCqwUrj10mAEsqezcItqvwEw', 'hi', 'India', 'Entertainment'],
  ['Technical Guruji', 'UCOhHO2ICt0ti9KAh-QHvttQ', 'hi', 'India', 'Technology'],
];
const CREATORS_EVERY = 3 * 60 * 60 * 1000;

// ---------- Reels: popular Shorts from ALL creators, found by topic search ----------
// search words, app topic, language, country code
// safeSearch=strict keeps adult content out. Each search costs 100 of the free 10,000 daily
// YouTube units, so these run every 12 hours, and each language once a day.
const YT_SEARCHES = [
  ['football cricket sports highlights', 'Sports', 'en', 'IN'],
  ['gaming', 'Gaming', 'en', 'US'],
  ['tech gadgets', 'Technology', 'en', 'US'],
  ['science facts', 'Science', 'en', 'US'],
  ['space astronomy', 'Science', 'en', 'US'],
  ['music cover singing', 'Music', 'en', 'IN'],
  ['dance', 'Music', 'en', 'IN'],
  ['comedy funny', 'Entertainment', 'en', 'IN'],
  ['movie trailer bollywood hollywood', 'Movies', 'en', 'IN'],
  ['travel vlog', 'Travel', 'en', 'IN'],
  ['street food recipe', 'Food', 'en', 'IN'],
  ['fashion outfit', 'Fashion', 'en', 'IN'],
  ['art drawing painting', 'Art', 'en', 'US'],
  ['photography tips', 'Photography', 'en', 'US'],
  ['animals wildlife nature', 'Nature', 'en', 'US'],
  ['study tips learn english', 'Education', 'en', 'IN'],
  ['business startup motivation', 'Business', 'en', 'IN'],
];

// ---------- Creator Shorts in every language (fetched only when someone picks that language) ----------
// language code: [country code, entertainment search, music search, food search]
const LANG_SEARCHES = {
  hi: ['IN', 'हिंदी कॉमेडी', 'हिंदी गाने', 'खाना रेसिपी'],
  te: ['IN', 'తెలుగు comedy', 'తెలుగు songs', 'తెలుగు వంటలు'],
  ta: ['IN', 'தமிழ் comedy', 'தமிழ் பாடல்', 'தமிழ் சமையல்'],
  bn: ['BD', 'বাংলা ফানি', 'বাংলা গান', 'বাংলা রান্না'],
  mr: ['IN', 'मराठी कॉमेडी', 'मराठी गाणी', 'मराठी रेसिपी'],
  ur: ['PK', 'اردو مزاحیہ', 'اردو گانے', 'پاکستانی کھانا'],
  ar: ['AE', 'مضحك', 'اغاني', 'طبخ'],
  es: ['MX', 'humor', 'música', 'recetas'],
  fr: ['FR', 'humour', 'musique', 'recette'],
  de: ['DE', 'lustig', 'musik', 'rezept'],
  pt: ['BR', 'engraçado', 'música', 'receita'],
  ru: ['RU', 'смешно', 'музыка', 'рецепт'],
  zh: ['TW', '搞笑', '音乐', '美食'],
  ja: ['JP', '面白い', '音楽', '料理'],
  id: ['ID', 'lucu', 'musik', 'resep'],
  tr: ['TR', 'komik', 'müzik', 'tarif'],
  sw: ['KE', 'vichekesho', 'muziki', 'mapishi'],
  fa: ['', 'خنده دار', 'موسیقی', 'آشپزی'],
};
const LANG_CATEGORIES = ['Entertainment', 'Music', 'Food'];
const LANG_EVERY = 24 * 60 * 60 * 1000; // each language refreshes once a day
const YT_CACHE_FILE = path.join(__dirname, 'yt-cache.json');
const YT_SEARCH_EVERY = 12 * 60 * 60 * 1000;


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
  mp4.sort((a, b) => Math.abs(a.height - 960) - Math.abs(b.height - 960));
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
        kind: 'stock',
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
  // ~720p: sharp on phones, but small enough to start fast (less lag)
  files.sort((a, b) => Math.abs(Math.max(a.width, a.height) - 960) - Math.abs(Math.max(b.width, b.height) - 960));
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
        kind: 'stock',
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

// ---------- YouTube Shorts reels ----------
async function ytGet(pathAndQuery) {
  const res = await fetch(`https://www.googleapis.com/youtube/v3/${pathAndQuery}&key=${YT_API_KEY}`);
  if (!res.ok) throw new Error(`YouTube API status ${res.status}`);
  return res.json();
}

// "PT1M5S" -> 65
function isoSeconds(iso) {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || '');
  if (!m) return 0;
  return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
}

// Turn a list of { id, title, publishedAt, channel } into reels.
// Keeps only public videos that other apps may play, up to 3 minutes long.
async function toYoutubeReels(items, info) {
  if (!items.length) return [];
  const ids = items.map(x => x.id);
  const ok = new Map();
  for (let i = 0; i < ids.length; i += 50) {
    const data = await ytGet(`videos?part=status,contentDetails&id=${ids.slice(i, i + 50).join(',')}`);
    for (const v of data.items || []) {
      const secs = isoSeconds(v.contentDetails && v.contentDetails.duration);
      const st = v.status || {};
      if (st.embeddable && st.privacyStatus === 'public' && !st.madeForKids && secs > 0 && secs <= 180) {
        ok.set(v.id, secs);
      }
    }
  }
  return items
    .filter(x => ok.has(x.id))
    .map(x => ({
      id: md5('yt:' + x.id),
      title: stripHtml(x.title),
      description: x.channel,
      author: x.channel,
      link: `https://www.youtube.com/shorts/${x.id}`,
      publishedAt: new Date(x.publishedAt || Date.now()).toISOString(),
      source: x.channel,
      language: info.language,
      country: info.country,
      category: info.category,
      imageUrl: `https://i.ytimg.com/vi/${x.id}/hqdefault.jpg`,
      videoUrl: `https://www.youtube.com/embed/${x.id}`,
      videoType: 'youtube',
      isShort: true,
      vertical: true,
      duration: ok.get(x.id),
      channelId: x.channelId,
      kind: info.kind || 'creator', // 'news' or 'creator'
    }));
}

// ============================================================
// Famous creators (tech, vlogs, comedy, gaming, food, fitness, education…)
// Only the @handle is needed: the server finds the channel by itself (no YouTube quota used).
// [name, @handle, language, country, topic, extra search words]
// ============================================================
const FAMOUS_CREATORS = [
  // India: vlogs, comedy, tech, education
  ['Sourav Joshi Vlogs', 'souravjoshivlogs7028', 'hi', 'India', 'Travel', 'sourav joshi soro joshi vlog'],
  ['Flying Beast', 'flyingbeast320', 'hi', 'India', 'Travel', 'gaurav taneja'],
  ['Dhruv Rathee', 'dhruvrathee', 'hi', 'India', 'Education', 'dhruv'],
  ['Ashish Chanchlani Vines', 'ashishchanchlanivines', 'hi', 'India', 'Entertainment', 'ashish chanchlani'],
  ['Triggered Insaan', 'triggeredinsaan', 'hi', 'India', 'Entertainment', 'nischay malhan'],
  ['Fukra Insaan', 'fukrainsaan', 'hi', 'India', 'Entertainment', 'abhishek malhan'],
  ['Elvish Yadav Vlogs', 'elvishyadavvlogs', 'hi', 'India', 'Entertainment', 'elvish'],
  ['Tech Burner', 'techburner', 'hi', 'India', 'Technology', 'shlok'],
  ['Trakin Tech', 'trakintech', 'hi', 'India', 'Technology', 'arun prabhudesai'],
  ['Beebom', 'beebomco', 'en', 'India', 'Technology', ''],
  ['Mumbiker Nikhil', 'mumbikernikhil', 'hi', 'India', 'Travel', 'nikhil sharma'],
  ['Harsh Beniwal', 'harshbeniwal', 'hi', 'India', 'Entertainment', ''],
  ['Round2hell', 'round2hell', 'hi', 'India', 'Entertainment', 'r2h'],
  ['Amit Bhadana', 'amitbhadana', 'hi', 'India', 'Entertainment', ''],
  ['BeerBiceps', 'beerbiceps', 'hi', 'India', 'Education', 'ranveer allahbadia trs'],
  ['Samay Raina', 'samayrainaofficial', 'hi', 'India', 'Entertainment', 'samay'],
  ['Ankur Warikoo', 'warikoo', 'en', 'India', 'Business', 'warikoo'],
  ['Raj Shamani', 'rajshamani', 'hi', 'India', 'Business', 'figuring out'],
  ['Physics Wallah', 'physicswallah', 'hi', 'India', 'Education', 'alakh pandey pw'],
  ['Techno Gamerz', 'technogamerzofficial', 'hi', 'India', 'Gaming', 'ujjwal'],
  ['Total Gaming', 'totalgaming093', 'hi', 'India', 'Gaming', 'ajjubhai'],
  ['MYTHPAT', 'mythpat', 'hi', 'India', 'Gaming', 'mithilesh'],
  ['Mostly Sane', 'mostlysane', 'hi', 'India', 'Entertainment', 'prajakta koli'],
  ['Ranveer Brar', 'ranveerbrar', 'hi', 'India', 'Food', 'chef'],
  ['Kabita\'s Kitchen', 'kabitaskitchen', 'hi', 'India', 'Food', 'kabita'],
  ['Tanmay Bhat', 'tanmaybhat', 'hi', 'India', 'Entertainment', ''],
  ['Nitish Rajput', 'nitishrajput', 'hi', 'India', 'Education', ''],
  ['Mr. Indian Hacker', 'mrindianhacker', 'hi', 'India', 'Science', 'dilraj'],
  ['Crazy XYZ', 'crazyxyz', 'hi', 'India', 'Science', 'amit sharma'],
  ['Sandeep Maheshwari', 'sandeepmaheshwari', 'hi', 'India', 'Education', 'motivation'],
  ['Abhi and Niyu', 'abhiandniyu', 'en', 'India', 'Education', ''],
  ['Thugesh', 'thugesh', 'hi', 'India', 'Entertainment', ''],
  ['Slayy Point', 'slayypoint', 'hi', 'India', 'Entertainment', ''],
  ['Gaurav Chaudhary', 'technicalguruji', 'hi', 'India', 'Technology', 'technical guruji'],
  ['Satish Kushwaha', 'satishkushwaha', 'hi', 'India', 'Technology', ''],
  ['Khan GS Research Centre', 'khangsresearchcentre', 'hi', 'India', 'Education', 'khan sir'],
  ['Virat Kohli', 'viratkohli', 'en', 'India', 'Sports', 'kohli cricket'],
  ['Bhuvan Bam', 'bhuvanbam22', 'hi', 'India', 'Entertainment', 'bb ki vines titu mama'],
  // World: tech, vlogs, challenges, comedy, food, sport
  ['Linus Tech Tips', 'linustechtips', 'en', 'Canada', 'Technology', 'ltt linus'],
  ['Unbox Therapy', 'unboxtherapy', 'en', 'Canada', 'Technology', 'lew'],
  ['Mrwhosetheboss', 'mrwhosetheboss', 'en', 'United Kingdom', 'Technology', 'arun maini'],
  ['iJustine', 'ijustine', 'en', 'United States', 'Technology', 'justine'],
  ['Casey Neistat', 'casey', 'en', 'United States', 'Travel', 'casey'],
  ['Yes Theory', 'yestheory', 'en', 'World', 'Travel', ''],
  ['Drew Binsky', 'drewbinsky', 'en', 'World', 'Travel', ''],
  ['Kara and Nate', 'karaandnate', 'en', 'World', 'Travel', ''],
  ['Ryan Trahan', 'ryan', 'en', 'United States', 'Entertainment', ''],
  ['Airrack', 'airrack', 'en', 'United States', 'Entertainment', ''],
  ['Logan Paul', 'loganpaul', 'en', 'United States', 'Entertainment', ''],
  ['KSI', 'ksi', 'en', 'United Kingdom', 'Entertainment', 'sidemen'],
  ['Sidemen', 'sidemen', 'en', 'United Kingdom', 'Entertainment', ''],
  ['IShowSpeed', 'ishowspeed', 'en', 'United States', 'Entertainment', 'speed'],
  ['Markiplier', 'markiplier', 'en', 'United States', 'Gaming', ''],
  ['PewDiePie', 'pewdiepie', 'en', 'World', 'Gaming', 'felix'],
  ['Khaby Lame', 'khabylame', 'en', 'World', 'Entertainment', 'khaby'],
  ['Brent Rivera', 'brentrivera', 'en', 'United States', 'Entertainment', ''],
  ['Emma Chamberlain', 'emmachamberlain', 'en', 'United States', 'Fashion', ''],
  ['Johnny Harris', 'johnnyharris', 'en', 'United States', 'Education', ''],
  ['Ali Abdaal', 'aliabdaal', 'en', 'United Kingdom', 'Education', 'productivity'],
  ['Peter McKinnon', 'petermckinnon', 'en', 'Canada', 'Photography', ''],
  ['Nick DiGiovanni', 'nickdigiovanni', 'en', 'United States', 'Food', ''],
  ['Joshua Weissman', 'joshuaweissman', 'en', 'United States', 'Food', ''],
  ['Babish Culinary Universe', 'babishculinaryuniverse', 'en', 'United States', 'Food', 'babish'],
  ['Cristiano Ronaldo', 'cristiano', 'en', 'World', 'Sports', 'ronaldo cr7 ur cristiano'],
  ['Chris Heria', 'chrisheria', 'en', 'United States', 'Sports', 'fitness calisthenics'],
  ['TED', 'ted', 'en', 'World', 'Education', 'ted talks'],
  ['National Geographic', 'natgeo', 'en', 'World', 'Nature', 'nat geo'],
  ['NASA', 'nasa', 'en', 'United States', 'Science', 'space'],
  ['WIRED', 'wired', 'en', 'United States', 'Technology', ''],
  ['The Tonight Show', 'fallontonight', 'en', 'United States', 'Entertainment', 'jimmy fallon'],
  ['Mr Bean', 'mrbean', 'en', 'United Kingdom', 'Entertainment', 'bean cartoon'],
  // Cartoons and anime (official channels)
  ['Cartoon Network India', 'cartoonnetworkindia', 'hi', 'India', 'Entertainment', 'cartoon cn ben 10 kids'],
  ['Cartoon Network', 'cartoonnetwork', 'en', 'World', 'Entertainment', 'cartoon cn kids'],
  ['Ben 10', 'ben10', 'en', 'World', 'Entertainment', 'cartoon ben ten'],
  ['Sony YAY!', 'sonyyay', 'hi', 'India', 'Entertainment', 'cartoon kids obocchama'],
  ['Pogo', 'pogochannel', 'hi', 'India', 'Entertainment', 'cartoon kids'],
  ['Chhota Bheem', 'chhotabheem', 'hi', 'India', 'Entertainment', 'cartoon bheem kids green gold'],
  ['Nickelodeon India', 'nickindia', 'hi', 'India', 'Entertainment', 'cartoon motu patlu shiva kids'],
  ['Disney Channel India', 'disneychannelindia', 'hi', 'India', 'Entertainment', 'cartoon doraemon shinchan kids'],
  ['Doraemon', 'doraemon', 'hi', 'World', 'Entertainment', 'cartoon anime doremon nobita'],
  ['Crayon Shin-chan', 'crayonshinchanofficial', 'hi', 'World', 'Entertainment', 'cartoon anime shinchan chin chan shin chan'],
  ['Pokémon', 'pokemon', 'en', 'World', 'Entertainment', 'cartoon anime pokemon pikachu'],
  ['Crunchyroll', 'crunchyroll', 'en', 'World', 'Entertainment', 'anime naruto one piece demon slayer'],
  ['Netflix Anime', 'netflixanime', 'en', 'World', 'Entertainment', 'anime'],
  ['Toei Animation', 'toeianimation', 'en', 'World', 'Entertainment', 'anime dragon ball one piece'],
  ['WB Kids', 'wbkids', 'en', 'World', 'Entertainment', 'cartoon tom and jerry looney tunes scooby'],
  ['Tom and Jerry', 'tomandjerry', 'en', 'World', 'Entertainment', 'cartoon tom jerry'],
  ['SpongeBob SquarePants', 'spongebob', 'en', 'World', 'Entertainment', 'cartoon spongebob'],
  ['Nickelodeon', 'nickelodeon', 'en', 'World', 'Entertainment', 'cartoon kids'],
  ['Disney Channel', 'disneychannel', 'en', 'World', 'Entertainment', 'cartoon kids'],
  ['Peppa Pig', 'peppapig', 'en', 'World', 'Entertainment', 'cartoon kids'],
  ['Mr Bean Cartoon', 'mrbeancartoonworld', 'en', 'World', 'Entertainment', 'cartoon bean'],
];

const FAMOUS_FILE = path.join(__dirname, 'famous-cache.json');
let famous = {}; // handle -> { channelId, avatar, at }
try { famous = JSON.parse(fs.readFileSync(FAMOUS_FILE, 'utf8')) || {}; } catch (e) { }

// Find a channel from its @handle by reading the public channel page (no API quota)
async function resolveHandle(handle) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 15000);
  try {
    const r = await fetch(`https://www.youtube.com/@${handle}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36', 'Accept-Language': 'en' },
      signal: controller.signal,
    });
    if (!r.ok) throw new Error(`status ${r.status}`);
    const html = await r.text();
    const m = /"externalId":"(UC[\w-]{22})"/.exec(html) || /channel_id=(UC[\w-]{22})/.exec(html) || /"channelId":"(UC[\w-]{22})"/.exec(html);
    if (!m) throw new Error('channel not found');
    const img = /<meta property="og:image" content="([^"]+)"/.exec(html);
    return { channelId: m[1], avatar: img ? img[1] : undefined, at: Date.now() };
  } finally {
    clearTimeout(t);
  }
}

async function resolveFamous() {
  const todo = FAMOUS_CREATORS.filter(([, h]) => !famous[h] || (!famous[h].channelId && Date.now() - famous[h].at > 24 * 3600 * 1000));
  if (!todo.length) return;
  let ok = 0;
  const failed = [];
  await runLimited(todo, 3, async ([name, h]) => {
    try {
      famous[h] = await resolveHandle(h);
      if (famous[h].avatar) channelAvatars[famous[h].channelId] = famous[h].avatar;
      ok++;
    } catch (e) {
      famous[h] = { channelId: '', at: Date.now() };
      failed.push(name);
    }
  });
  try { fs.writeFileSync(FAMOUS_FILE, JSON.stringify(famous)); } catch (e) { }
  console.log(`Famous creators: ${ok} found. Not found: ${failed.join(', ') || 'none'}`);
}

// In the same shape as CREATOR_CHANNELS
function famousChannels() {
  const have = new Set(CREATOR_CHANNELS.map(c => c[1]));
  return FAMOUS_CREATORS
    .filter(([, h]) => famous[h] && famous[h].channelId && !have.has(famous[h].channelId))
    .map(([name, h, lang, country, category]) => [name, famous[h].channelId, lang, country, category]);
}

// Shorts from a channel's free public feed (no API quota). Falls back to the API.
async function rssShorts(name, channelId) {
  const feed = await parser.parseURL(`https://www.youtube.com/feeds/videos.xml?playlist_id=UUSH${channelId.slice(2)}`);
  return (feed.items || [])
    .map(it => {
      const id = String(it.id || '').replace('yt:video:', '') || ((/[?&]v=([\w-]{11})/.exec(it.link || '') || [])[1]);
      return id && /^[\w-]{11}$/.test(id) ? { id, title: it.title || name, publishedAt: it.isoDate || it.pubDate, channel: name, channelId } : null;
    })
    .filter(Boolean)
    .slice(0, 15);
}

// Shorts from the public feed are already short, so they skip the (paid) check
function rssToReels(items, info) {
  return items.map(x => ({
    id: md5('yt:' + x.id),
    title: stripHtml(x.title),
    description: x.channel,
    author: x.channel,
    link: `https://www.youtube.com/shorts/${x.id}`,
    publishedAt: new Date(x.publishedAt || Date.now()).toISOString(),
    source: x.channel,
    language: info.language,
    country: info.country,
    category: info.category,
    imageUrl: `https://i.ytimg.com/vi/${x.id}/hqdefault.jpg`,
    videoUrl: `https://www.youtube.com/embed/${x.id}`,
    videoType: 'youtube',
    isShort: true,
    vertical: true,
    channelId: x.channelId,
    kind: info.kind || 'creator',
  }));
}

async function fetchChannelShorts([name, channelId, language, country, category]) {
  const info = { language, country, category, kind: category === 'World' ? 'news' : 'creator' };
  // 1) the free public feed (saves the daily YouTube quota)
  try {
    const items = await rssShorts(name, channelId);
    if (items.length) return rssToReels(items, info);
  } catch (e) { }
  // 2) the YouTube API
  const playlistId = 'UUSH' + channelId.slice(2); // the channel's Shorts list
  const list = await ytGet(`playlistItems?part=snippet&maxResults=20&playlistId=${playlistId}`);
  const items = (list.items || [])
    .map(it => it.snippet || {})
    .filter(sn => sn.resourceId && sn.resourceId.videoId && sn.title !== 'Private video' && sn.title !== 'Deleted video')
    .map(sn => ({ id: sn.resourceId.videoId, title: sn.title, publishedAt: sn.publishedAt, channel: name, channelId }));
  return toYoutubeReels(items, info);
}

// Popular Shorts from any creator for one topic, from the last 2 weeks
async function fetchSearchShorts([query, category, language, region]) {
  const since = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
  const q = encodeURIComponent(`${query} #shorts`);
  const data = await ytGet(
    `search?part=snippet&type=video&videoDuration=short&videoEmbeddable=true&safeSearch=strict` +
    `&order=viewCount&maxResults=50&q=${q}&publishedAfter=${since}` +
    (region ? `&regionCode=${region}` : '') + `&relevanceLanguage=${language}`
  );
  const items = (data.items || [])
    .filter(it => it.id && it.id.videoId && it.snippet)
    .map(it => ({
      id: it.id.videoId,
      title: it.snippet.title,
      publishedAt: it.snippet.publishedAt,
      channel: stripHtml(it.snippet.channelTitle),
      channelId: it.snippet.channelId,
    }));
  return toYoutubeReels(items, { language, country: 'World', category });
}

let ytReels = { at: 0, items: [], failed: [] };
let ytRefreshing = null;
let ytTimer = null;

function refreshYoutube() {
  if (ytRefreshing) return ytRefreshing;
  ytRefreshing = (async () => {
    if (!YT_API_KEY) {
      console.log('No YT_API_KEY set on Render, so news Shorts are off');
      return;
    }
    const results = await runLimited(YT_CHANNELS, 4, fetchChannelShorts);
    const all = [];
    const failed = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') all.push(...r.value);
      else {
        failed.push(YT_CHANNELS[i][0]);
        console.log(`  x shorts "${YT_CHANNELS[i][0]}": ${r.reason.message}`);
      }
    });
    if (all.length) ytReels = { at: Date.now(), items: all, failed };
    console.log(`YouTube Shorts: ${all.length} loaded. Failed: ${failed.join(', ') || 'none'}`);
  })()
    .catch(e => console.error('YouTube refresh error:', e))
    .finally(() => {
      ytRefreshing = null;
      clearTimeout(ytTimer);
      ytTimer = setTimeout(refreshYoutube, ytReels.items.length ? YT_EVERY : RETRY);
    });
  return ytRefreshing;
}

let ytCreators = { at: 0, items: [], failed: [] };
let ytCreatorsRefreshing = null;
let ytCreatorsTimer = null;

function refreshCreators() {
  if (ytCreatorsRefreshing) return ytCreatorsRefreshing;
  ytCreatorsRefreshing = (async () => {
    await resolveFamous().catch(e => console.log('Famous creators error:', e.message));
    const channels = [...CREATOR_CHANNELS, ...famousChannels()];
    const results = await runLimited(channels, 4, fetchChannelShorts);
    const all = [];
    const failed = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') all.push(...r.value);
      else {
        failed.push(channels[i][0]);
        console.log(`  x creator "${channels[i][0]}": ${r.reason.message}`);
      }
    });
    if (all.length) ytCreators = { at: Date.now(), items: all, failed };
    console.log(`Creator channels: ${all.length} Shorts loaded. Failed: ${failed.join(', ') || 'none'}`);
  })()
    .catch(e => console.error('Creator channels error:', e))
    .finally(() => {
      ytCreatorsRefreshing = null;
      clearTimeout(ytCreatorsTimer);
      ytCreatorsTimer = setTimeout(refreshCreators, ytCreators.items.length ? CREATORS_EVERY : RETRY * 5);
    });
  return ytCreatorsRefreshing;
}

let ytSearch = { at: 0, items: [], failed: [] };
let langShorts = {}; // language code -> { at, items, pending }

// Remember YouTube results on disk, so a restart does not spend the daily limit again
try {
  const saved = JSON.parse(fs.readFileSync(YT_CACHE_FILE, 'utf8'));
  if (saved.ytSearch) ytSearch = saved.ytSearch;
  if (saved.langShorts) langShorts = saved.langShorts;
  for (const code of Object.keys(langShorts)) langShorts[code].pending = false;
  console.log(`Loaded saved creator Shorts: ${ytSearch.items.length} + ${Object.keys(langShorts).length} languages`);
} catch (e) { }

function saveYtCache() {
  try {
    fs.writeFileSync(YT_CACHE_FILE, JSON.stringify({ ytSearch, langShorts, channelAvatars }));
  } catch (e) {
    console.log('Could not save YouTube cache:', e.message);
  }
}

// Fetch creator Shorts for one language, if they are missing or older than a day
function ensureLanguage(code) {
  if (!YT_API_KEY || !LANG_SEARCHES[code]) return;
  const cur = langShorts[code];
  const age = cur ? Date.now() - cur.at : Infinity;
  const wait = cur && cur.items.length ? LANG_EVERY : 60 * 60 * 1000;
  if (cur && (cur.pending || age < wait)) return;
  langShorts[code] = { at: cur ? cur.at : 0, items: cur ? cur.items : [], pending: true };

  (async () => {
    const [region, ...queries] = LANG_SEARCHES[code];
    const jobs = queries.map((q, i) => [q, LANG_CATEGORIES[i] || 'Entertainment', code, region]);
    const results = await runLimited(jobs, 2, fetchSearchShorts);
    const all = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') all.push(...r.value);
      else console.log(`  x ${code} search "${jobs[i][0]}": ${r.reason.message}`);
    });
    const seen = new Set();
    const items = all.filter(a => (seen.has(a.id) ? false : seen.add(a.id)));
    langShorts[code] = items.length
      ? { at: Date.now(), items, pending: false }
      : { at: Date.now(), items: (cur && cur.items) || [], pending: false };
    console.log(`Creator Shorts [${code}]: ${items.length} loaded`);
    saveYtCache();
  })().catch(e => {
    console.error(`Creator Shorts [${code}] error:`, e);
    langShorts[code].pending = false;
  });
}
let ytSearchRefreshing = null;
let ytSearchTimer = null;

function refreshYoutubeSearch() {
  if (ytSearchRefreshing) return ytSearchRefreshing;
  const age = Date.now() - ytSearch.at;
  if (ytSearch.items.length && age < YT_SEARCH_EVERY) {
    // saved copy is still fresh: just schedule the next refresh
    clearTimeout(ytSearchTimer);
    ytSearchTimer = setTimeout(refreshYoutubeSearch, YT_SEARCH_EVERY - age);
    return Promise.resolve();
  }
  ytSearchRefreshing = (async () => {
    if (!YT_API_KEY) return;
    const results = await runLimited(YT_SEARCHES, 3, fetchSearchShorts);
    const all = [];
    const failed = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') all.push(...r.value);
      else {
        failed.push(YT_SEARCHES[i][0]);
        console.log(`  x search "${YT_SEARCHES[i][0]}": ${r.reason.message}`);
      }
    });
    const seen = new Set();
    const items = all.filter(a => (seen.has(a.id) ? false : seen.add(a.id)));
    if (items.length) ytSearch = { at: Date.now(), items, failed };
    console.log(`Creator Shorts: ${items.length} loaded. Failed: ${failed.join(', ') || 'none'}`);
    saveYtCache();
  })()
    .catch(e => console.error('Creator Shorts error:', e))
    .finally(() => {
      ytSearchRefreshing = null;
      clearTimeout(ytSearchTimer);
      // if the daily quota ran out, try again in an hour
      ytSearchTimer = setTimeout(refreshYoutubeSearch, ytSearch.items.length ? YT_SEARCH_EVERY : 60 * 60 * 1000);
    });
  return ytSearchRefreshing;
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

// ============================================================
// More content: Dailymotion, Vimeo, Bluesky, Mastodon, NASA, GIPHY, Unsplash
// Each source is optional. If one fails, the others still work.
// Keys (set on Render, never here): GIPHY_API_KEY, UNSPLASH_ACCESS_KEY, VIMEO_TOKEN
// ============================================================
const GIPHY_API_KEY = process.env.GIPHY_API_KEY || '';
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY || '';
const VIMEO_TOKEN = process.env.VIMEO_TOKEN || '';
const UA = { 'User-Agent': 'CIVIX/1.0 (social app)', Accept: 'application/json' };
const MORE_CACHE_FILE = path.join(__dirname, 'more-cache.json');

// Words that should never appear (extra safety on top of each site's own safe filter)
const UNSAFE = /\b(nsfw|porn|xxx|nude|nudity|onlyfans|sex|sexy|18\+|gore|hentai|fetish|boobs|naked)\b/i;
const safeText = s => !UNSAFE.test(String(s || ''));
const BAD_LABELS = new Set(['porn', 'sexual', 'nudity', 'graphic-media', 'gore', 'nsfl', 'sexual-figurative', '!hide', '!warn']);

const more = {
  dailymotion: { at: 0, items: [] },
  vimeo: { at: 0, items: [] },
  bluesky: { at: 0, items: [], photos: [] },
  mastodon: { at: 0, items: [], photos: [] },
  nasa: { at: 0, items: [] },
  giphy: { at: 0, items: [] },
  unsplash: { at: 0, photos: [] },
  lemmy: { at: 0, items: [], photos: [] },
};
try {
  const saved = JSON.parse(fs.readFileSync(MORE_CACHE_FILE, 'utf8'));
  for (const k of Object.keys(more)) if (saved[k]) more[k] = { ...more[k], ...saved[k] };
} catch (e) { }
let moreSaveTimer = null;
function saveMore() {
  clearTimeout(moreSaveTimer);
  moreSaveTimer = setTimeout(() => {
    try { fs.writeFileSync(MORE_CACHE_FILE, JSON.stringify(more)); } catch (e) { }
  }, 2000);
}

async function getJson(url, headers = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 20000);
  try {
    const r = await fetch(url, { headers: { ...UA, ...headers }, signal: controller.signal });
    if (!r.ok) throw new Error(`status ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

const plain = s => stripHtml(String(s || '')).replace(/\s+/g, ' ').trim();
const firstLine = (s, n = 140) => {
  const t = plain(s);
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

// ---------- Dailymotion (public API, no key) ----------
const DM_CHANNEL_TOPIC = {
  news: 'World', sport: 'Sports', music: 'Music', fun: 'Entertainment', videogames: 'Gaming', tech: 'Technology',
  travel: 'Travel', lifestyle: 'Fashion', auto: 'Technology', animals: 'Nature', shortfilms: 'Movies',
  tv: 'Entertainment', school: 'Education', creation: 'Art', people: 'Entertainment', webcam: 'Nature',
};
const DM_LANG = { en: 'en', hi: 'hi', fr: 'fr', es: 'es', de: 'de', pt: 'pt', ar: 'ar', tr: 'tr', ru: 'ru', it: 'en', ja: 'ja', zh: 'zh', id: 'id' };
const DM_CHANNELS = ['fun', 'sport', 'music', 'videogames', 'tech', 'travel', 'animals', 'shortfilms', 'lifestyle', 'news', 'auto', 'creation'];
async function refreshDailymotion() {
  const all = [];
  const fields = 'id,title,duration,thumbnail_720_url,owner.screenname,created_time,language,channel,explicit,allow_embed';
  const results = await runLimited(DM_CHANNELS, 3, async ch => {
    const data = await getJson(
      `https://api.dailymotion.com/videos?fields=${fields}&channel=${ch}&sort=trending&limit=40&family_filter=true&shorter_than=4`
    );
    return (data.list || []).filter(v => v && v.id && !v.explicit && v.allow_embed !== false && safeText(v.title) && (!v.duration || v.duration <= 240));
  });
  (results || []).forEach(r => {
    if (!r || r.status !== 'fulfilled') return;
    for (const v of r.value) {
      all.push({
        id: `dm-${v.id}`,
        title: firstLine(v.title),
        description: '',
        link: `https://www.dailymotion.com/video/${v.id}`,
        publishedAt: new Date((v.created_time || 0) * 1000 || Date.now()).toISOString(),
        source: v['owner.screenname'] || 'Dailymotion',
        language: DM_LANG[v.language] || 'any',
        country: 'World',
        category: DM_CHANNEL_TOPIC[v.channel] || 'Entertainment',
        imageUrl: v.thumbnail_720_url,
        videoUrl: `https://www.dailymotion.com/embed/video/${v.id}`,
        videoType: 'embed',
        provider: 'dailymotion',
        isShort: true,
        kind: v.channel === 'news' ? 'news' : 'creator',
      });
    }
  });
  if (all.length) {
    more.dailymotion = { at: Date.now(), items: all };
    saveMore();
  }
  console.log(`Dailymotion: ${all.length} videos`);
}

// ---------- Vimeo (needs VIMEO_TOKEN) ----------
async function refreshVimeo() {
  if (!VIMEO_TOKEN) return;
  const headers = { Authorization: `bearer ${VIMEO_TOKEN}`, Accept: 'application/vnd.vimeo.*+json;version=3.4' };
  const fields = 'uri,name,duration,created_time,pictures.sizes,user.name,link,content_rating,privacy.embed';
  const all = [];
  for (const page of [1, 2]) {
    try {
      const data = await getJson(`https://api.vimeo.com/channels/staffpicks/videos?per_page=50&page=${page}&sort=date&fields=${fields}`, headers);
      for (const v of data.data || []) {
        const id = String(v.uri || '').split('/').pop();
        const ratings = v.content_rating || [];
        if (!id || (v.duration && v.duration > 300)) continue;
        if (ratings.length && !ratings.includes('safe')) continue;
        if (v.privacy && v.privacy.embed && v.privacy.embed !== 'public') continue;
        if (!safeText(v.name)) continue;
        const sizes = (v.pictures && v.pictures.sizes) || [];
        const pic = sizes.length ? sizes[Math.min(sizes.length - 1, 4)].link : undefined;
        all.push({
          id: `vimeo-${id}`,
          title: firstLine(v.name),
          description: '',
          link: v.link || `https://vimeo.com/${id}`,
          publishedAt: v.created_time || new Date().toISOString(),
          source: (v.user && v.user.name) || 'Vimeo',
          language: 'any',
          country: 'World',
          category: 'Movies',
          imageUrl: pic,
          videoUrl: `https://player.vimeo.com/video/${id}`,
          videoType: 'embed',
          provider: 'vimeo',
          isShort: true,
          kind: 'creator',
        });
      }
    } catch (e) {
      console.log('Vimeo error:', e.message);
      break;
    }
  }
  if (all.length) {
    more.vimeo = { at: Date.now(), items: all };
    saveMore();
  }
  console.log(`Vimeo: ${all.length} videos`);
}

// ---------- Bluesky (public, no key) ----------
const BSKY_FEEDS = [
  'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot',
];
function bskyHasBadLabels(post) {
  const labels = [...(post.labels || []), ...((post.author && post.author.labels) || [])];
  return labels.some(l => BAD_LABELS.has(String(l.val || '').toLowerCase()));
}
async function refreshBluesky() {
  const videos = [];
  const photos = [];
  for (const feed of BSKY_FEEDS) {
    let cursor = '';
    for (let page = 0; page < 4; page++) {
      let data;
      try {
        data = await getJson(
          `https://public.api.bsky.app/xrpc/app.bsky.feed.getFeed?feed=${encodeURIComponent(feed)}&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
        );
      } catch (e) {
        console.log('Bluesky error:', e.message);
        break;
      }
      for (const item of data.feed || []) {
        const post = item.post || {};
        if (!post.uri || bskyHasBadLabels(post)) continue;
        const text = (post.record && post.record.text) || '';
        if (!safeText(text)) continue;
        let embed = post.embed || {};
        if (embed.$type === 'app.bsky.embed.recordWithMedia#view') embed = embed.media || {};
        const handle = (post.author && post.author.handle) || 'bluesky';
        const name = (post.author && (post.author.displayName || post.author.handle)) || 'Bluesky';
        const rkey = String(post.uri).split('/').pop();
        const langs = (post.record && post.record.langs) || [];
        const base = {
          title: firstLine(text) || name,
          description: '',
          link: `https://bsky.app/profile/${handle}/post/${rkey}`,
          publishedAt: (post.record && post.record.createdAt) || post.indexedAt || new Date().toISOString(),
          source: name,
          author: `@${handle}`,
          authorAvatar: post.author && post.author.avatar,
          language: langs[0] ? String(langs[0]).slice(0, 2) : 'any',
          country: 'World',
          category: 'Entertainment',
          provider: 'bluesky',
          likes: post.likeCount || 0,
        };
        if (embed.$type === 'app.bsky.embed.video#view' && embed.playlist) {
          videos.push({ ...base, id: `bsky-${rkey}`, imageUrl: embed.thumbnail, videoUrl: embed.playlist, videoType: 'file', isShort: true, kind: 'creator' });
        } else if (embed.$type === 'app.bsky.embed.images#view' && embed.images && embed.images.length) {
          const img = embed.images[0];
          photos.push({ ...base, id: `bsky-${rkey}`, type: 'photo', imageUrl: img.fullsize || img.thumb, thumbUrl: img.thumb, credit: `${name} on Bluesky` });
        }
      }
      cursor = data.cursor;
      if (!cursor) break;
    }
  }
  if (videos.length || photos.length) {
    more.bluesky = { at: Date.now(), items: videos.slice(0, 300), photos: photos.slice(0, 300) };
    saveMore();
  }
  console.log(`Bluesky: ${videos.length} videos, ${photos.length} photos`);
}

// ---------- Mastodon (public trending posts, no key) ----------
const MASTODON_SERVERS = ['mastodon.social', 'mas.to', 'mastodon.online'];
async function refreshMastodon() {
  const videos = [];
  const photos = [];
  const seen = new Set();
  for (const host of MASTODON_SERVERS) {
    for (const offset of [0, 40]) {
      let list;
      try {
        list = await getJson(`https://${host}/api/v1/trends/statuses?limit=40&offset=${offset}`);
      } catch (e) {
        console.log(`Mastodon ${host} error:`, e.message);
        break;
      }
      for (const st of list || []) {
        if (!st || st.sensitive || st.spoiler_text || !st.media_attachments || !st.media_attachments.length) continue;
        if (seen.has(st.url)) continue;
        seen.add(st.url);
        const text = plain(st.content);
        if (!safeText(text)) continue;
        const acct = (st.account && st.account.acct) || 'mastodon';
        const name = (st.account && (st.account.display_name || st.account.username)) || 'Mastodon';
        const base = {
          title: firstLine(text) || name,
          description: '',
          link: st.url,
          publishedAt: st.created_at,
          source: name,
          author: `@${acct}`,
          authorAvatar: st.account && st.account.avatar,
          language: st.language ? String(st.language).slice(0, 2) : 'any',
          country: 'World',
          category: 'Entertainment',
          provider: 'mastodon',
          likes: st.favourites_count || 0,
        };
        const m = st.media_attachments[0];
        if ((m.type === 'video' || m.type === 'gifv') && m.url) {
          videos.push({ ...base, id: `masto-${st.id}`, imageUrl: m.preview_url, videoUrl: m.url, videoType: 'file', isShort: true, kind: 'creator' });
        } else if (m.type === 'image' && m.url) {
          photos.push({ ...base, id: `masto-${st.id}`, type: 'photo', imageUrl: m.url, thumbUrl: m.preview_url, credit: `${name} on Mastodon` });
        }
      }
    }
  }
  if (videos.length || photos.length) {
    more.mastodon = { at: Date.now(), items: videos, photos };
    saveMore();
  }
  console.log(`Mastodon: ${videos.length} videos, ${photos.length} photos`);
}

// ---------- Lemmy (like Reddit, open, no key): hot posts with photos and videos ----------
const LEMMY_SERVERS = ['lemmy.world', 'sh.itjust.works', 'lemmy.ml'];
const LEMMY_TOPIC = [
  [/pic|photo|earth|nature|wildlife|aww|cats|dogs|animal/i, 'Nature'], [/game|gaming/i, 'Gaming'], [/tech|linux|android|programming/i, 'Technology'],
  [/food|cook/i, 'Food'], [/space|science|physics/i, 'Science'], [/movie|film|tv|anime/i, 'Movies'], [/sport|football|soccer|cricket/i, 'Sports'],
  [/music/i, 'Music'], [/art|draw|design/i, 'Art'], [/travel|city|map/i, 'Travel'], [/news|world|politic/i, 'World'],
];
const lemmyTopic = name => (LEMMY_TOPIC.find(([re]) => re.test(name)) || [null, 'Entertainment'])[1];
async function refreshLemmy() {
  const videos = [];
  const photos = [];
  const seen = new Set();
  for (const host of LEMMY_SERVERS) {
    let data;
    try {
      data = await getJson(`https://${host}/api/v3/post/list?sort=Hot&type_=All&limit=50`);
    } catch (e) {
      console.log(`Lemmy ${host} error:`, e.message);
      continue;
    }
    for (const pv of data.posts || []) {
      const post = pv.post || {};
      const com = pv.community || {};
      const who = pv.creator || {};
      if (!post.url || post.nsfw || com.nsfw || post.removed || post.deleted) continue;
      if (!safeText(post.name) || !safeText(com.name)) continue;
      const key = post.ap_id || post.url;
      if (seen.has(key)) continue;
      seen.add(key);
      const type = String(post.url_content_type || '');
      const isVideo = /^video\//.test(type) || /\.(mp4|webm)(\?|$)/i.test(post.url);
      const isImage = /^image\//.test(type) || /\.(jpe?g|png|webp)(\?|$)/i.test(post.url);
      if (!isVideo && !isImage) continue;
      const base = {
        id: `lemmy-${host}-${post.id}`,
        title: firstLine(post.name),
        description: '',
        link: post.ap_id || `https://${host}/post/${post.id}`,
        publishedAt: post.published || new Date().toISOString(),
        source: `c/${com.name}`,
        author: `@${who.name || 'lemmy'}`,
        authorAvatar: who.avatar,
        language: 'en',
        country: 'World',
        category: lemmyTopic(`${com.name} ${com.title || ''}`),
        provider: 'lemmy',
        likes: (pv.counts && pv.counts.score) || 0,
      };
      if (isVideo && /\.mp4(\?|$)/i.test(post.url)) videos.push({ ...base, imageUrl: post.thumbnail_url, videoUrl: post.url, videoType: 'file', isShort: true, kind: 'creator' });
      else if (isImage) photos.push({ ...base, type: 'photo', imageUrl: post.url, thumbUrl: post.thumbnail_url || post.url, credit: `Posted in c/${com.name} on Lemmy` });
    }
  }
  if (videos.length || photos.length) {
    more.lemmy = { at: Date.now(), items: videos, photos };
    saveMore();
  }
  console.log(`Lemmy: ${videos.length} videos, ${photos.length} photos`);
}

// ---------- NASA (public, no key) ----------
const NASA_TOPICS = ['earth from space', 'mars rover', 'rocket launch', 'astronaut', 'galaxy', 'moon', 'space station', 'solar eclipse'];
async function refreshNasa() {
  const all = [];
  const topics = shuffle(NASA_TOPICS).slice(0, 4);
  for (const q of topics) {
    try {
      const data = await getJson(`https://images-api.nasa.gov/search?media_type=video&page_size=12&q=${encodeURIComponent(q)}`);
      const items = ((data.collection && data.collection.items) || []).slice(0, 8);
      const done = await runLimited(items, 3, async it => {
        const d = (it.data && it.data[0]) || {};
        const files = await getJson(it.href);
        const mp4s = (Array.isArray(files) ? files : []).filter(u => /\.mp4$/i.test(u));
        const pick = mp4s.find(u => /~mobile\.mp4$/i.test(u)) || mp4s.find(u => /~small\.mp4$/i.test(u)) || mp4s.find(u => /~medium\.mp4$/i.test(u)) || mp4s[0];
        if (!pick) return null;
        return {
          id: `nasa-${d.nasa_id}`,
          title: firstLine(d.title),
          description: firstLine(d.description, 200),
          link: `https://images.nasa.gov/details/${encodeURIComponent(d.nasa_id)}`,
          publishedAt: d.date_created || new Date().toISOString(),
          source: 'NASA',
          language: 'en',
          country: 'World',
          category: 'Science',
          imageUrl: it.links && it.links[0] && it.links[0].href,
          videoUrl: pick.replace(/^http:/, 'https:').replace(/ /g, '%20'),
          videoType: 'file',
          provider: 'nasa',
          isShort: true,
          kind: 'creator',
        };
      });
      (done || []).forEach(r => r && r.status === 'fulfilled' && r.value && all.push(r.value));
    } catch (e) {
      console.log('NASA error:', e.message);
    }
  }
  if (all.length) {
    const have = new Set(all.map(a => a.id));
    more.nasa = { at: Date.now(), items: [...all, ...more.nasa.items.filter(a => !have.has(a.id))].slice(0, 120) };
    saveMore();
  }
  console.log(`NASA: ${all.length} videos`);
}

// ---------- GIPHY (needs GIPHY_API_KEY) ----------
async function refreshGiphy() {
  if (!GIPHY_API_KEY) return;
  try {
    const data = await getJson(`https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=50&rating=pg`);
    const all = (data.data || [])
      .filter(g => g.images && (g.images.original_mp4 || g.images.fixed_height) && safeText(g.title))
      .map(g => ({
        id: `giphy-${g.id}`,
        title: firstLine(g.title || 'GIF'),
        description: '',
        link: g.url,
        publishedAt: g.trending_datetime && !String(g.trending_datetime).startsWith('0000') ? new Date(g.trending_datetime + 'Z').toISOString() : new Date().toISOString(),
        source: g.username || 'GIPHY',
        language: 'any',
        country: 'World',
        category: 'Entertainment',
        imageUrl: g.images.original_still && g.images.original_still.url,
        videoUrl: (g.images.original_mp4 && g.images.original_mp4.mp4) || g.images.fixed_height.mp4,
        videoType: 'file',
        provider: 'giphy',
        isShort: true,
        kind: 'creator',
      }));
    if (all.length) {
      more.giphy = { at: Date.now(), items: all };
      saveMore();
    }
    console.log(`GIPHY: ${all.length} clips`);
  } catch (e) {
    console.log('GIPHY error:', e.message);
  }
}

// GIF search for stories and chats (the key stays on the server)
const gifSearchCache = new Map();
app.get('/api/gifs', async (req, res) => {
  try {
    if (!GIPHY_API_KEY) return res.json({ gifs: [] });
    const q = String(req.query.q || '').trim().slice(0, 50);
    const type = req.query.type === 'stickers' ? 'stickers' : 'gifs';
    const k = `${type}:${q}`;
    const hit = gifSearchCache.get(k);
    if (hit && Date.now() - hit.at < 30 * 60 * 1000) return res.json({ gifs: hit.list });
    const url = q
      ? `https://api.giphy.com/v1/${type}/search?api_key=${GIPHY_API_KEY}&limit=30&rating=pg&q=${encodeURIComponent(q)}`
      : `https://api.giphy.com/v1/${type}/trending?api_key=${GIPHY_API_KEY}&limit=30&rating=pg`;
    const data = await getJson(url);
    const list = (data.data || []).map(g => ({
      id: g.id,
      title: g.title,
      preview: (g.images.fixed_width_small && g.images.fixed_width_small.url) || (g.images.fixed_width && g.images.fixed_width.url),
      url: (g.images.fixed_width && g.images.fixed_width.url) || g.images.original.url,
      mp4: g.images.fixed_width && g.images.fixed_width.mp4,
      width: Number((g.images.fixed_width && g.images.fixed_width.width) || 200),
      height: Number((g.images.fixed_width && g.images.fixed_width.height) || 200),
    }));
    gifSearchCache.set(k, { at: Date.now(), list });
    if (gifSearchCache.size > 300) gifSearchCache.delete(gifSearchCache.keys().next().value);
    res.json({ gifs: list });
  } catch (e) {
    res.json({ gifs: [] });
  }
});

// ---------- Unsplash (needs UNSPLASH_ACCESS_KEY) ----------
const UNSPLASH_TOPICS = [
  ['travel', 'Travel'], ['nature', 'Nature'], ['food-drink', 'Food'], ['architecture-interior', 'Art'],
  ['fashion-beauty', 'Fashion'], ['animals', 'Nature'], ['street-photography', 'Photography'], ['sports', 'Sports'],
];
async function refreshUnsplash() {
  if (!UNSPLASH_ACCESS_KEY) return;
  const headers = { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`, 'Accept-Version': 'v1' };
  const all = [];
  // 8 requests every 6 hours (the free plan allows 50 per hour)
  const results = await runLimited(UNSPLASH_TOPICS, 2, async ([slug, category]) => {
    const page = 1 + Math.floor(Math.random() * 3);
    const list = await getJson(`https://api.unsplash.com/topics/${slug}/photos?per_page=30&page=${page}&order_by=popular`, headers);
    return (Array.isArray(list) ? list : []).map(p => ({ p, category }));
  });
  (results || []).forEach(r => {
    if (!r || r.status !== 'fulfilled') return;
    for (const { p, category } of r.value) {
      const name = (p.user && p.user.name) || 'Unsplash';
      const ref = '?utm_source=civix&utm_medium=referral';
      all.push({
        id: `unsplash-${p.id}`,
        type: 'photo',
        title: firstLine(p.description || p.alt_description || `${category} photo`),
        description: '',
        link: `${(p.links && p.links.html) || 'https://unsplash.com'}${ref}`,
        publishedAt: p.created_at || new Date().toISOString(),
        source: name,
        author: p.user && p.user.username ? `@${p.user.username}` : undefined,
        authorAvatar: p.user && p.user.profile_image && p.user.profile_image.medium,
        language: 'any',
        country: 'World',
        category,
        imageUrl: p.urls && p.urls.regular,
        thumbUrl: p.urls && p.urls.small,
        color: p.color,
        credit: `Photo by ${name} on Unsplash`,
        creditLink: `${(p.user && p.user.links && p.user.links.html) || 'https://unsplash.com'}${ref}`,
        provider: 'unsplash',
        likes: p.likes || 0,
      });
    }
  });
  const ids = new Set();
  const uniq = all.filter(p => !ids.has(p.id) && ids.add(p.id));
  if (uniq.length) {
    more.unsplash = { at: Date.now(), photos: uniq };
    saveMore();
  }
  console.log(`Unsplash: ${uniq.length} photos`);
}

// ---------- Refresh schedule ----------
function every(fn, ms, firstDelay) {
  const run = () => fn().catch(e => console.log(`${fn.name} error:`, e.message));
  setTimeout(() => {
    run();
    setInterval(run, ms);
  }, firstDelay);
}
const MIN = 60 * 1000;
function startMoreSources() {
  every(refreshBluesky, 30 * MIN, 5 * 1000);
  every(refreshMastodon, 30 * MIN, 8 * 1000);
  every(refreshDailymotion, 60 * MIN, 12 * 1000);
  every(refreshGiphy, 2 * 60 * MIN, 15 * 1000);
  every(refreshVimeo, 6 * 60 * MIN, 20 * 1000);
  every(refreshUnsplash, 6 * 60 * MIN, 25 * 1000);
  every(refreshNasa, 12 * 60 * MIN, 30 * 1000);
  every(refreshLemmy, 30 * MIN, 35 * 1000);
}

// Take one from each site in turn, so Reels never shows 5 from the same site in a row
function mixBySource(list) {
  const groups = {};
  for (const it of shuffle(list)) (groups[it.provider || it.source] = groups[it.provider || it.source] || []).push(it);
  const lists = Object.values(groups);
  const out = [];
  while (lists.some(l => l.length)) for (const l of lists) if (l.length) out.push(l.shift());
  return out;
}

// All extra videos, mixed (used by Reels)
// Dailymotion / Vimeo players show "Forbidden" inside the app, so they are off for now.
// (Set EMBED_REELS=on on Render to turn them back on for testing.)
const EMBED_REELS = process.env.EMBED_REELS === 'on';
function moreVideos() {
  return [
    ...(EMBED_REELS ? more.dailymotion.items : []),
    ...(EMBED_REELS ? more.vimeo.items : []),
    ...more.bluesky.items,
    ...more.mastodon.items,
    ...more.nasa.items,
    ...more.lemmy.items,
  ];
}

// Photos and posts for Home "Discover" and the Explore grid
app.get('/api/discover', (req, res) => {
  const max = Math.min(Number(req.query.limit) || 60, 200);
  let photos = [...more.unsplash.photos, ...more.bluesky.photos, ...more.mastodon.photos, ...more.lemmy.photos];
  const topic = String(req.query.category || '');
  if (topic) photos = photos.filter(p => p.category === topic);
  if (req.query.language) {
    const set = parts(req.query.language);
    photos = photos.filter(p => p.language === 'any' || set.includes(p.language));
  }
  // Mix the sources so it is not all from one site
  const bySource = {};
  for (const p of shuffle(photos)) (bySource[p.provider] = bySource[p.provider] || []).push(p);
  const lists = Object.values(bySource);
  const out = [];
  while (out.length < max && lists.some(l => l.length)) for (const l of lists) if (l.length) out.push(l.shift());
  res.json({
    items: out.slice(0, max),
    gifs: shuffle(more.giphy.items).slice(0, 12),
    updatedAt: new Date(Math.max(more.unsplash.at, more.bluesky.at, more.mastodon.at)).toISOString(),
  });
});

app.get('/api/news', async (req, res) => {
  try {
    const { video, shorts, stories, limit } = req.query;
    const max = Number(limit) || 300;

    // Reels: stock videos + YouTube Shorts mixed together
    if (shorts) {
      if (!reels.items.length && !ytReels.items.length && !ytSearch.items.length && !ytCreators.items.length) {
        await Promise.all([refreshReels(), refreshYoutube(), refreshYoutubeSearch(), refreshCreators()]);
      }
      const stock = shuffle(applyFilters(reels.items, req.query).filter(a => a.vertical !== false));
      const news = shuffle(applyFilters(ytReels.items, req.query));
      // Creator Shorts in the languages this person picked (World = every language we have)
      const wanted = req.query.language ? parts(req.query.language) : Object.keys(langShorts);
      wanted.forEach(ensureLanguage);
      const langItems = wanted.flatMap(code => (langShorts[code] ? langShorts[code].items : []));
      const creators = shuffle(applyFilters([...ytCreators.items, ...ytSearch.items, ...langItems], req.query));
      // Dailymotion, Vimeo, Bluesky, Mastodon, NASA (+ a few GIPHY loops)
      const extra = mixBySource(applyFilters(moreVideos(), req.query));
      const loops = shuffle(more.giphy.items);
      // Mix like Instagram: mostly creators, news is about 1 in 5, plus some stock clips
      const mixed = [];
      const seenIds = new Set();
      const take = l => {
        while (l.length) {
          const x = l.shift();
          if (!seenIds.has(x.id)) { seenIds.add(x.id); mixed.push(x); return; }
        }
      };
      let round = 0;
      while (stock.length || news.length || creators.length || extra.length) {
        take(creators);
        take(extra);
        take(news);
        take(creators);
        take(extra);
        take(stock);
        if (round++ % 3 === 2) take(loops);
      }
      return res.json({
        articles: mixed.slice(0, max),
        updatedAt: new Date(Math.max(reels.at, ytReels.at, ytSearch.at, ytCreators.at)).toISOString(),
        feedsFailed: [...reels.failed, ...ytReels.failed, ...ytSearch.failed, ...ytCreators.failed],
        languagesLoading: wanted.filter(code => langShorts[code] && langShorts[code].pending),
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

// ============================================================
// People search: news channels, YouTube creators (like Dhruv Rathee) and their videos
// ============================================================
const key = s => String(s || '').trim().toLowerCase();
const NEWS_NAMES = new Set([
  ...FEEDS.map(f => key(f.name)),
  ...YT_CHANNELS.filter(c => c[4] === 'World').map(c => key(c[0])),
]);
const FEED_SITE = {}; // news source name -> website, for its logo
for (const f of FEEDS) {
  try { FEED_SITE[key(f.name)] = new URL(f.url).hostname.replace(/^(feeds?|rss|www3?)\./, ''); } catch (e) { }
}
let channelAvatars = {}; // YouTube channel id -> picture
try { channelAvatars = JSON.parse(fs.readFileSync(YT_CACHE_FILE, 'utf8')).channelAvatars || {}; } catch (e) { }

function allYoutubeItems() {
  return [...ytReels.items, ...ytCreators.items, ...ytSearch.items, ...Object.values(langShorts).flatMap(x => x.items || [])];
}

let peopleCache = { at: 0, list: [] };
function buildPeople() {
  if (Date.now() - peopleCache.at < 60 * 1000) return peopleCache.list;
  const map = new Map();
  const add = a => {
    if (!a.source || a.source === 'Pixabay' || a.source === 'Pexels') return;
    const k = key(a.source);
    let c = map.get(k);
    if (!c) {
      c = {
        id: k,
        name: a.source,
        kind: NEWS_NAMES.has(k) ? 'news' : 'creator',
        category: a.category,
        language: a.language,
        country: a.country,
        channelId: a.channelId,
        reels: 0,
        stories: 0,
        latest: a.publishedAt,
      };
      map.set(k, c);
    }
    if (a.videoType === 'youtube') c.reels++;
    else c.stories++;
    if (!c.channelId && a.channelId) c.channelId = a.channelId;
    if (a.publishedAt > c.latest) c.latest = a.publishedAt;
  };
  cache.articles.forEach(add);
  allYoutubeItems().forEach(add);
  // Famous creators can always be found, even before their Shorts are loaded
  for (const [name, h, language, country, category, words] of FAMOUS_CREATORS) {
    const f = famous[h];
    const cid = f && f.channelId;
    const existing = map.get(key(name)) || [...map.values()].find(c => cid && c.channelId === cid);
    if (existing) {
      existing.words = `${words || ''} ${h}`;
      if (!existing.channelId && cid) existing.channelId = cid;
      continue;
    }
    if (!cid) continue;
    map.set(key(name), { id: key(name), name, kind: 'creator', category, language, country, channelId: cid, reels: 0, stories: 0, latest: '', words: `${words || ''} ${h}` });
  }
  const list = [...map.values()];
  for (const c of list) c.imageUrl = avatarFor(c);
  peopleCache = { at: Date.now(), list };
  return list;
}

function avatarFor(c) {
  if (c.channelId && channelAvatars[c.channelId]) return channelAvatars[c.channelId];
  const site = FEED_SITE[c.id];
  if (site) return `https://www.google.com/s2/favicons?domain=${site}&sz=128`;
  return undefined;
}

// Get channel pictures from YouTube (1 unit for up to 50 channels)
async function fillAvatars(people) {
  if (!YT_API_KEY) return;
  const missing = [...new Set(people.filter(p => p.channelId && !channelAvatars[p.channelId]).map(p => p.channelId))].slice(0, 50);
  if (!missing.length) return;
  try {
    const data = await ytGet(`channels?part=snippet&id=${missing.join(',')}`);
    for (const ch of data.items || []) {
      const t = ch.snippet && ch.snippet.thumbnails;
      const url = t && ((t.medium && t.medium.url) || (t.default && t.default.url));
      if (url) channelAvatars[ch.id] = url;
    }
    for (const p of people) p.imageUrl = avatarFor(p);
    saveYtCache();
  } catch (e) {
    console.log('Channel pictures error:', e.message);
  }
}

// Find any YouTube creator by name (costs 100 units, so results are kept for a day and capped)
const channelSearchCache = new Map();
let channelSearchDay = { day: '', count: 0 };
// Free channel search: reads YouTube's public search page (no API quota)
async function searchChannelsFree(q) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 12000);
  try {
    const r = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=EgIQAg%253D%253D&hl=en`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36', 'Accept-Language': 'en' },
      signal: controller.signal,
    });
    if (!r.ok) throw new Error(`status ${r.status}`);
    const html = await r.text();
    const m = /var ytInitialData = (\{.*?\});<\/script>/s.exec(html);
    if (!m) return [];
    const data = JSON.parse(m[1]);
    const found = [];
    const walk = o => {
      if (!o || typeof o !== 'object' || found.length >= 8) return;
      if (o.channelRenderer && o.channelRenderer.channelId) {
        found.push(o.channelRenderer);
        return;
      }
      for (const k in o) walk(o[k]);
    };
    walk(data);
    return found.map(c => {
      const thumbs = (c.thumbnail && c.thumbnail.thumbnails) || [];
      let pic = thumbs.length ? thumbs[thumbs.length - 1].url : undefined;
      if (pic && pic.startsWith('//')) pic = `https:${pic}`;
      if (pic) channelAvatars[c.channelId] = pic;
      const name = (c.title && (c.title.simpleText || (c.title.runs || []).map(x => x.text).join(''))) || 'YouTube creator';
      const desc = ((c.descriptionSnippet && c.descriptionSnippet.runs) || []).map(x => x.text).join('');
      return {
        id: key(name), name: stripHtml(name), kind: 'creator', category: 'Entertainment', language: 'any', country: 'World',
        channelId: c.channelId, description: stripHtml(desc).slice(0, 140), imageUrl: pic, reels: 0, stories: 0,
      };
    });
  } finally {
    clearTimeout(t);
  }
}

async function searchYoutubeChannels(q) {
  const hit = channelSearchCache.get(q);
  if (hit && Date.now() - hit.at < 24 * 3600 * 1000) return hit.list;
  try {
    const free = await searchChannelsFree(q);
    if (free.length) {
      channelSearchCache.set(q, { at: Date.now(), list: free });
      return free;
    }
  } catch (e) {
    console.log('Free channel search error:', e.message);
  }
  if (!YT_API_KEY) return [];
  const today = new Date().toISOString().slice(0, 10);
  if (channelSearchDay.day !== today) channelSearchDay = { day: today, count: 0 };
  if (channelSearchDay.count >= 25) return []; // keep YouTube's free daily limit safe
  channelSearchDay.count++;
  const data = await ytGet(`search?part=snippet&type=channel&maxResults=8&safeSearch=strict&q=${encodeURIComponent(q)}`);
  const list = (data.items || [])
    .filter(it => it.snippet)
    .map(it => {
      const channelId = (it.id && it.id.channelId) || it.snippet.channelId;
      const t = it.snippet.thumbnails || {};
      const pic = (t.medium && t.medium.url) || (t.default && t.default.url);
      if (channelId && pic) channelAvatars[channelId] = pic;
      return {
        id: key(it.snippet.channelTitle),
        name: stripHtml(it.snippet.channelTitle),
        kind: 'creator',
        category: 'Entertainment',
        language: 'any',
        country: 'World',
        channelId,
        description: stripHtml(it.snippet.description).slice(0, 140),
        imageUrl: pic,
        reels: 0,
        stories: 0,
      };
    })
    .filter(p => p.channelId);
  channelSearchCache.set(q, { at: Date.now(), list });
  return list;
}

// Shorts from one channel, fetched on demand (2 units) and kept for 3 hours
const channelShortsCache = new Map();
async function channelShorts(channelId, name, info) {
  const hit = channelShortsCache.get(channelId);
  if (hit && Date.now() - hit.at < 3 * 3600 * 1000) return hit.items;
  let items = [];
  try {
    const free = await rssShorts(name, channelId);
    if (free.length) items = rssToReels(free, info);
  } catch (e) { }
  for (const prefix of items.length || !YT_API_KEY ? [] : ['UUSH', 'UU']) { // Shorts list first, then all uploads
    try {
      const list = await ytGet(`playlistItems?part=snippet&maxResults=30&playlistId=${prefix}${channelId.slice(2)}`);
      const raw = (list.items || [])
        .map(it => it.snippet || {})
        .filter(sn => sn.resourceId && sn.resourceId.videoId && sn.title !== 'Private video' && sn.title !== 'Deleted video')
        .map(sn => ({ id: sn.resourceId.videoId, title: sn.title, publishedAt: sn.publishedAt, channel: name, channelId }));
      items = await toYoutubeReels(raw, info);
      if (items.length) break;
    } catch (e) { }
  }
  channelShortsCache.set(channelId, { at: Date.now(), items });
  return items;
}

const publicPerson = p => ({
  id: p.id,
  name: p.name,
  kind: p.kind,
  category: p.category,
  language: p.language,
  country: p.country,
  channelId: p.channelId,
  imageUrl: p.imageUrl,
  description: p.description,
  reels: p.reels,
  stories: p.stories,
});

// /api/people?q=dhruv   -> channels and creators matching the words
app.get('/api/people', async (req, res) => {
  try {
    if (!cache.articles.length) await refresh();
    const q = key(req.query.q).slice(0, 60);
    let list = buildPeople();
    if (q) {
      const qs = q.replace(/\s+/g, '');
      list = list.filter(p =>
        key(p.name).includes(q) || key(p.category).includes(q) ||
        key(p.name).replace(/\s+/g, '').includes(qs) || (p.words && key(p.words).includes(q))
      );
      list.sort((a, b) => {
        const sa = key(a.name).startsWith(q) ? 0 : 1;
        const sb = key(b.name).startsWith(q) ? 0 : 1;
        return sa - sb || (b.reels + b.stories) - (a.reels + a.stories);
      });
    } else {
      list = [...list].sort((a, b) => (b.reels * 3 + b.stories) - (a.reels * 3 + a.stories));
    }
    list = list.slice(0, 25);
    if (q.length >= 3 && list.length < 4) {
      try {
        const more = await searchYoutubeChannels(q);
        const have = new Set(list.map(p => p.channelId || p.id));
        list = [...list, ...more.filter(p => !have.has(p.channelId) && !have.has(p.id))];
      } catch (e) {
        console.log('Channel search error:', e.message);
      }
    }
    await fillAvatars(list);
    res.json({ people: list.map(publicPerson) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not search people' });
  }
});

// /api/creator?name=Dhruv%20Rathee&channelId=UC...   -> their reels and stories
app.get('/api/creator', async (req, res) => {
  try {
    const name = String(req.query.name || '').slice(0, 100);
    const channelId = /^UC[\w-]{20,}$/.test(String(req.query.channelId || '')) ? String(req.query.channelId) : '';
    const k = key(name);
    const known = buildPeople().find(p => p.id === k || (channelId && p.channelId === channelId));
    const person = known ? { ...known } : {
      id: k, name, kind: 'creator', category: 'Entertainment', language: 'any', country: 'World', channelId, reels: 0, stories: 0,
    };
    const cid = channelId || person.channelId;

    const seen = new Set();
    let reelsList = allYoutubeItems()
      .filter(a => key(a.source) === k || (cid && a.channelId === cid))
      .filter(a => (seen.has(a.id) ? false : seen.add(a.id)));
    if (cid && reelsList.length < 8) {
      const extra = await channelShorts(cid, person.name, {
        language: person.language || 'any', country: person.country || 'World', category: person.category || 'Entertainment',
      });
      reelsList = [...reelsList, ...extra.filter(a => (seen.has(a.id) ? false : seen.add(a.id)))];
    }
    reelsList.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    const storyList = cache.articles.filter(a => key(a.source) === k).slice(0, 60);

    person.channelId = cid;
    await fillAvatars([person]);
    person.reels = reelsList.length;
    person.stories = storyList.length;
    res.json({ person: publicPerson(person), reels: reelsList.slice(0, 60), stories: storyList });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not load this creator' });
  }
});

// ============================================================
// Voice calls: give each person in a call a LiveKit pass for that call only
// ============================================================
function livekitToken(identity, room) {
  const now = Math.floor(Date.now() / 1000);
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64({
    iss: LIVEKIT_API_KEY,
    sub: identity,
    nbf: now - 10,
    exp: now + 2 * 3600,
    video: { room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: false },
  });
  const sig = crypto.createHmac('sha256', LIVEKIT_API_SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

app.post('/api/call-token', async (req, res) => {
  try {
    if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return res.status(503).json({ error: 'Calls are not set up on the server yet (LiveKit keys missing on Render).' });
    }
    const auth = String(req.headers.authorization || '');
    const callId = String((req.body && req.body.callId) || '');
    if (!/^Bearer \S+$/.test(auth)) return res.status(401).json({ error: 'Please sign in' });
    if (!/^[0-9a-f-]{36}$/i.test(callId)) return res.status(400).json({ error: 'Bad call id' });

    // Ask Supabase who this is, and if they are in this call (the database rules decide)
    const headers = { apikey: SUPABASE_KEY, Authorization: auth };
    const [u, c] = await Promise.all([
      fetch(`${SUPABASE_URL}/auth/v1/user`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/calls?id=eq.${callId}&select=id,caller_id,callee_id,status`, { headers }),
    ]);
    if (!u.ok) return res.status(401).json({ error: 'Please sign in again' });
    const user = await u.json();
    const rows = c.ok ? await c.json() : [];
    const call = Array.isArray(rows) ? rows[0] : null;
    if (!call || (call.caller_id !== user.id && call.callee_id !== user.id)) {
      return res.status(403).json({ error: 'You are not in this call' });
    }
    if (call.status !== 'ringing' && call.status !== 'accepted') {
      return res.status(410).json({ error: 'This call has ended' });
    }
    res.json({ url: LIVEKIT_URL, token: livekitToken(user.id, `call-${call.id}`) });
  } catch (e) {
    console.error('call-token error:', e);
    res.status(500).json({ error: 'Could not start the call' });
  }
});

// ============================================================
// Notifications: tell the other phone about a new message or an incoming call
// ============================================================
// Send to Expo push and write any problem in the logs (also checks the delivery receipts)
async function sendExpoPush(messages, label) {
  const sent = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });
  const j = await sent.json().catch(() => ({}));
  if (!sent.ok) {
    console.log(`Push ${label} error:`, sent.status, JSON.stringify(j).slice(0, 300));
    return;
  }
  const tickets = Array.isArray(j.data) ? j.data : [];
  const ids = [];
  tickets.forEach(t => {
    if (t.status === 'error') console.log(`Push ${label} ticket error:`, t.message, t.details ? JSON.stringify(t.details) : '');
    else if (t.id) ids.push(t.id);
  });
  console.log(`Push ${label}: ${tickets.length} sent`);
  if (!ids.length) return;
  // Ask Expo 15 seconds later whether Google really delivered it
  setTimeout(async () => {
    try {
      const r = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const rj = await r.json().catch(() => ({}));
      Object.values(rj.data || {}).forEach(rc => {
        if (rc.status === 'error') console.log(`Push ${label} delivery error:`, rc.message, rc.details ? JSON.stringify(rc.details) : '');
        else console.log(`Push ${label} delivered to Google ✓`);
      });
    } catch (e) { }
  }, 15000);
}

// "Test notifications" button in the app: sends a test to this phone after 10 seconds
app.post('/api/test-push', async (req, res) => {
  try {
    if (tooManyPush(req)) return res.status(429).json({ error: 'Wait a minute' });
    const auth = String(req.headers.authorization || '');
    const token = String((req.body && req.body.token) || '');
    if (!/^Bearer \S+$/.test(auth) || !/^ExponentPushToken\[[\w-]+\]$/.test(token)) return res.status(400).json({ error: 'Bad request' });
    const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_KEY, Authorization: auth } });
    if (!u.ok) return res.status(401).json({ error: 'Please sign in' });
    const kind = req.body.kind === 'call' ? 'call' : 'message';
    setTimeout(() => {
      sendExpoPush([{
        to: token,
        title: kind === 'call' ? '📞 Test call' : 'CIVIX test 🔔',
        body: kind === 'call' ? 'If you see this with CIVIX closed, calls will reach you.' : 'If you see this with CIVIX closed, notifications work!',
        sound: 'default',
        priority: 'high',
        channelId: kind === 'call' ? 'calls_ring' : 'messages',
        data: { type: 'test' },
      }], 'test').catch(e => console.log('Push test error:', e.message));
    }, 10000);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Could not send' });
  }
});
const pushTries = new Map();
function tooManyPush(req) {
  const ip = String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
  const now = Date.now();
  const list = (pushTries.get(ip) || []).filter(t => now - t < 60 * 1000);
  list.push(now);
  pushTries.set(ip, list);
  if (pushTries.size > 5000) pushTries.clear();
  return list.length > 5;
}

app.post('/api/notify', async (req, res) => {
  try {
    const auth = String(req.headers.authorization || '');
    const type = String((req.body && req.body.type) || '');
    const id = String((req.body && req.body.id) || '');
    if (!/^Bearer \S+$/.test(auth)) return res.status(401).json({ error: 'Please sign in' });
    if (!['message', 'call', 'like', 'comment', 'follow', 'story_like'].includes(type) || !/^[0-9a-f-]{36}$/i.test(id)) {
      return res.status(400).json({ error: 'Bad request' });
    }
    // The database checks that this person really sent this message / is making this call
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/push_targets`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: type, target_id: id }),
    });
    if (!r.ok) console.log(`push_targets ${type} error:`, r.status, (await r.text().catch(() => '')).slice(0, 200));
    const rows = r.ok ? await r.json() : [];
    if (!Array.isArray(rows) || !rows.length) {
      console.log(`Push ${type}: nobody to send to (no saved phone for them)`);
      return res.json({ sent: 0 });
    }

    const messages = rows.slice(0, 20).map(x => ({
      to: x.token,
      title: x.title,
      body: x.body,
      sound: 'default',
      priority: 'high',
      channelId: type === 'call' ? 'calls_ring' : type === 'message' ? 'messages' : 'activity',
      data: { type, ref: x.ref },
      // Calls: "Answer" / "Decline" buttons, and the alert is dropped after 60 seconds
      ...(type === 'call' ? { categoryId: 'call', ttl: 60 } : {}),
    }));
    await sendExpoPush(messages, type);
    res.json({ sent: messages.length });
  } catch (e) {
    console.error('notify error:', e);
    res.status(500).json({ error: 'Could not send the notification' });
  }
});

// ---------- Sign in with @username, and "forgot password" with @username ----------
// Needs SUPABASE_SECRET_KEY on Render (Supabase → Project Settings → API Keys → secret key).
// It never leaves the server.
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || '';
const RESET_URL = 'https://civix-server-c961.onrender.com/reset';
const tries = new Map(); // simple limit: 10 tries per minute per phone
function tooMany(req) {
  const ip = String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
  const now = Date.now();
  const list = (tries.get(ip) || []).filter(t => now - t < 60 * 1000);
  list.push(now);
  tries.set(ip, list);
  if (tries.size > 5000) tries.clear();
  return list.length > 10;
}
const isEmailText = s => /^\S+@\S+\.\S+$/.test(s);
async function emailForLogin(login) {
  const t = String(login || '').trim().toLowerCase();
  if (isEmailText(t)) return t;
  const name = t.replace(/^@/, '');
  if (!/^[a-z0-9._]{3,20}$/.test(name) || !SUPABASE_SECRET_KEY) return null;
  const headers = { apikey: SUPABASE_SECRET_KEY, 'Content-Type': 'application/json' };
  if (SUPABASE_SECRET_KEY.startsWith('eyJ')) headers.Authorization = `Bearer ${SUPABASE_SECRET_KEY}`;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/email_of_username`, { method: 'POST', headers, body: JSON.stringify({ u: name }) });
  if (!r.ok) {
    console.log('email_of_username error:', r.status);
    return null;
  }
  const email = await r.json();
  return typeof email === 'string' && email ? email : null;
}

app.post('/api/login', async (req, res) => {
  try {
    if (tooMany(req)) return res.status(429).json({ error: 'Too many tries. Wait a minute and try again.' });
    const login = String((req.body && req.body.login) || '').slice(0, 120);
    const password = String((req.body && req.body.password) || '').slice(0, 200);
    if (!login || !password) return res.status(400).json({ error: 'Enter your username and password.' });
    if (!isEmailText(login.trim()) && !SUPABASE_SECRET_KEY) {
      return res.status(503).json({ error: 'Signing in with a username is not ready yet. Please use your email.' });
    }
    const email = await emailForLogin(login);
    if (!email) return res.status(400).json({ error: 'Wrong username or password.' });
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) return res.status(400).json({ error: 'Wrong username or password.' });
    res.json({ access_token: j.access_token, refresh_token: j.refresh_token });
  } catch (e) {
    console.error('login error:', e);
    res.status(500).json({ error: 'Could not sign in. Please try again.' });
  }
});

app.post('/api/forgot', async (req, res) => {
  try {
    if (tooMany(req)) return res.status(429).json({ error: 'Too many tries. Wait a minute and try again.' });
    const login = String((req.body && req.body.login) || '').slice(0, 120);
    if (!isEmailText(login.trim()) && !SUPABASE_SECRET_KEY) {
      return res.status(503).json({ error: 'Reset with a username is not ready yet. Please use your email.' });
    }
    const email = await emailForLogin(login);
    if (email) {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/recover?redirect_to=${encodeURIComponent(RESET_URL)}`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (r.status === 429) return res.status(429).json({ error: 'Too many emails were sent. Try again in a few minutes.' });
      if (!r.ok) console.log('recover error:', r.status, await r.text().catch(() => ''));
    }
    // Same answer either way, so nobody can find out which usernames exist
    res.json({ ok: true });
  } catch (e) {
    console.error('forgot error:', e);
    res.status(500).json({ error: 'Could not send the email. Please try again.' });
  }
});

// ---------- Music for stories and posts (Audius: free, artists share their music for apps) ----------
const AUDIUS = 'https://api.audius.co/v1';
const APP_NAME = 'CIVIX';
const musicCache = new Map();
function toTrack(t) {
  const art = t.artwork || {};
  return {
    id: String(t.id),
    title: stripHtml(t.title || 'Untitled'),
    artist: stripHtml((t.user && (t.user.name || t.user.handle)) || 'Unknown artist'),
    artwork: art['480x480'] || art['150x150'] || art['1000x1000'] || undefined,
    duration: t.duration || 0,
    genre: t.genre || '',
    stream: `${AUDIUS}/tracks/${encodeURIComponent(t.id)}/stream?app_name=${APP_NAME}`,
    link: t.permalink ? `https://audius.co${t.permalink}` : 'https://audius.co',
  };
}
// Popular and movie songs: 30-second clips from Apple Music (iTunes) and Deezer, with the artist's name
const appleSong = t => ({
  id: `it-${t.trackId}`,
  title: stripHtml(t.trackName || 'Song'),
  artist: stripHtml(t.artistName || ''),
  artwork: t.artworkUrl100 ? t.artworkUrl100.replace('100x100', '300x300') : undefined,
  duration: 30,
  stream: t.previewUrl,
  link: t.trackViewUrl,
  clip: true,
  album: t.collectionName,
});
async function appleSearch(q, country) {
  const data = await getJson(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=30&country=${country}`);
  return (data.results || []).filter(t => t.previewUrl && t.trackExplicitness !== 'explicit').map(appleSong);
}
async function appleTopIndia() {
  const top = await getJson('https://rss.applemarketingtools.com/api/v2/in/music/most-played/40/songs.json');
  const ids = ((top.feed && top.feed.results) || []).map(r => r.id).filter(Boolean).slice(0, 40);
  if (!ids.length) return [];
  const data = await getJson(`https://itunes.apple.com/lookup?id=${ids.join(',')}&country=IN&entity=song`);
  return (data.results || []).filter(t => t.previewUrl && t.trackExplicitness !== 'explicit').map(appleSong);
}
async function deezerSearch(q) {
  const data = await getJson(q ? `https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=30` : 'https://api.deezer.com/chart/0/tracks?limit=30');
  return (data.data || [])
    .filter(t => t && t.preview && !t.explicit_lyrics)
    .map(t => ({
      id: `dz-${t.id}`,
      title: stripHtml(t.title || 'Song'),
      artist: stripHtml((t.artist && t.artist.name) || ''),
      artwork: t.album && (t.album.cover_medium || t.album.cover),
      duration: 30,
      stream: t.preview,
      link: t.link,
      clip: true,
    }));
}
async function audiusTracks(q) {
  const data = await getJson(
    q ? `${AUDIUS}/tracks/search?query=${encodeURIComponent(q)}&app_name=${APP_NAME}` : `${AUDIUS}/tracks/trending?time=week&app_name=${APP_NAME}`
  );
  return (data.data || [])
    .filter(t => t && t.id && t.is_streamable !== false && !t.is_stream_gated && (t.duration || 0) >= 15 && safeText(t.title))
    .slice(0, 25)
    .map(toTrack);
}
app.get('/api/music', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 60);
    const k = q.toLowerCase() || '__trending';
    const hit = musicCache.get(k);
    if (hit && Date.now() - hit.at < 30 * 60 * 1000) return res.json({ tracks: hit.list });
    const jobs = q
      ? [appleSearch(q, 'IN'), deezerSearch(q), audiusTracks(q), appleSearch(q, 'US')]
      : [appleTopIndia(), deezerSearch(''), audiusTracks('')];
    const results = await Promise.allSettled(jobs);
    results.forEach((r, i) => r.status === 'rejected' && console.log(`Music source ${i} error:`, r.reason && r.reason.message));
    const lists = results.map(r => (r.status === 'fulfilled' ? r.value : []));
    // Movie / popular songs first, then independent artists; no repeats of the same song
    const seen = new Set();
    const out = [];
    for (const t of [...lists[0], ...lists[1], ...(lists[3] || []), ...lists[2]]) {
      const key = `${t.title}|${t.artist}`.toLowerCase();
      if (!t.stream || seen.has(key)) continue;
      seen.add(key);
      out.push(t);
      if (out.length >= 60) break;
    }
    musicCache.set(k, { at: Date.now(), list: out });
    if (musicCache.size > 300) musicCache.delete(musicCache.keys().next().value);
    res.json({ tracks: out });
  } catch (e) {
    console.log('Music error:', e.message);
    res.json({ tracks: [] });
  }
});

// ---------- Reset password page (the link in the "Reset your password" email opens this) ----------
const RESET_PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>CIVIX · New password</title>
<style>
body{margin:0;background:#000;color:#fff;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;display:flex;justify-content:center}
main{width:100%;max-width:420px;padding:40px 20px}
h1{font-size:26px;margin:0 0 6px}.logo{font-weight:900;font-size:30px;letter-spacing:2px;margin-bottom:24px}.logo b{color:#FF2D78}
p{color:#aaa;line-height:1.5}input{width:100%;box-sizing:border-box;background:#121212;border:1px solid #333;border-radius:12px;color:#fff;font-size:16px;padding:14px;margin:8px 0}
button{width:100%;border:0;border-radius:14px;padding:15px;font-size:16px;font-weight:800;color:#fff;background:linear-gradient(45deg,#FF8A00,#FF2D78 55%,#7B2FF7);margin-top:12px}
ul{list-style:none;padding:0;margin:6px 0;color:#8E8E93;font-size:14px}li.ok{color:#34D399}.msg{margin-top:16px;font-weight:700}.err{color:#FF453A}.good{color:#34D399}
</style></head><body><main>
<div class="logo">CIVIX<b>.</b></div>
<div id="box"><h1>Choose a new password</h1><p>Type your new password two times.</p>
<input id="p1" type="password" placeholder="New password" autocomplete="new-password">
<input id="p2" type="password" placeholder="Type it again" autocomplete="new-password">
<ul id="rules"></ul><button id="go">Save new password</button></div>
<div id="msg" class="msg"></div>
</main><script>
var URL_='${SUPABASE_URL}',KEY='${SUPABASE_KEY}';
var h=new URLSearchParams(location.hash.slice(1)),q=new URLSearchParams(location.search);
var token=h.get('access_token');var msg=document.getElementById('msg'),box=document.getElementById('box');
var R=[['At least 8 characters',function(p){return p.length>=8}],['A capital letter (A–Z)',function(p){return /[A-Z]/.test(p)}],['A small letter (a–z)',function(p){return /[a-z]/.test(p)}],['A number (0–9)',function(p){return /[0-9]/.test(p)}],['A symbol, like ! @ # $ %',function(p){return /[^A-Za-z0-9]/.test(p)}]];
function draw(){var p=document.getElementById('p1').value;document.getElementById('rules').innerHTML=R.map(function(r){return '<li class="'+(r[1](p)?'ok':'')+'">'+(r[1](p)?'✓ ':'○ ')+r[0]+'</li>'}).join('')}
document.getElementById('p1').oninput=draw;draw();
if(!token){box.style.display='none';msg.className='msg err';msg.textContent=(h.get('error_description')||q.get('error_description')||'This link is not valid or has expired.')+' Open CIVIX and tap "Forgot password?" again to get a new email.';}
history.replaceState(null,'',location.pathname);
document.getElementById('go').onclick=function(){var a=document.getElementById('p1').value,b=document.getElementById('p2').value;
if(!R.every(function(r){return r[1](a)})){msg.className='msg err';msg.textContent='Make the password stronger (see the list).';return}
if(a!==b){msg.className='msg err';msg.textContent='The two passwords are not the same.';return}
msg.className='msg';msg.textContent='Saving…';
fetch(URL_+'/auth/v1/user',{method:'PUT',headers:{apikey:KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({password:a})})
.then(function(r){return r.json().then(function(j){return {ok:r.ok,j:j}})})
.then(function(x){if(x.ok){box.style.display='none';msg.className='msg good';msg.textContent='✓ Password changed. Open CIVIX and sign in with your new password.';}
else{msg.className='msg err';msg.textContent=(x.j&&(x.j.msg||x.j.message||x.j.error_description))||'Could not save. The link may have expired.';}})
.catch(function(){msg.className='msg err';msg.textContent='No internet? Please try again.'});};
</script></body></html>`;
app.get('/reset', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'no-referrer');
  res.type('html').send(RESET_PAGE);
});

app.get('/', (req, res) => res.send('CIVIX server is running'));

refresh();
refreshReels();
refreshYoutube();
refreshYoutubeSearch();
refreshCreators();
startMoreSources();

// ============================================================
// PART 2: Search the internet + "All in one" (weather, prayer, scores, trailers, memes, jobs, prices)
// Everything here is free and needs no keys. Ask CIVIX AI uses ANTHROPIC_API_KEY only if you add it in Render.
// ============================================================
const hubCache = new Map();
async function cached(key, ms, fn) {
  const hit = hubCache.get(key);
  if (hit && Date.now() - hit.at < ms) return hit.value;
  const value = await fn();
  // Do not remember failures or empty results (try again next time)
  const empty = v => v == null || v.error || (Array.isArray(v) && !v.length)
    || (v.q && !v.ai && !v.wiki && !(v.news || []).length && !(v.videos || []).length)
    || (v.cricket && !v.cricket.length && !v.football.length);
  if (!empty(value)) hubCache.set(key, { at: Date.now(), value });
  if (hubCache.size > 500) hubCache.delete(hubCache.keys().next().value);
  return value;
}
const BROWSER = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36', 'Accept-Language': 'en' };
async function getText(url, headers = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 15000);
  try {
    const r = await fetch(url, { headers: { ...BROWSER, ...headers }, signal: controller.signal });
    if (!r.ok) throw new Error(`status ${r.status}`);
    return await r.text();
  } finally {
    clearTimeout(t);
  }
}
const hubTries = new Map();
function hubTooMany(req) {
  const ip = String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
  const now = Date.now();
  const list = (hubTries.get(ip) || []).filter(t => now - t < 60 * 1000);
  list.push(now);
  hubTries.set(ip, list);
  if (hubTries.size > 5000) hubTries.clear();
  return list.length > 30;
}
const cleanQ = q => String(q || '').replace(/\s+/g, ' ').trim().slice(0, 120);

// ---------- YouTube video search (shorts + normal videos), free, no key ----------
async function youtubeSearch(q, shortsOnly) {
  const sp = shortsOnly ? '&sp=EgIYAQ%253D%253D' : '';
  const html = await getText(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}${sp}&hl=en`);
  const m = /var ytInitialData = (\{.*?\});<\/script>/s.exec(html);
  if (!m) return [];
  const data = JSON.parse(m[1]);
  const out = [];
  const seen = new Set();
  const walk = o => {
    if (!o || typeof o !== 'object' || out.length >= 40) return;
    const v = o.videoRenderer;
    if (v && v.videoId && !seen.has(v.videoId)) {
      seen.add(v.videoId);
      const title = (v.title && ((v.title.runs || []).map(x => x.text).join('') || v.title.simpleText)) || '';
      const ch = (v.ownerText && (v.ownerText.runs || [])[0]) || {};
      const live = !!(v.badges || []).find(b => JSON.stringify(b).includes('LIVE'));
      if (!live && safeText(title)) {
        out.push({ id: v.videoId, title, channel: ch.text || 'YouTube', channelId: ch.navigationEndpoint && ch.navigationEndpoint.browseEndpoint && ch.navigationEndpoint.browseEndpoint.browseId });
      }
      return;
    }
    const r = o.reelItemRenderer || (o.shortsLockupViewModel && o.shortsLockupViewModel.onTap && o.shortsLockupViewModel);
    if (o.reelItemRenderer && r.videoId && !seen.has(r.videoId)) {
      seen.add(r.videoId);
      const title = (r.headline && r.headline.simpleText) || '';
      if (safeText(title)) out.push({ id: r.videoId, title, channel: 'YouTube Shorts' });
      return;
    }
    if (o.shortsLockupViewModel) {
      const vm = o.shortsLockupViewModel;
      const id = vm.onTap && vm.onTap.innertubeCommand && vm.onTap.innertubeCommand.reelWatchEndpoint && vm.onTap.innertubeCommand.reelWatchEndpoint.videoId;
      const title = (vm.overlayMetadata && vm.overlayMetadata.primaryText && vm.overlayMetadata.primaryText.content) || '';
      if (id && !seen.has(id) && safeText(title)) {
        seen.add(id);
        out.push({ id, title, channel: 'YouTube Shorts' });
      }
      return;
    }
    for (const k in o) walk(o[k]);
  };
  walk(data);
  return rssToReels(out.map(x => ({ ...x, publishedAt: new Date().toISOString() })), { language: 'any', country: 'World', category: 'Entertainment', kind: 'creator' });
}

app.get('/api/video-search', async (req, res) => {
  const q = cleanQ(req.query.q);
  if (q.length < 2) return res.json({ items: [] });
  try {
    const items = await cached(`vs:${q.toLowerCase()}:${req.query.shorts ? 1 : 0}`, 30 * 60 * 1000, async () => {
      const [shorts, normal] = await Promise.all([
        youtubeSearch(q, true).catch(() => []),
        req.query.shorts ? Promise.resolve([]) : youtubeSearch(q, false).catch(() => []),
      ]);
      const seen = new Set();
      return [...shorts, ...normal].filter(a => !seen.has(a.id) && seen.add(a.id)).slice(0, 50);
    });
    res.json({ items });
  } catch (e) {
    res.json({ items: [], error: 'Could not search videos right now' });
  }
});

// ---------- Google News search (topic news, fact check, jobs, prices) ----------
async function newsSearch(q, lang = 'en', country = 'IN') {
  const hl = lang === 'en' ? `en-${country}` : lang;
  const feed = await parser.parseURL(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=${hl}&gl=${country}&ceid=${country}:${lang}`);
  return (feed.items || []).slice(0, 25).map(it => {
    const parts = String(it.title || '').split(' - ');
    const source = parts.length > 1 ? parts.pop() : 'News';
    return {
      id: md5('gn:' + (it.link || it.title)),
      title: parts.join(' - '),
      description: '',
      link: it.link,
      publishedAt: new Date(it.isoDate || it.pubDate || Date.now()).toISOString(),
      source,
      category: 'World',
      language: lang,
    };
  });
}

app.get('/api/topic-news', async (req, res) => {
  const q = cleanQ(req.query.q);
  if (q.length < 2) return res.json({ items: [] });
  const lang = /^[a-z]{2}$/.test(String(req.query.lang || '')) ? String(req.query.lang) : 'en';
  const country = /^[A-Z]{2}$/.test(String(req.query.country || '')) ? String(req.query.country) : 'IN';
  try {
    const items = await cached(`tn:${q}:${lang}:${country}`, 20 * 60 * 1000, () => newsSearch(q, lang, country));
    res.json({ items });
  } catch {
    res.json({ items: [], error: 'News search is not available right now' });
  }
});

// ---------- Wikipedia summary ----------
async function wikiSummary(q) {
  const s = await getJson(`https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(q)}&limit=1&namespace=0&format=json`);
  const title = s && s[1] && s[1][0];
  if (!title) return null;
  const p = await getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
  if (!p || !p.extract) return null;
  return {
    title: p.title,
    text: p.extract,
    image: p.thumbnail && p.thumbnail.source,
    link: (p.content_urls && p.content_urls.mobile && p.content_urls.mobile.page) || `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
    source: 'Wikipedia',
  };
}

// ---------- Ask CIVIX: answer + videos + news ----------
async function aiAnswer(q, wiki, news) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const context = [
    wiki ? `Wikipedia: ${wiki.text}` : '',
    ...news.slice(0, 6).map(n => `News (${n.source}): ${n.title}`),
  ].filter(Boolean).join('\n');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Answer this question for a social app user in simple English, in at most 6 short sentences. Use the context when it helps. If you are not sure, say so.\n\nContext:\n${context}\n\nQuestion: ${q}`,
      }],
    }),
  });
  if (!r.ok) return null;
  const j = await r.json();
  const text = (j.content || []).map(c => c.text || '').join('').trim();
  return text || null;
}

app.get('/api/ask', async (req, res) => {
  const q = cleanQ(req.query.q);
  if (q.length < 2) return res.json({});
  if (hubTooMany(req)) return res.status(429).json({ error: 'Too many searches. Please wait a minute.' });
  try {
    const out = await cached(`ask:${q.toLowerCase()}`, 30 * 60 * 1000, async () => {
      const [wiki, news, videos] = await Promise.all([
        wikiSummary(q).catch(() => null),
        newsSearch(q).catch(() => []),
        youtubeSearch(q, false).catch(() => []),
      ]);
      const ai = await aiAnswer(q, wiki, news).catch(() => null);
      return { q, ai, wiki, news: news.slice(0, 12), videos: videos.slice(0, 30) };
    });
    res.json(out);
  } catch {
    res.json({ q, error: 'Search is not available right now' });
  }
});

// ---------- Weather (Open-Meteo, free) ----------
const WEATHER_CODES = {
  0: ['Clear sky', '☀️'], 1: ['Mostly clear', '🌤️'], 2: ['Partly cloudy', '⛅'], 3: ['Cloudy', '☁️'], 45: ['Fog', '🌫️'], 48: ['Fog', '🌫️'],
  51: ['Light drizzle', '🌦️'], 53: ['Drizzle', '🌦️'], 55: ['Drizzle', '🌧️'], 61: ['Light rain', '🌦️'], 63: ['Rain', '🌧️'], 65: ['Heavy rain', '🌧️'],
  71: ['Snow', '🌨️'], 73: ['Snow', '🌨️'], 75: ['Heavy snow', '❄️'], 80: ['Showers', '🌦️'], 81: ['Showers', '🌧️'], 82: ['Heavy showers', '⛈️'],
  95: ['Thunderstorm', '⛈️'], 96: ['Thunderstorm', '⛈️'], 99: ['Thunderstorm', '⛈️'],
};
async function findCity(city) {
  const g = await getJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
  return g && g.results && g.results[0];
}
app.get('/api/weather', async (req, res) => {
  const city = cleanQ(req.query.city);
  if (city.length < 2) return res.json({ error: 'Type your city' });
  try {
    const out = await cached(`w:${city.toLowerCase()}`, 20 * 60 * 1000, async () => {
      const c = await findCity(city);
      if (!c) return { error: 'City not found' };
      const w = await getJson(`https://api.open-meteo.com/v1/forecast?latitude=${c.latitude}&longitude=${c.longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=5`);
      const cur = w.current || {};
      const [text, icon] = WEATHER_CODES[cur.weather_code] || ['Weather', '🌡️'];
      const d = w.daily || {};
      return {
        city: c.name, country: c.country, temp: Math.round(cur.temperature_2m), feels: Math.round(cur.apparent_temperature),
        humidity: cur.relative_humidity_2m, wind: Math.round(cur.wind_speed_10m), text, icon,
        days: (d.time || []).map((t, i) => ({ date: t, max: Math.round(d.temperature_2m_max[i]), min: Math.round(d.temperature_2m_min[i]), icon: (WEATHER_CODES[d.weather_code[i]] || ['', '🌡️'])[1] })),
      };
    });
    res.json(out);
  } catch {
    res.json({ error: 'Weather is not available right now' });
  }
});

// ---------- Prayer times + Hijri date (Aladhan, free) ----------
app.get('/api/prayer', async (req, res) => {
  const city = cleanQ(req.query.city);
  if (city.length < 2) return res.json({ error: 'Type your city' });
  try {
    const out = await cached(`p:${city.toLowerCase()}:${new Date().toISOString().slice(0, 10)}`, 3 * 60 * 60 * 1000, async () => {
      const c = await findCity(city);
      if (!c) return { error: 'City not found' };
      const j = await getJson(`https://api.aladhan.com/v1/timings?latitude=${c.latitude}&longitude=${c.longitude}&method=${c.country_code === 'IN' ? 1 : 4}`);
      const t = (j.data && j.data.timings) || {};
      const h = j.data && j.data.date && j.data.date.hijri;
      return {
        city: c.name,
        times: ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].map(n => ({ name: n, time: String(t[n] || '').slice(0, 5) })),
        hijri: h ? `${h.day} ${h.month && h.month.en} ${h.year} AH` : '',
      };
    });
    res.json(out);
  } catch {
    res.json({ error: 'Prayer times are not available right now' });
  }
});

// ---------- Live scores (cricket + football) ----------
async function cricketScores() {
  const feed = await parser.parseURL('https://static.cricinfo.com/rss/livescores.xml');
  return (feed.items || []).slice(0, 15).map(it => ({ title: stripHtml(it.title || ''), link: it.link, sport: 'cricket' }));
}
async function footballScores() {
  const leagues = ['eng.1', 'esp.1', 'uefa.champions', 'ita.1', 'ger.1', 'ind.1'];
  const out = [];
  await Promise.all(leagues.map(async lg => {
    try {
      const j = await getJson(`https://site.api.espn.com/apis/site/v2/sports/soccer/${lg}/scoreboard`);
      for (const ev of j.events || []) {
        const comp = (ev.competitions || [])[0] || {};
        const teams = (comp.competitors || []).map(c => `${(c.team && (c.team.shortDisplayName || c.team.displayName)) || ''} ${c.score ?? ''}`.trim());
        const st = (ev.status && ev.status.type) || {};
        out.push({ title: teams.join('  –  '), status: st.shortDetail || st.description || '', live: st.state === 'in', league: (j.leagues && j.leagues[0] && j.leagues[0].abbreviation) || lg, sport: 'football', date: ev.date });
      }
    } catch { }
  }));
  out.sort((a, b) => Number(b.live) - Number(a.live) || String(a.date).localeCompare(String(b.date)));
  return out.slice(0, 25);
}
app.get('/api/scores', async (req, res) => {
  const out = await cached('scores', 2 * 60 * 1000, async () => {
    const [cricket, football] = await Promise.all([cricketScores().catch(() => []), footballScores().catch(() => [])]);
    return { cricket, football, at: new Date().toISOString() };
  });
  res.json(out);
});

// ---------- Trailers (newest official trailers) ----------
app.get('/api/trailers', async (req, res) => {
  const lang = { te: 'telugu', hi: 'hindi', en: 'english', ta: 'tamil', ml: 'malayalam', kn: 'kannada' }[String(req.query.lang || 'te')] || 'telugu';
  try {
    const items = await cached(`tr:${lang}`, 3 * 60 * 60 * 1000, async () => {
      const list = await youtubeSearch(`${lang} movie official trailer ${new Date().getFullYear()}`, false);
      return list.filter(a => /trailer|teaser|glimpse/i.test(a.title)).slice(0, 30).map(a => ({ ...a, category: 'Movies' }));
    });
    res.json({ items });
  } catch {
    res.json({ items: [] });
  }
});

// ---------- Memes (Lemmy meme communities, safe only) ----------
app.get('/api/memes', async (req, res) => {
  try {
    const items = await cached('memes', 30 * 60 * 1000, async () => {
      const out = [];
      for (const c of ['memes@lemmy.ml', 'memes@lemmy.world', 'wholesomememes@lemmy.world']) {
        try {
          const j = await getJson(`https://lemmy.world/api/v3/post/list?community_name=${encodeURIComponent(c)}&sort=Hot&limit=30`);
          for (const pv of j.posts || []) {
            const p = pv.post || {};
            if (!p.url || p.nsfw || p.removed || p.deleted || !/\.(jpe?g|png|webp|gif)(\?|$)/i.test(p.url) || !safeText(p.name)) continue;
            out.push({ id: `meme-${p.id}`, title: firstLine(p.name), imageUrl: p.url, thumbUrl: p.thumbnail_url || p.url, link: p.ap_id, source: c.split('@')[0], provider: 'lemmy', type: 'photo', credit: `From c/${c} on Lemmy` });
          }
        } catch { }
      }
      return shuffle(out).slice(0, 60);
    });
    res.json({ items });
  } catch {
    res.json({ items: [] });
  }
});

// ---------- Translate (free Google endpoint) ----------
app.post('/api/translate', async (req, res) => {
  const text = String((req.body && req.body.text) || '').slice(0, 1500);
  const to = /^[a-z]{2}(-[A-Z]{2})?$/.test(String(req.body && req.body.to)) ? req.body.to : 'en';
  if (!text.trim()) return res.json({ text: '' });
  if (hubTooMany(req)) return res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
  try {
    const out = await cached(`tr:${to}:${md5(text)}`, 24 * 60 * 60 * 1000, async () => {
      const j = await getJson(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${to}&dt=t&q=${encodeURIComponent(text)}`);
      return { text: (j[0] || []).map(p => p[0]).join(''), from: j[2] || '' };
    });
    res.json(out);
  } catch {
    res.json({ error: 'Translate is not available right now' });
  }
});

// ---------- Profile links: https://…/u/<username> (opens CIVIX if installed) ----------
app.get('/u/:name', (req, res) => {
  const name = String(req.params.name || '').toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 20);
  res.set('Content-Type', 'text/html; charset=utf-8').send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>@${name} on CIVIX</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#000;color:#fff;font-family:-apple-system,Segoe UI,Roboto,sans-serif;text-align:center}
.c{padding:28px}.l{width:84px;height:84px;border-radius:24px;margin:0 auto 18px;background:linear-gradient(45deg,#FF8A00,#FF2D78 55%,#7B2FF7);display:flex;align-items:center;justify-content:center;font-size:44px;font-weight:900}
a{display:inline-block;margin-top:18px;background:#FF2D78;color:#fff;text-decoration:none;font-weight:800;padding:14px 26px;border-radius:14px}p{color:#aaa}</style></head>
<body><div class="c"><div class="l">C</div><h2>@${name}</h2><p>is on CIVIX – reels, news, chats and calls in one app.</p>
<a href="civix://u/${name}">Open in CIVIX</a><p style="margin-top:22px;font-size:13px">Don't have CIVIX yet? Ask @${name} to send you the app.</p></div>
<script>setTimeout(function(){location.href='civix://u/${name}'},300)</script></body></html>`);
});

// ---------- Scheduled chat messages: send the ones whose time has come (every minute) ----------
async function sendDueMessages() {
  if (!SUPABASE_SECRET_KEY) return;
  try {
    const headers = { apikey: SUPABASE_SECRET_KEY, 'Content-Type': 'application/json' };
    if (SUPABASE_SECRET_KEY.startsWith('eyJ')) headers.Authorization = `Bearer ${SUPABASE_SECRET_KEY}`;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/send_due_messages`, { method: 'POST', headers, body: '{}' });
    if (r.ok) {
      const n = await r.json();
      if (n) console.log(`Scheduled messages sent: ${n}`);
    }
  } catch { }
}
setInterval(sendDueMessages, 60 * 1000);

app.listen(process.env.PORT || 4000, '0.0.0.0', () => console.log('CIVIX server running'));
