# 📬 Telegram Custom API — Personal Channel Reader

A Node.js REST API that connects to your **real Telegram account** using the MTProto protocol, allowing you to list your channels, read messages, and download media (photos & videos) — all through simple HTTP endpoints.

---

## 💡 The Idea

Telegram's official **Bot API** is limited — bots can only access chats they're added to. But Telegram also exposes a lower-level protocol called **MTProto** that allows you to connect as a real user and access everything your account can see: private channels, groups, media, and more.

This project wraps that capability into a clean local REST API using **GramJS** (the Node.js MTProto client) and **Express**.

---

## ✅ What It Can Do

| Feature | Description |
|---|---|
| 📋 List channels | Get all channels & groups your account is in |
| 💬 Read messages | Fetch messages with pagination support |
| 🖼️ Get photos | Download or serve photos from any message |
| 🎥 Get videos | Download or stream videos from any message |
| 📄 Get documents | Fetch any file/document shared in a channel |
| 🔒 Session-based auth | Login once, reuse forever via a session string |

---

## 🛠️ Tech Stack

- **Runtime** — Node.js (v18+)
- **Telegram Client** — [GramJS](https://github.com/gram-js/gramjs) (`telegram` npm package)
- **API Framework** — Express.js
- **Auth** — Telegram MTProto via `my.telegram.org` credentials

---

## 📦 Dependencies

```bash
npm install telegram input express dotenv
```

| Package | Purpose |
|---|---|
| `telegram` | GramJS — MTProto client for Node.js |
| `input` | Terminal prompts for first-time login |
| `express` | HTTP server / REST API |
| `dotenv` | Secure environment variable management |

---

## 🔑 Setup Requirements

### 1. Telegram API Credentials
Go to 👉 [https://my.telegram.org/apps](https://my.telegram.org/apps)
- Log in with your phone number
- Create a new application
- Copy your `api_id` and `api_hash`

### 2. Session String
Run the login script once:
```bash
node login.js
```
Enter your phone number and OTP — a session string will be printed. Save it. You won't need to log in again.

### 3. Environment Variables
Create a `.env` file:
```env
API_ID=123456
API_HASH=your_api_hash_here
SESSION=your_session_string_here
```

---

## 🚀 API Endpoints

### List all your channels
```
GET /channels
```
Returns all channels and groups your account is a member of.

### Get messages from a channel
```
GET /messages/:channel?limit=20&offset=0
```
- `:channel` — username (e.g. `durov`) or numeric ID (e.g. `-1001234567890`)
- `limit` — number of messages to return (default: 20)
- `offset` — message ID to paginate from (for older messages)

### Download media from a message
```
GET /media/:channel/:messageId
```
Downloads and serves the photo, video, or document from that message. Caches locally after first download.

### Stream a video directly
```
GET /media/:channel/:messageId/stream
```
Streams the video buffer directly without saving to disk.

---

## 📁 Project Structure

```
telegram-api/
├── .env               # API credentials (never commit this)
├── login.js           # Run once to generate session string
├── server.js          # Main Express API
├── media/             # Downloaded media cache
└── package.json
```

---

## 🔄 Usage Flow

```
1. Visit my.telegram.org → get api_id & api_hash
         ↓
2. Run login.js once → get session string
         ↓
3. Add everything to .env
         ↓
4. Run server.js
         ↓
5. Call your API endpoints
```

---

## ⚠️ Security Notes

- **Never commit** your `.env` file — add it to `.gitignore`
- Your **session string** is equivalent to your Telegram login — treat it like a password
- This API is intended for **personal/local use** — do not expose it publicly without authentication
- Telegram may rate-limit heavy usage — add delays when fetching large amounts of data

---

## 📌 Notes & Limitations

- Works with **public and private** channels you're a member of
- Media files are cached in the `/media` folder to avoid re-downloading
- First login requires physical access to your phone (OTP via Telegram)
- For private channels without a username, use the numeric channel ID from `GET /channels`

---

## 🔮 Possible Extensions

- [ ] Real-time listener for new messages (polling or webhook)
- [ ] Filter messages by date range or keyword
- [ ] Auto-forward messages to another service (Slack, Discord, etc.)
- [ ] Web UI to browse channels and media visually
- [ ] Support for downloading entire channel media archives
