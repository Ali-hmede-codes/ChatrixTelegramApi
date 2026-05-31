# Chatrix Telegram API Documentation

**Base URL:** `https://newapi.chatrix.vip`

A **text-only** REST API that reads channels and messages from a Telegram account via the MTProto protocol. This API intentionally **does not serve photos, videos, or any media files** — it returns only plain text messages with emojis and URLs stripped. All endpoints return JSON with a `success` boolean. Channel identifiers can be a **UID** (short numeric ID from the registry), a **Telegram username** (e.g. `durov`), or a **Telegram numeric ID** (e.g. `-1001234567890`).

---

## Response Format

Every response follows this structure:

**Success:**
```json
{ "success": true, "data": ... }
```

**Error:**
```json
{ "success": false, "error": "error message" }
```

---

## Endpoints

### Health Check

```
GET /health
```

Returns connection status and server uptime.

**Response:**
```json
{
  "success": true,
  "connected": true,
  "uptime": 3600,
  "timestamp": "2026-05-31T12:00:00.000Z"
}
```

---

### List All Channels

```
GET /channels
```

Returns all channels and groups the Telegram account is a member of. Each channel is assigned a **UID** (short numeric ID) for convenient reference in other endpoints.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "uid": 1,
      "telegramId": "-1002448697799",
      "name": "RT Arabic - عاجل",
      "username": "RTarabic_br",
      "isChannel": true,
      "isGroup": false,
      "memberCount": 500000
    }
  ]
}
```

---

### Get Channel Registry

```
GET /channels/registry
```

Returns the persisted channel registry (UID mappings). This is a static snapshot from `channel_registry.json` and does not fetch live data from Telegram.

**Response:**
```json
{
  "success": true,
  "data": [
    { "uid": 1, "telegramId": "-1002448697799", "name": "RT Arabic - عاجل", "username": "RTarabic_br" },
    { "uid": 2, "telegramId": "-1001006840823", "name": "قناة الجزيرة", "username": "AjaNews" }
  ]
}
```

---

### Get Single Channel by UID

```
GET /channels/:uid
```

Returns details for a specific channel by its UID.

**Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `uid` | integer | The short numeric UID from the registry |

**Response:**
```json
{
  "success": true,
  "data": {
    "uid": 1,
    "telegramId": "-1002448697799",
    "name": "RT Arabic - عاجل",
    "username": "RTarabic_br"
  }
}
```

**Error (404):**
```json
{ "success": false, "error": "Channel not found" }
```

---

### Get Messages from a Channel

```
GET /messages/:channel
```

Fetches **plain text only** messages from a channel. The following messages are **excluded**:
- Messages containing **photos, videos, or any media** — completely filtered out
- Messages containing **URLs/links** — completely filtered out
- **Emojis** are stripped from all remaining message text

**Parameters:**
| Param | Type | In | Description |
|-------|------|----|-------------|
| `channel` | string | path | UID, username, or Telegram ID |
| `limit` | integer | query | Number of messages to return (default: 20, max: 100) |
| `offset` | integer | query | Message ID to start paginating from (0 = most recent) |

**Example:**
```
GET /messages/1?limit=20&offset=0
GET /messages/RTarabic_br?limit=50
GET /messages/-1002448697799?limit=20&offset=500
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 12345,
      "date": 1717200000,
      "text": "Breaking news headline here",
      "replyTo": null,
      "forwardFrom": null
    },
    {
      "id": 12340,
      "date": 1717199000,
      "text": "Another text update",
      "replyTo": 12330,
      "forwardFrom": null
    }
  ]
}
```

> **Note:** Only pure text messages are returned. There is no `media` field in the response — all media-containing messages are excluded at the source.

---

### Get Single Message

```
GET /messages/:channel/:messageId
```

Fetches a specific message by its ID within a channel. Only returns the message if it is a **plain text message** (no media, no URLs). If the message contains media or a URL, it will still be returned but the text will have emojis stripped.

**Parameters:**
| Param | Type | In | Description |
|-------|------|----|-------------|
| `channel` | string | path | UID, username, or Telegram ID |
| `messageId` | integer | path | The Telegram message ID |

**Example:**
```
GET /messages/1/12345
GET /messages/RTarabic_br/98765
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 12345,
    "date": 1717200000,
    "text": "Breaking news headline",
    "replyTo": null,
    "forwardFrom": null
  }
}
```

**Error (404):**
```json
{ "success": false, "error": "Message not found" }
```

---

### Real-time Events (SSE)

```
GET /realtime/events
```

Server-Sent Events stream that pushes new **text-only** messages in real-time as they arrive in monitored channels. Requires `REALTIME_ENABLED=true` in the server config.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `channels` | string | Comma-separated channel IDs to filter events (optional) |

**Example:**
```
GET /realtime/events
GET /realtime/events?channels=-1002448697799,-1001006840823
```

**SSE Event Format:**
Each event is sent as:
```
data: {"id":12345,"date":1717200000,"text":"Breaking news","channelId":"2448697799","replyTo":null,"forwardFrom":null}
```

The client connection stays open. When the client disconnects, the handler is cleaned up.

> **Note:** Real-time events also apply the same filters — messages with media or URLs are excluded, and emojis are stripped.

---

### Real-time Status

```
GET /realtime/status
```

Returns the current state of the real-time listener.

**Response:**
```json
{
  "success": true,
  "connectedClients": 3,
  "realtimeEnabled": true
}
```

---

## Channel Identifier Resolution

All endpoints that accept a `:channel` parameter support three identifier types, resolved in this order:

1. **UID** — Short numeric ID from the registry (e.g. `1`, `2`, `7`). Checked against the channel registry first.
2. **Telegram username** — Public channel username (e.g. `RTarabic_br`, `AjaNews`)
3. **Telegram numeric ID** — Full Telegram channel ID (e.g. `-1002448697799`)

Using UIDs is recommended as they are short, stable, and pre-mapped in the registry.

---

## Current Channel Registry

| UID | Channel Name | Username | Telegram ID |
|-----|-------------|----------|-------------|
| 1 | RT Arabic - عاجل | RTarabic_br | -1002448697799 |
| 2 | قناة الجزيرة | AjaNews | -1001006840823 |
| 3 | ليبانون ديبايت | lebanondebate | -1001008206734 |
| 4 | قناة الميادين \| عاجل | almayadeen | -1001002129373 |
| 5 | manarbreaking \| المنار عاجل | manarbreaking | -1002721887673 |
| 6 | التلفزيون العربي - عاجل | AlarabyTvBrk | -1002410590440 |
| 7 | Al-Akhbar - جريدة الأخبار | alakhbar_news | -1001917130438 |

---

## Message Filtering Rules

This API is **strictly text-only**. The following filtering rules apply to both `/messages` and `/realtime/events`:

1. **Media messages are excluded** — any message containing photos, videos, documents, or any other media type is completely removed from the response
2. **URL messages are excluded** — any message containing HTTP/HTTPS links is completely removed
3. **Emojis are stripped** — all emoji characters are removed from remaining message text, and extra whitespace is normalized to single spaces

**What you get:** Clean, plain text news/updates only.
**What you won't get:** Photos, videos, documents, audio, stickers, URLs, or emojis.

---

## Pagination

The `/messages/:channel` endpoint supports offset-based pagination:
- `offset=0` → fetch the most recent messages
- `offset=<messageId>` → fetch messages older than the given message ID

To paginate through a channel's history:
1. First request: `GET /messages/1?limit=20&offset=0`
2. Take the lowest `id` from the response (e.g. `12300`)
3. Next request: `GET /messages/1?limit=20&offset=12300`
4. Repeat until fewer messages than `limit` are returned

---

## Rate Limits & Best Practices

- Telegram may rate-limit heavy usage — avoid fetching more than 100 messages per request
- SSE connections are long-lived; clients should handle reconnection on disconnect
- The server fetches 3x the requested message limit internally to account for filtering, then returns up to the requested limit
- This API is designed for **AI consumption** — the text-only, emoji-stripped, URL-filtered output is optimized for natural language processing and text analysis