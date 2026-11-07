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
  ['TRT World', 'UC7fWeaHhqgM4Ry-RMpZKQEA', 'en', 'World', 'World'],
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
  ['PewDiePie', 'UC-lHJZR3Gqxm24_Vd_AJ5Yw', 'en', 'World', 'Gaming'],
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

async function fetchChannelShorts([name, channelId, language, country, category]) {
  const playlistId = 'UUSH' + channelId.slice(2); // the channel's Shorts list
  const list = await ytGet(`playlistItems?part=snippet&maxResults=20&playlistId=${playlistId}`);
  const items = (list.items || [])
    .map(it => it.snippet || {})
    .filter(sn => sn.resourceId && sn.resourceId.videoId && sn.title !== 'Private video' && sn.title !== 'Deleted video')
    .map(sn => ({ id: sn.resourceId.videoId, title: sn.title, publishedAt: sn.publishedAt, channel: name, channelId }));
  return toYoutubeReels(items, { language, country, category, kind: category === 'World' ? 'news' : 'creator' });
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
    if (!YT_API_KEY) return;
    const results = await runLimited(CREATOR_CHANNELS, 4, fetchChannelShorts);
    const all = [];
    const failed = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') all.push(...r.value);
      else {
        failed.push(CREATOR_CHANNELS[i][0]);
        console.log(`  x creator "${CREATOR_CHANNELS[i][0]}": ${r.reason.message}`);
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
  if (all.length) {
    more.unsplash = { at: Date.now(), photos: all };
    saveMore();
  }
  console.log(`Unsplash: ${all.length} photos`);
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
function moreVideos() {
  return [
    ...more.dailymotion.items,
    ...more.vimeo.items,
    ...more.bluesky.items,
    ...more.mastodon.items,
    ...more.nasa.items,
  ];
}

// Photos and posts for Home "Discover" and the Explore grid
app.get('/api/discover', (req, res) => {
  const max = Math.min(Number(req.query.limit) || 60, 200);
  let photos = [...more.unsplash.photos, ...more.bluesky.photos, ...more.mastodon.photos];
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
async function searchYoutubeChannels(q) {
  if (!YT_API_KEY) return [];
  const hit = channelSearchCache.get(q);
  if (hit && Date.now() - hit.at < 24 * 3600 * 1000) return hit.list;
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
  for (const prefix of ['UUSH', 'UU']) { // Shorts list first, then all uploads
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
      list = list.filter(p => key(p.name).includes(q) || key(p.category).includes(q));
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
    if (cid && reelsList.length < 8 && YT_API_KEY) {
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
app.post('/api/notify', async (req, res) => {
  try {
    const auth = String(req.headers.authorization || '');
    const type = String((req.body && req.body.type) || '');
    const id = String((req.body && req.body.id) || '');
    if (!/^Bearer \S+$/.test(auth)) return res.status(401).json({ error: 'Please sign in' });
    if (!['message', 'call', 'like', 'comment', 'follow'].includes(type) || !/^[0-9a-f-]{36}$/i.test(id)) {
      return res.status(400).json({ error: 'Bad request' });
    }
    // The database checks that this person really sent this message / is making this call
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/push_targets`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: type, target_id: id }),
    });
    const rows = r.ok ? await r.json() : [];
    if (!Array.isArray(rows) || !rows.length) return res.json({ sent: 0 });

    const messages = rows.slice(0, 20).map(x => ({
      to: x.token,
      title: x.title,
      body: x.body,
      sound: 'default',
      priority: 'high',
      channelId: type === 'call' ? 'calls' : type === 'message' ? 'messages' : 'activity',
      data: { type, ref: x.ref },
    }));
    const sent = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    if (!sent.ok) console.log('Push error:', sent.status, await sent.text());
    res.json({ sent: messages.length });
  } catch (e) {
    console.error('notify error:', e);
    res.status(500).json({ error: 'Could not send the notification' });
  }
});

app.get('/', (req, res) => res.send('CIVIX server is running'));

refresh();
refreshReels();
refreshYoutube();
refreshYoutubeSearch();
refreshCreators();
startMoreSources();
app.listen(process.env.PORT || 4000, '0.0.0.0', () => console.log('CIVIX server running'));
