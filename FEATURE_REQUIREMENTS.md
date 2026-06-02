# Chatrix Telegram API — Feature Requirements Document

## 1. Channel Toggle UI (Channel On/Off Management)

### Goal
A web-based dashboard to enable/disable which channels are actively monitored and included in the unified feed. Disabled channels are excluded from fetching, real-time listening, and the unified endpoint.

### Requirements
- **Serve a static dashboard page** from Express at route `/dashboard`
- Dashboard shows all registered channels with:
  - Channel name, username, telegram ID
  - Toggle switch (on/off) for each channel
  - Status indicator (active/inactive)
  - Last message timestamp (if available)
- **Channel state persistence** in `channel_registry.json` — add `enabled` boolean field per channel
- **API endpoints** for toggling:
  - `PATCH /channels/:uid/toggle` — toggle enabled/disabled
  - `GET /channels/state` — get all channels with their enabled state
- When a channel is **disabled**:
  - Excluded from `GET /feed` (unified endpoint)
  - Excluded from real-time SSE events
  - Still visible in registry, just marked inactive
- When a channel is **enabled**:
  - Included in all feeds and real-time events
  - Messages are fetched and processed normally

### UI Design (Static HTML + Vanilla JS)
- Single `dashboard.html` file served by Express
- Minimal CSS (inline or separate file), dark theme preferred
- Fetch channel state from `/channels/state` on load
- Toggle switches call `PATCH /channels/:uid/toggle` on change
- Auto-refresh feed preview below the toggles
- Responsive layout, works on mobile

### File Structure
```
src/
  routes/
    dashboard.js          — serves static dashboard HTML
  public/
    dashboard.html        — the UI page
    dashboard.css         — styles (optional, can be inline)
    dashboard.js          — client-side JS for toggles and feed
```

---

## 2. Unified Feed Endpoint

### Goal
One endpoint that aggregates messages from **all enabled channels**, sorted by time (descending — newest first).

### Endpoint
```
GET /feed
```

### Query Parameters
| Param     | Type    | Default | Description                                      |
|-----------|---------|---------|--------------------------------------------------|
| `limit`   | integer | 50      | Max messages to return (max: 200)                 |
| `hours`   | integer | 1       | Look back window in hours (fetches messages from the last N hours from all enabled channels) |
| `channel` | string  | —       | Optional: comma-separated UIDs to filter to specific channels |

### Response Format
```json
{
  "success": true,
  "data": [
    {
      "id": 12345,
      "channelUid": 1,
      "channelName": "RT Arabic - عاجل",
      "channelUsername": "RTarabic_br",
      "date": 1717200000,
      "text": "Breaking news headline here",
      "replyTo": null,
      "forwardFrom": null,
      "isDuplicate": false,
      "duplicateOf": null,
      "originalChannel": null
    }
  ],
  "meta": {
    "totalFetched": 150,
    "duplicatesRemoved": 12,
    "uniqueReturned": 50,
    "channelsSourced": [1, 2, 4, 5],
    "windowHours": 1
  }
}
```

### Behavior
1. Fetch messages from all **enabled** channels within the look-back window (`hours` param)
2. Run the **deduplication engine** (Section 3) to detect cross-channel duplicates
3. Mark duplicates with `isDuplicate: true`, `duplicateOf: <originalMessageId>`, `originalChannel: <uid>`
4. Sort all unique + original messages by `date` descending
5. Return up to `limit` messages with deduplication metadata
6. Include `meta` object with statistics about deduplication

### Implementation Notes
- Fetch messages concurrently from all enabled channels (use `Promise.all`)
- Each channel fetch uses the existing `getMessages()` service with time-based filtering
- The `hours` parameter controls how far back to look (default 1 hour for real-time news)
- Cache recent messages in memory (LRU cache, TTL = 2x the look-back window) to avoid re-fetching

---

## 3. Advanced Detection & Deduplication System

This is the core intelligence layer. Three subsystems:

### 3A. Enhanced Emoji & Symbol Removal

#### Current State
Basic emoji regex exists in `src/services/messages.js:4`.

#### Enhancements Needed
- Use the **`emoji-regex`** npm package — it is the most comprehensive, maintained by the Unicode consortium data, covers all emoji versions including ZWJ sequences, flag sequences, and tag sequences
- Also remove:
  - **Arabic decorative symbols** — ﷽ (Bismillah), ۞, ﷲ, ﷳ, etc.
  - **Zero-width characters** — ZWJ (\u200D), ZWNJ (\u200C), variation selectors (\uFE0F, \uFE0E)
  - **RTL/LTR marks** — \u200F, \u200E
  - **Arabic tatweel** — \u0640 (kashida/tatweel stretching character)
  - **Newsletter channel markers** — common prefixes like ⚡, 🔴, 📢, 📰, ‼️, ⁉️, 〖〗, 【】, «» used as decorative markers in news channels

#### Libraries
- **`emoji-regex`** — npm package, comprehensive Unicode emoji regex
- **Custom Arabic symbol regex** — for decorative/ornamental Unicode chars

#### Implementation
```javascript
// src/services/textProcessor.js

const emojiRegex = require("emoji-regex/RGI_Emoji.js");

const ARABIC_DECORATIVE_REGEX = /[\u0640\uFDFF\uFDF0\uFDF1\uFDF2\uFDF3\uFDF4\uFDFD\uFDE0-\uFDEF\u200C\u200E\u200F\uFE0E\uFE0F\u200D]/g;

const NEWS_MARKER_REGEX = /[⚡🔴📢📰‼⁉〖〗【】«»▶◀►◄●○◆◇★☆✦✧✪✫✬✭✮✯✰]/gu;

function cleanText(text) {
  return text
    .replace(emojiRegex, "")
    .replace(ARABIC_DECORATIVE_REGEX, "")
    .replace(NEWS_MARKER_REGEX, "")
    .replace(/\s+/g, " ")
    .trim();
}
```

### 3B. Arabic Text Normalization

#### Goal
Normalize Arabic text so that different spellings/encodings of the same word are treated as identical. This is critical for deduplication because Arabic news channels often publish the same news with slightly different text.

#### Arabic Special Cases to Handle

| Case                    | Description                                                         | Example                                      |
|-------------------------|---------------------------------------------------------------------|----------------------------------------------|
| **Alef variants**       | أ, إ, آ, ٱ all normalize to ا                                      | إسرائيل → اسرائيل, ألمانيا → المانيا          |
| **Tashkeel/Diacritics** | Remove all fatha, damma, kasra, shadda, sukun, tanwin              | قَصْفٌ → قصف                                  |
| **Ya variants**         | ى (alef maqsura) normalizes to ي                                   | مصرى → مصري                                  |
| **Hamza**               | ء standalone hamza removed in middle of words                       | قراءة → قراة (then cleaned further)          |
| **Kashida/Tatweel**     | Already removed in 3A — \u0640                                     | عاـــــــــد → عاد                            |
| **Ligatures**           | ﷲ → الله, ﷳ → محمد, ﷽ → Bismillah (expand then normalize)          | ﷲ → الله                                      |
| **Number normalization** | Arabic-Indic digits ٠١٢٣٤٥٦٧٨٩ → 0123456789                      | ٣ جنود → 3 جنود                              |
| **Punctuation cleanup** | Remove Arabic-specific decorative punctuation                       | ...،... → ،                                  |

#### Implementation
```javascript
// src/services/textProcessor.js (addition)

const TASHKEEL_REGEX = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g;

const ALEF_VARIANTS = { "\u0623": "\u0627", "\u0625": "\u0627", "\u0622": "\u0627", "\u0671": "\u0627" };
const YA_NORMALIZE = { "\u0649": "\u064A" };

const ARABIC_INDIC_DIGITS = { "\u0660":"0","\u0661":"1","\u0662":"2","\u0663":"3","\u0664":"4","\u0665":"5","\u0666":"6","\u0667":"7","\u0668":"8","\u0669":"9" };

const LIGATURES = { "\uFDF2": "\u0627\u0644\u0644\u0647", "\uFDF3": "\u0645\u062D\u0645\u062F" };

function normalizeArabic(text) {
  let result = text;

  for (const [lig, expanded] of Object.entries(LIGATURES)) {
    result = result.replace(lig, expanded);
  }

  result = result.replace(TASHKEEL_REGEX, "");

  for (const [variant, base] of Object.entries(ALEF_VARIANTS)) {
    result = result.replace(variant, base);
  }

  for (const [ya, normalized] of Object.entries(YA_NORMALIZE)) {
    result = result.replace(ya, normalized);
  }

  for (const [arabicDigit, latinDigit] of Object.entries(ARABIC_INDIC_DIGITS)) {
    result = result.replace(arabicDigit, latinDigit);
  }

  return result.replace(/\s+/g, " ").trim();
}

function processText(text) {
  return normalizeArabic(cleanText(text));
}
```

### 3C. Cross-Channel Duplicate Detection Engine

#### Goal
Detect when multiple channels publish the **same news story** within a configurable time window (default: 1 hour). This prevents sending the same news multiple times to the client.

#### Approach — Multi-Layer Deduplication

**Layer 1: Exact Match (Fast)**
- After `processText()`, compare normalized text strings exactly
- If two messages have identical `processedText`, they are duplicates
- The earlier message (by `date`) is the "original"

**Layer 2: Fuzzy Similarity (Medium)**
- For messages that aren't exact matches, compute **cosine similarity** using TF-IDF
- Use the **`natural`** npm package — provides TF-IDF and cosine similarity out of the box
- Threshold: similarity ≥ 0.75 → flagged as duplicate
- Arabic normalization ensures similar stories with different spellings get caught

**Layer 3: Keyword Extraction (Advanced)**
- Extract key entities (numbers, location names, person names) from each message
- If two messages share ≥ 3 key entities AND are within the time window → flagged as duplicate
- This catches cases like:
  - Channel A: "3 soldiers killed in southern Lebanon"
  - Channel B: "Lebanon: three troops die in south" 
  - Different wording, same story

#### Time Window
- Default: 1 hour (3600 seconds)
- Configurable via `DEDUP_WINDOW_HOURS` env var
- Only compare messages within the same time window

#### Data Structure
```javascript
// src/services/dedupEngine.js

class DedupEngine {
  constructor(windowHours = 1, similarityThreshold = 0.75) {
    this.windowHours = windowHours;
    this.similarityThreshold = similarityThreshold;
    this.messageStore = new Map(); // processedText → { messageId, channelUid, date, originalText }
  }

  checkDuplicate(processedText, channelUid, date) {
    // Layer 1: exact match
    const exactMatch = this.messageStore.get(processedText);
    if (exactMatch && Math.abs(date - exactMatch.date) <= this.windowHours * 3600) {
      return { isDuplicate: true, duplicateOf: exactMatch.messageId, originalChannel: exactMatch.channelUid };
    }

    // Layer 2: fuzzy similarity (iterate nearby messages in time window)
    for (const [key, stored] of this.messageStore.entries()) {
      if (Math.abs(date - stored.date) > this.windowHours * 3600) continue;
      const similarity = computeCosineSimilarity(processedText, key);
      if (similarity >= this.similarityThreshold) {
        return { isDuplicate: true, duplicateOf: stored.messageId, originalChannel: stored.channelUid, similarity };
      }
    }

    // No duplicate found — register this message
    this.messageStore.set(processedText, { messageId, channelUid, date, originalText });
    return { isDuplicate: false };
  }

  cleanup(date) {
    // Remove messages older than 2x the window to prevent unbounded growth
    const cutoff = date - this.windowHours * 3600 * 2;
    for (const [key, stored] of this.messageStore.entries()) {
      if (stored.date < cutoff) this.messageStore.delete(key);
    }
  }
}
```

#### Libraries
| Library          | Purpose                              | npm install              |
|------------------|--------------------------------------|--------------------------|
| `natural`        | TF-IDF, cosine similarity, NLP       | `npm install natural`    |
| `emoji-regex`    | Comprehensive emoji removal           | `npm install emoji-regex`|

#### Why `natural` over alternatives
- Pure JavaScript, no native dependencies — works on Windows
- Has `TfIdf` class for keyword extraction
- Has `StringDistance` (Jaro-Winkler) for fuzzy matching
- Has cosine similarity computation
- Well-maintained, widely used in Node.js NLP projects
- Lightweight, no external API calls needed

---

## 4. Real-time Deduplication

### Goal
The real-time SSE stream (`/realtime/events`) should also apply deduplication so clients don't receive duplicate news.

### Behavior
- When a new message arrives via the Telegram listener, run it through:
  1. `cleanText()` — remove emojis and decorative symbols
  2. `normalizeArabic()` — normalize Arabic special cases
  3. `dedupEngine.checkDuplicate()` — check if this is a duplicate of a recently-seen message
- If it's a duplicate:
  - Emit a `duplicate` event type in SSE instead of `message`
  - Include `duplicateOf` and `originalChannel` in the payload
- If it's unique:
  - Emit a normal `message` event
  - Register it in the dedup engine

### SSE Event Types
```
event: message
data: {"id":12345,"channelUid":1,"channelName":"...","date":...,"text":"...","isDuplicate":false}

event: duplicate
data: {"id":12346,"channelUid":2,"channelName":"...","date":...,"text":"...","isDuplicate":true,"duplicateOf":12345,"originalChannel":1,"similarity":0.82}
```

---

## 5. Configuration Updates

### New `.env` Variables
```
DEDUP_WINDOW_HOURS=1
DEDUP_SIMILARITY_THRESHOLD=0.75
DEDUP_ENABLED=true
FEED_DEFAULT_LIMIT=50
FEED_MAX_LIMIT=200
FEED_DEFAULT_HOURS=1
```

### Config File Updates (`src/config/index.js`)
Add `dedup` and `feed` sections:
```javascript
dedup: {
  enabled: process.env.DEDUP_ENABLED === "true",
  windowHours: parseInt(process.env.DEDUP_WINDOW_HOURS || "1"),
  similarityThreshold: parseFloat(process.env.DEDUP_SIMILARITY_THRESHOLD || "0.75"),
},
feed: {
  defaultLimit: parseInt(process.env.FEED_DEFAULT_LIMIT || "50"),
  maxLimit: parseInt(process.env.FEED_MAX_LIMIT || "200"),
  defaultHours: parseInt(process.env.FEED_DEFAULT_HOURS || "1"),
},
```

### Channel Registry Schema Update
Each channel entry gains `enabled` field:
```json
{
  "1": {
    "telegramId": "-1002448697799",
    "name": "RT Arabic - عاجل",
    "username": "RTarabic_br",
    "enabled": true
  }
}
```

---

## 6. New File Structure

```
src/
  services/
    textProcessor.js        — emoji removal, Arabic normalization, full text processing
    dedupEngine.js          — duplicate detection engine (exact + fuzzy + keyword)
    feedService.js          — unified feed aggregator (fetches from all enabled channels, deduplicates)
    channelRegistry.js      — UPDATED: add enabled/disabled state
    messages.js             — UPDATED: use textProcessor instead of inline emoji regex
    channels.js             — existing (no changes needed)
    media.js                — existing (no changes needed)
  routes/
    feed.js                 — new: GET /feed endpoint
    dashboard.js            — new: serves dashboard HTML
    channels.js             — UPDATED: add PATCH /:uid/toggle, GET /state
    messages.js             — existing
    realtime.js             — UPDATED: emit duplicate events, filter by enabled channels
    media.js                — existing
    health.js               — existing
  public/
    dashboard.html          — dashboard UI
    dashboard.css           — dashboard styles
    dashboard.js            — client-side logic
  config/
    index.js                — UPDATED: add dedup and feed config sections
  realtime/
    listener.js             — UPDATED: filter by enabled channels, run through dedup engine
  client/
    telegram.js             — existing (no changes needed)
```

---

## 7. Implementation Order

| Step | Task                                                          | Files                                       |
|------|---------------------------------------------------------------|---------------------------------------------|
| 1    | Install new dependencies: `natural`, `emoji-regex`            | `package.json`                              |
| 2    | Create `textProcessor.js` — emoji removal + Arabic norm       | `src/services/textProcessor.js`             |
| 3    | Update `channelRegistry.js` — add `enabled` field             | `src/services/channelRegistry.js`           |
| 4    | Create `dedupEngine.js` — duplicate detection engine          | `src/services/dedupEngine.js`               |
| 5    | Create `feedService.js` — unified feed aggregator             | `src/services/feedService.js`               |
| 6    | Create `feed.js` route — GET /feed                            | `src/routes/feed.js`                        |
| 7    | Update `channels.js` route — toggle + state endpoints         | `src/routes/channels.js`                    |
| 8    | Create dashboard static files — HTML/CSS/JS                   | `src/public/dashboard.*`                    |
| 9    | Create `dashboard.js` route — serve static files              | `src/routes/dashboard.js`                   |
| 10   | Update `messages.js` service — use textProcessor              | `src/services/messages.js`                  |
| 11   | Update `realtime/listener.js` — dedup + enabled filter        | `src/realtime/listener.js`                  |
| 12   | Update `realtime.js` route — duplicate event type             | `src/routes/realtime.js`                    |
| 13   | Update `app.js` — mount new routes, serve static              | `src/app.js`                                |
| 14   | Update config — add dedup + feed sections                     | `src/config/index.js`                       |
| 15   | Update `.env.example` — add new env vars                      | `.env.example`                              |
| 16   | Update `API_DOCS.md` — document all new endpoints             | `API_DOCS.md`                               |

---

## 8. Dashboard UI Wireframe

```
┌─────────────────────────────────────────────────────────────┐
│  CHATRIX — Telegram Channel Dashboard                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  CHANNELS                                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 1  RT Arabic - عاجل       @RTarabic_br    [● ON ]  │   │
│  │ 2  قناة الجزيرة           @AjaNews        [● ON ]  │   │
│  │ 3  ليبانون ديبايت          @lebanondebate  [● OFF]  │   │
│  │ 4  قناة الميادين | عاجل    @almayadeen     [● ON ]  │   │
│  │ 5  manarbreaking          @manarbreaking   [● ON ]  │   │
│  │ 6  التلفزيون العربي - عاجل @AlarabyTvBrk   [● OFF]  │   │
│  │ 7  Al-Akhbar              @alakhbar_news   [● ON ]  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  LIVE FEED (Last 1 hour — deduplicated)                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ [12:05] RT Arabic: قصف إسرائيلي على جنوب لبنان     │   │
│  │ [12:03] Al-Akhbar: 3 جنود إسرائيليين قتلوا         │   │
│  │ [12:01] الميادين: ↻ DUPLICATE of msg #12345         │   │
│  │        (same news as RT Arabic, similarity 82%)      │   │
│  │ [11:58] الجزيرة: محادثات رسمية حول وقف إطلاق النار │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  Stats: 5 channels active | 23 messages | 3 duplicates     │
│         removed in last hour                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. Key Design Decisions

1. **No external AI APIs** — all deduplication runs locally using `natural` package. No latency, no cost, no dependency on external services.

2. **Arabic-first design** — normalization specifically targets Arabic text characteristics because all current channels are Arabic news channels.

3. **Three-layer dedup** — exact match is O(1) via HashMap, fuzzy is O(n) but bounded by time window (typically <50 messages), keyword extraction is for edge cases. Performance is acceptable for the expected volume (a few hundred messages per hour across 7 channels).

4. **In-memory dedup store** — no database needed. Messages older than 2x the window are pruned automatically. On server restart, the store rebuilds from recent fetches.

5. **Static dashboard** — no React/Vue/Angular overhead. Vanilla HTML+JS keeps it simple, fast to load, easy to maintain.

6. **Graceful degradation** — if `DEDUP_ENABLED=false`, the feed endpoint still works but without deduplication. If `natural` fails to compute similarity, fall back to exact-match only.

---

## 10. Dependencies to Install

```bash
npm install natural emoji-regex
```

| Package        | Version  | Purpose                                    |
|----------------|----------|--------------------------------------------|
| `natural`      | ^6.12.0  | TF-IDF, cosine similarity, Jaro-Winkler   |
| `emoji-regex`  | ^10.4.0  | Comprehensive Unicode emoji regex patterns |

---

## 11. Edge Cases & Considerations

- **Very short messages** (<10 chars after processing) — skip dedup check, too little content to compare reliably
- **Forwarded messages** — if `forwardFrom` is set, the message is explicitly forwarded from another channel; treat as duplicate of the original source
- **Updated/corrected messages** — channels sometimes post corrections like "Correction: X not Y". These are NOT duplicates even if similar; the dedup engine should skip messages starting with correction keywords (تصحيح, تعديل, correction, update)
- **Time zone** — all `date` fields are Unix timestamps (UTC), no timezone ambiguity
- **Concurrent fetch** — when fetching from multiple channels, use `Promise.allSettled()` not `Promise.all()` so one channel failure doesn't break the entire feed