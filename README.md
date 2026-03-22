# InstaFlow Scheduler

A production-ready full-stack web application for scheduling Instagram reels and image posts from manual media URLs and publishing them automatically via Instagram Graph API.

## Stack

- Frontend: React + Vite + Tailwind CSS + Framer Motion
- Backend: Node.js + Express
- Database: MongoDB + Mongoose
- Scheduler: node-cron
- Integrations: Instagram Graph API
- Auth: JWT admin login

## Features

- Dark SaaS-style responsive dashboard
- Secure admin login
- Upload local media files (MP4/MOV/JPG/PNG/WEBP)
- Manual media URL scheduling for reels and image posts
- Auto-fetch anime edit reels and image posts from Reddit with quality filters
- Fixed daily auto-schedule slots (for example `09:00`, `12:30`, `18:00`)
- Hashtag set rotation (A/B/C style) for auto content
- Keyword set rotation to inject SEO-friendly keywords into auto captions
- Separate Insights tab for Instagram account analytics
- Schedule reels and image posts with captions
- Automatic cron-driven publishing every minute
- Retry logic (up to 3 attempts)
- Duplicate prevention via processing lock
- Posted and failed history with status indicators

## Project Structure

```text
/frontend      React dashboard UI
/backend       Express API, routes, services, scheduler
/database      Mongoose models
/config        Shared app config
```

## Prerequisites

- Node.js 20+
- MongoDB 7+
- Meta app with Instagram Graph API permissions

## Environment

Copy `.env.example` to `.env` in project root and fill all values.

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/insta_scheduler
JWT_SECRET=replace_with_strong_secret

INSTAGRAM_ACCESS_TOKEN=your_instagram_access_token
INSTAGRAM_USER_ID=your_instagram_user_id

ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=securepassword

FRONTEND_ORIGIN=http://localhost:5173
PUBLIC_BASE_URL=http://localhost:5000
VITE_API_URL=http://localhost:5000/api
UPLOAD_RETRY_GAP_SECONDS=60
```

Important: media URLs must be public and directly accessible, or Instagram cannot pull the file.
If you upload files from the dashboard, set PUBLIC_BASE_URL to a publicly reachable domain in production.
`UPLOAD_RETRY_GAP_SECONDS` controls the delay between retry attempts for transient upload failures.

## Run Locally

### 1. Install dependencies (root)

```bash
npm install
```

### 2. Install workspace dependencies

```bash
npm run install:all
```

### 3. Start both apps (recommended)

```bash
npm run dev
```

### 4. Start services individually

```bash
npm run dev:backend
npm run dev:frontend
```

## Docker

Make sure Docker Desktop is running before executing compose commands.

### Build backend container

```bash
docker build -t instaflow-backend .
```

### Start full stack with compose

```bash
docker compose up --build
```

### Start MongoDB only (for local dev backend)

```bash
docker compose up -d mongodb
```

## API Overview

- `POST /api/auth/login`
- `POST /api/uploads/media`
- `POST /api/posts`
- `GET /api/posts?status=pending`
- `GET /api/posts/history`
- `PATCH /api/posts/:id`
- `DELETE /api/posts/:id`
- `GET /api/auto-anime`
- `PATCH /api/auto-anime`
- `POST /api/auto-anime/run-now`

All endpoints except login require `Authorization: Bearer <JWT>`.

## Scheduler Workflow

Runs every minute:

1. Find due posts where `status=pending` and `scheduledTime <= now`
2. Lock each post by transitioning to `processing`
3. Upload to Instagram (container then publish)
4. On success: set `status=posted`
5. On failure: retry up to 3 times, then set `status=failed`

Auto anime workflow also runs every minute:

1. Check if auto mode is enabled
2. Compare current time in configured timezone with saved HH:mm slots
3. If slot matches and has not run today, fetch top Reddit anime edit reels
4. Apply quality filters (min score, min width, max age, keyword match)
5. Queue one new reel as a pending post and avoid duplicate source IDs

## Notes

- Use long-lived Instagram access tokens for stability.
- Validate Drive URL accessibility before scheduling.
- For production, deploy frontend and backend behind HTTPS and a reverse proxy.
