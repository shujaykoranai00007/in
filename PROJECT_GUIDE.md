<!-- markdownlint-disable MD009 MD022 MD024 MD031 MD032 MD040 -->

# InstaFlow Scheduler - Complete Project Guide

## 📱 What is This App?

**InstaFlow Scheduler** is a web application that helps anime content creators automatically post videos and images on Instagram. Instead of manually uploading content every day, users can:

- Schedule posts to go live at specific times
- Automatically fetch anime videos from Reddit and post them
- Upload media manually and schedule it
- View a live queue of all pending posts
- See Instagram performance metrics

Think of it as a **robot assistant for Instagram posting**.

---

## 👥 Who Uses This?

- Anime content creators and editors
- Social media managers for anime accounts
- People who want to grow their Instagram with consistent anime content
- Content schedulers who need reliability and visibility

---

## 🎯 Main Features

### 1. **Instant Posting (Run Now)**
Click a button and your reel posts to Instagram immediately. It's not a scheduled post - it happens right now. The app will try up to 4 times if Instagram is slow to process the video.

### 2. **Schedule Posts for Later**
Pick a specific date and time (like "Tuesday at 3 PM"), and the app will automatically post when that time arrives. No need to be online.

### 3. **Daily Auto-Posting**
Set up times like "9 AM, 12:30 PM, 6 PM" and the app automatically fetches trending anime videos from Reddit and posts them at those times every single day.

### 4. **Manual Media Upload**
Upload videos or images from your computer and schedule them to post whenever you want.

### 5. **Smart Caption Generator**
The app automatically creates engaging captions with:
- Hooks that grab attention ("POV: your favorite anime scene got a perfect edit")
- Call-to-action phrases ("Rate this from 1-10 in comments")
- Relevant hashtags (#AnimeReels #AnimeEdit #AMV)
- Keywords for discovery

### 6. **Queue Monitoring**
See in real-time:
- What posts are waiting to go live
- Which posts are currently uploading
- Which posts succeeded or failed with error details
- Your entire posting history

### 7. **Instagram Stats**
Check which of your posts got the most likes, comments, saves, and reach.

### 8. **Beautiful Themes**
Choose from 8 different color themes (Aurora, Sunset, Ocean, Cyber Ice, etc.) to customize how the dashboard looks.

---

## 🏗️ How Everything is Built

### The Backend (The Server/Brain)
This is built with **Node.js and Express** - think of it as the engine that powers everything.

**Location:** Renders server in Oregon (a free hosting service)

**What it does:**
- Connects to Instagram to post videos and images
- Fetches anime content from Reddit
- Processes videos (converts them to Instagram format)
- Stores all posts in a database
- Handles the scheduling system (checks every minute if something should post)
- Validates user login and tokens

**Key Services (like separate departments):**

1. **Anime Fetcher** - Talks to Reddit, finds trending anime videos
2. **Caption Generator** - Creates engaging text for posts
3. **Scheduler** - Handles upload attempts and retries if Instagram is slow
4. **Instagram Connector** - Publishes to Instagram using their official API
5. **Media Processor** - Converts videos/images to Instagram specs (ffmpeg)
6. **Music Handler** - Can extract audio from videos or add background music
7. **Storage Manager** - Cleans up old temporary files

### The Frontend (The Dashboard/Face)
This is what you see in your browser - built with **React and Tailwind CSS**.

**Location:** Deployed on Vercel (a web hosting service)

**What you interact with:**
- Login page (email and password)
- Dashboard with 7 different tabs
- Forms to upload media and write captions
- Live queue showing pending posts
- History showing all posted content
- Settings for daily automation
- Instagram account insights

**Main Tabs:**
1. **Control** - Quick actions and Instagram status
2. **Schedule** - Create and post manually
3. **Live Monitor** - Real-time activity feed
4. **Insights** - Instagram performance metrics
5. **Anime Auto** - Set up daily automatic posting
6. **Queued Posts** - See what's waiting to post
7. **History** - All your previous posts

### The Database (The Brain's Memory)
Uses **MongoDB** - like a smart filing system that stores:
- All posts (with caption, media URL, status)
- User preferences and automation settings
- Instagram publishing details

### External Services Connected
- **Instagram Graph API** - The official Instagram publishing system
- **Reddit API** - To fetch trending anime videos
- **Facebook Graph API** - Instagram is owned by Meta/Facebook

---

## 🔄 How Posts Actually Get Posted

### When You Click "Run Now" (Instant Post)

```
1. App fetches a trending anime video from Reddit
2. App downloads the video and converts it to Instagram format
3. App generates a caption with hashtags
4. App creates a "post" record in the database
5. App immediately tries to publish to Instagram
6. If it fails, it retries up to 4 times (every 3.5 seconds)
7. If successful, you see the Instagram link
8. If failed, you see the error message
```

**Total time:** Usually 15-30 seconds

### When You Schedule a Post for Later

```
1. You upload a video/image or paste a URL
2. You write a caption (or let the app generate one)
3. You pick a date and time
4. App converts the media to Instagram format
5. Every minute, the system checks if any posts are due
6. When the time arrives, it uploads automatically
7. You can see status updates in real-time
```

### For Daily Auto-Posting

```
1. You set it up once (say "9 AM, 12:30 PM, 6 PM")
2. Every minute, the system checks if it's one of your posting times
3. If it is, it automatically:
   - Fetches a trending anime video from Reddit
   - Creates a caption
   - Publishes it to Instagram
4. Repeats daily at those times
```

---

## 🗄️ What's Stored in the Database?

### Post Information
Each post stores:
- **Media URL** - Link to the video or image
- **Caption** - The text that goes with it
- **Keywords** - For Instagram discovery
- **Hashtags** - For broader reach
- **Status** - Is it pending? uploading? posted? failed?
- **Scheduled Time** - When should it post?
- **Source** - Did it come from Reddit or manual upload?
- **Error Log** - If it failed, why?
- **Instagram Details** - After posting, the Instagram link, likes count, etc.

### Automation Settings
- Is daily auto-posting enabled?
- Which subreddits to pull from (Animeedits, AnimeMusicVideos, etc.)
- Minimum upvote count before considering a video
- Minimum video width quality
- Maximum age of videos to consider
- Time slots for daily posting (9:00, 12:30, 18:00, etc.)
- Your timezone
- Rotating hashtag pools to keep posts fresh

---

## 🌐 How the Internet Connection Works

### Login Flow
```
You → Enter Email & Password → Server validates → Gets a token
That token proves you're logged in (like a ticket)
You use that token for every action
If token expires, you automatically logout
```

### Posting Flow
```
Your Browser → Sends post data to Server
Server → Processing (converting media, etc.)
Server → Publishes to Instagram Graph API
Instagram → Confirms published
Server → Stores confirmation in database
Server → Sends success response to your browser
Your Browser → Shows Instagram link
```

### Real-Time Updates
Currently uses **polling** (every 10 seconds, the dashboard asks "any updates?")
- Simple but not the most efficient
- Future improvement: WebSockets (instant push updates)

---

## 🎨 The Design & User Experience

### Color System
Light background (#edf5ff - pale blue) with:
- Cyan/teal accents (#00a7cc)
- Warm orange (#ff9c41) 
- Red for warnings (#ff5a6f)
- Muted gray text (#37526a)

### Design Elements
- **Glass Panels** - Frosted glass effect with blur background
- **Gradient Buttons** - Smooth colorful buttons
- **Cards** - Information organized in white panels
- **Smooth Animations** - Things fade in and slide smoothly
- **Icons** - From Lucide React (modern icon library)

### Themes Available
1. **Aurora** (default cyan)
2. **Sunset** (warm orange)
3. **Ocean** (deep teal)
4. **Cyber Ice** (bright electric cyan)
5. **Volt Purple** (purple/magenta)
6. **Lava Pop** (orange/yellow fire)
7. **Neon Forest** (green/cyan neon)
8. **Midnight Mint** (blue/mint)

Each theme is fully customizable - you can tweak every color.

---

## 🔐 Security & Login

### How Authentication Works
1. You enter email and password
2. Server checks against stored credentials (very secure - passwords are hashed)
3. If correct, server gives you a **JWT token** (a secure digital ticket)
4. You use this token for 12 hours
5. After 12 hours, you need to login again

### Who Can Access
Currently: Single admin user (the account owner)
- Not multi-user (one person controls the account)
- All authenticated users get full access
- No "read-only" users yet

### What's Protected
- All Instagram account details (access token, user ID)
- All post data
- All automation settings
- All user actions logged in database

---

## ⚠️ Known Limitations & Issues

### Problem: Cold Start Delays (20-40 seconds)
The backend is hosted on Render's free tier, which "sleeps" after 15 minutes of inactivity. When you first access it, it needs to wake up.
**Solution:** Upgrade to paid tier or use a keep-alive service.

### Problem: Video Processing Takes Long Time (30-180 seconds)
Converting videos to Instagram format uses ffmpeg, which can be slow.
**Solution:** Show progress UI or move to background job processing.

### Problem: Need Public Internet Address
Instagram requires the ability to download media from a public URL (not your home computer). This is why it needs PUBLIC_BASE_URL set up.
**Solution:** Use a tunnel service like ngrok or Cloudflare.

### Problem: No Real-Time Updates
Dashboard polls every 10 seconds instead of getting instant updates.
**Solution:** Implement WebSockets (instant push updates).

### Problem: No Search in History
If you have 100+ posts, hard to find a specific one.
**Solution:** Add search bar and filters by date/status.

### Problem: Can't Edit Multiple Posts at Once
You have to edit each post individually.
**Solution:** Add checkbox selection for batch operations.

---

## 🚀 How to Deploy & Run

### Locally (For Development)

```bash
# Install dependencies
npm install:all

# Start backend and frontend together
npm run dev

# Or run separately:
npm run dev:backend  # Starts on http://localhost:5000
npm run dev:frontend # Starts on http://localhost:5173
```

### Production (Current Setup)

**Backend:** Push to GitHub → Render automatically deploys to Oregon server
**Frontend:** Push to GitHub → Vercel automatically builds and deploys
**Database:** MongoDB Atlas cloud (no deployment needed)

---

## 📊 Architecture Overview

```
┌─────────────────────────────────────────────────┐
│         Your Browser (Frontend)                 │
│  - React Dashboard with 7 tabs                  │
│  - Login form                                   │
│  - Upload files                                 │
│  - See queue and history                        │
└──────────────┬──────────────────────────────────┘
               │ (HTTPS API calls)
               ↓
┌─────────────────────────────────────────────────┐
│     Backend Server (Node.js/Express)            │
│  - Routes: auth, posts, automation, uploads     │
│  - Services: scheduler, Instagram, Reddit       │
│  - Cron job: checks every minute for posts      │
│  - Database: stores posts and config            │
└──────────────┬──────────────────────────────────┘
               │
        ┌──────┼──────┬─────────┐
        ↓      ↓      ↓         ↓
    MongoDB   Instagram  Reddit  File Storage
    Database  Graph API   API    (/uploads)
```

---

## 📁 File Structure (Simplified)

### Backend Folders
```
backend/
├── config/           → Database and environment setup
├── middleware/       → Login verification
├── models/          → Post and Config database schemas
├── routes/          → API endpoints (6 groups)
│   ├── auth.routes.js          (login, Instagram token)
│   ├── post.routes.js          (create, list, delete posts)
│   ├── auto-anime.routes.js    (automation config, Run Now, daily activation)
│   ├── upload.routes.js        (file upload handling)
│   ├── music.routes.js         (music library)
│   └── drive.routes.js         (Google Drive integration - partial)
├── services/        → Business logic (9 services)
│   ├── anime-automation.service.js   (Reddit fetching, post creation)
│   ├── anime-fetch.service.js        (Reddit API)
│   ├── scheduler.service.js          (Upload logic, retries)
│   ├── instagram.service.js          (Instagram publishing)
│   ├── caption-suggest.service.js    (Auto captions)
│   ├── media-extract.service.js      (Download & convert media)
│   ├── music-handler.service.js      (Audio processing)
│   ├── media-cleanup.service.js      (Delete temp files)
│   └── google-drive.service.js       (Drive sync - partial)
├── scheduler/       → Cron job that runs every minute
├── server.js        → Main app startup
└── app.js          → Express setup

frontend/
├── components/      → React components
│   ├── DashboardView.jsx  (Main dashboard with all tabs)
│   ├── LoginView.jsx      (Login page)
│   └── Sidebar.jsx        (Navigation sidebar)
├── hooks/          → Custom React logic
│   └── useAuth.js  (Login/logout/token management)
├── services/       → API calling
│   └── api.js      (Axios setup with auth)
├── App.jsx         → Main app router (login vs dashboard)
├── main.jsx        → React startup
└── styles.css      → Global styling + theme colors
```

---

## 🔧 API Endpoints (What The Frontend Talks To)

### Authentication
- `POST /api/auth/login` - Login with email/password, get token
- `GET /api/auth/me` - Check if token is still valid
- `GET /api/auth/instagram-token-status` - Check if Instagram token works
- `GET /api/auth/instagram-account-details` - Get account info, followers, recent posts

### Posts
- `GET /api/posts` - List all posts (with filters)
- `POST /api/posts` - Create a new post
- `DELETE /api/posts/:id` - Cancel/delete a post

### Automation
- `GET /api/auto-anime` - Get current automation settings
- `PATCH /api/auto-anime` - Update automation settings
- `POST /api/auto-anime/run-now` - Instantly fetch & post (Run Now button)
- `POST /api/auto-anime/activate-daily` - Turn on daily auto-posting
- `POST /api/auto-anime/tick` - Manually trigger the scheduler (for testing)

### File Upload
- `POST /api/uploads` - Upload media file

### Music Library
- `GET /api/music` - List available background music

---

## 💾 What Gets Stored in Database

### Post Collection
Each post record has:
- Title/caption
- Media file path or URL
- Keywords and hashtags
- Status (pending/processing/posted/failed)
- When it should post
- How many times we tried to upload it
- Error messages if it failed
- Instagram's response (link, counts, etc.)
- When it was created/updated

### Config Collection
One record that says:
- Is daily auto-posting enabled?
- Which subreddits to check for videos?
- Only posts with X+ upvotes
- Only videos at least XXX pixels wide
- Don't use videos older than XX hours
- What times to post daily
- What hashtags to use
- What timezone the user is in

---

## 🎯 How Scheduling Really Works

### Every Single Minute
A scheduled cron job runs and does this:

```
1. Check if daily automation is enabled
   → If yes, check if current time matches any daily slot
   → If yes, fetch a Reddit video and queue it

2. Look at all posts waiting to be uploaded
   → Find ones where scheduled time has arrived
   → Try to upload them to Instagram
   
3. For each upload attempt:
   → Try once
   → If Instagram says "reel still processing" → wait 1 minute and retry
   → If it's another type of error → retry up to 3 times (60 seconds apart)
   → If it succeeds → mark it as "posted" and save the Instagram link
   → If all retries fail → mark as "failed" and save the error
```

This happens **automatically 24/7**.

---

## 🎬 From Reddit to Instagram (Step by Step)

### Daily Auto-Posting Example

Let's say you set up: "Post at 9 AM every day"

```
9:00 AM - Cron job runs
  ↓
1. System checks: "Is it 9 AM? Is automation enabled?"
  ↓
2. Yes! Fetch from Reddit subreddits:
   - Animeedits
   - AnimeMusicVideos
   - anime_edits
   - anime
  ↓
3. Apply filters:
   - Only videos with 20+ upvotes
   - Only videos at 720+ pixels wide
   - Only videos less than 72 hours old
  ↓
4. Pick a random one (if random mode on)
  ↓
5. Download the video
  ↓
6. Extract the title: "Jujutsu Kaisen - Best Fight Scene 4K"
  ↓
7. Generate caption:
   - Hook: "This anime edit hits different."
   - Title reference: "Best from Jujutsu Kaisen"
   - Keywords: "jujutsu, kaisen, anime, edit, fight"
   - Hashtags: "#AnimeEdit #AnimeReels #JujutsuKaisen #ExplorePage"
   - CTA: "Rate this 1-10 in comments"
  ↓
8. Transcode video to Instagram specs:
   - Convert to H.264 codec
   - 1080x1080 resolution
   - Make sure has audio
   - Max 90 seconds
  ↓
9. Upload to Instagram Graph API
  ↓
10. If success → Store Instagram link in database
    If fail → Retry up to 3 times, then mark failed
  ↓
11. You see it appear on Instagram!
```

---

## 🛠️ What Could Be Better (Improvements to Make)

### Testing (No automated tests currently)
Currently any code change could break something without us knowing. Should add:
- Unit tests (test individual functions)
- Integration tests (test multiple services together)
- End-to-end tests (test like a real user would)

### Monitoring & Logging
No structured logging system - only console.log
Should add:
- Detailed activity logs for debugging
- Error tracking (Sentry service)
- Performance monitoring

### Request Validation
No validation of user input on API endpoints
Should add:
- Check that email is valid format
- Check that caption isn't too long
- Check that file isn't too big

### Rate Limiting
No protection against spam/abuse
Should add:
- Limit login attempts
- Limit file uploads
- Prevent accidental double-posting

### Caching
Every request hits the database
Should add:
- Keep frequently-used data in memory
- Cache Instagram account details
- Cache automation config

### Real-Time Updates
Uses polling every 10 seconds (inefficient)
Should add:
- WebSockets (instant updates)
- Server pushes to browser automatically

### Video Processing
Takes 30-180 seconds, nothing shows progress
Should add:
- Show "converting video 45% complete..."
- Move to background queue (process while showing instant success)

### Missing Features
- No search in post history
- No content calendar view
- Can't edit multiple posts at once
- No dark mode theme
- Limited analytics

---

## 📈 Growth Opportunities (What to Build Next)

### Quick Wins (1-2 weeks each)
1. Add search and filters to post history
2. Add dark mode theme
3. Show error details in expandable modal
4. Add rate limiting on login

### Medium Efforts (2-4 weeks each)
1. Build content calendar UI
2. Add batch post editing
3. Implement request validation
4. Add structured logging
5. Add database query optimization

### Bigger Projects (2+ weeks each)
1. WebSocket real-time updates
2. Background job queue for video processing
3. AI-powered caption enhancement
4. Multi-user support with permissions
5. Advanced analytics (best post times, trending content)

---

## 🔗 External Services Used

### Instagram Graph API
- Official Instagram publishing system
- Requires business account
- Requires access token
- Can publish reels, photos, carousels

### Reddit API
- Fetch trending posts, videos, images
- No login required (uses User-Agent)
- Rate limited (don't spam requests)
- Can query specific subreddits

### File Hosting (When Backend is Local)
If your public URL isn't ready, can temporarily host files at:
- **0x0.st** - Free, no account needed
- **Catbox.moe** - Free, no account needed

### File Management
- **Sharp** - Image resizing/conversion
- **ffmpeg** - Video transcoding/codec conversion

---

## 🌍 How It Works Deployed vs Local

### Production (What You See Now)
```
Backend → Render server in Oregon
          ↓
Database → MongoDB in cloud
          ↓
Frontend → Built files served from Vercel
          ↓
You access → https://yourapp.vercel.app
            (can see Render server from internet)
```

### Local Development
```
Backend → Your computer localhost:5000
         (Instagram CAN'T see it - need tunnel)
         
Frontend → Your computer localhost:5173
          (you see it locally)
          
Database → Can be local or cloud MongoDB
```

For local development with Instagram posting, you need:
- ngrok (creates tunnel: ngrok.io → your localhost)
- Set PUBLIC_BASE_URL to your ngrok URL
- Instagram can now download from your computer!

---

## 🎓 Technology Choices Explained

### Why Node.js + Express?
- Easy to build APIs quickly
- Large number of packages available
- JavaScript on both frontend + backend
- Good for real-time applications

### Why React?
- Component-based (reusable UI pieces)
- Efficient rendering (only updates changed parts)
- Large developer community
- Easy state management for medium apps

### Why MongoDB?
- Flexible schema (can add fields easily)
- Scales horizontally
- Good for scheduling/queue applications
- Native JSON support

### Why Tailwind CSS?
- Utility-first (build UI fast)
- Consistent spacing/sizing
- Easy theming with CSS variables
- Responsive design built-in

### Why Render + Vercel?
- Simple deployment (push to GitHub → auto deploy)
- Free tiers available
- Good for small apps
- Reliable uptime

---

## 🚨 Critical Requirements

### For Instagram Posting to Work
1. **Business Instagram Account** (not personal)
2. **Access Token** with posting permissions
3. **Public Base URL** (Instagram must reach your server)
4. **Business Account User ID**

### For Reddit Fetching to Work
1. Nothing special needed
2. Respects rate limits automatically

### For Daily Scheduling to Work
1. Backend must stay running 24/7
2. Cron job triggers every minute
3. Each post tries multiple times on failure

---

## 🎬 Example: A Day in the Life

**7:00 AM -** Backend starts, cron job begins checking every minute

**8:55 AM -** You log in, configure settings for first time

**9:00 AM -** First daily post triggers:
- Fetches anime video from Reddit
- Generates caption
- Uploads to Instagram
- Shows you the link in ~30 seconds

**10:30 AM -** You manually upload a video from your computer

**12:30 PM -** Second daily post (same process)

**3:00 PM -** Your manual video finishes processing and uploads

**6:00 PM -** Third daily post (same process)

**Throughout the day -** Dashboard updates every 10 seconds showing:
- Queue of waiting posts
- History of posted content
- Real-time error messages

**Next day at 9 AM -** Process repeats 24 hours later

---

## ✅ Checklist for New Users

Before starting:
- [ ] Have an Instagram business account
- [ ] Get Instagram access token from Meta
- [ ] Get your Instagram user ID
- [ ] Set up environment variables (.env file)
- [ ] Have Media base URL configured (or use ngrok tunnel for testing)

To use daily automation:
- [ ] Set daily time slots (e.g., 9:00, 12:30, 18:00)
- [ ] Choose which subreddits
- [ ] Choose content filters (score, age, dimensions)
- [ ] Click "Start Daily Auto"
- [ ] Verify first post appears in 24 hours

To manually post:
- [ ] Go to "Schedule" tab
- [ ] Upload file or paste URL
- [ ] Write caption or let auto-generate
- [ ] Pick "Reel" or "Post" type
- [ ] Set time (immediate or future)
- [ ] Click "Schedule"
- [ ] Or click "Run Now" for instant posting

---

## 🎯 Summary (The 30-Second Version)

**InstaFlow Scheduler** is an Instagram automation tool for anime creators that:

1. **Automatically fetches** trending anime videos from Reddit
2. **Generates engaging** captions with hashtags
3. **Converts media** to Instagram's format
4. **Publishes automatically** at scheduled times (daily or instant)
5. **Shows you everything** in a beautiful dashboard with 7 tabs
6. **Tracks all posts** with status updates and error messages
7. **Works 24/7** without you needing to be online

Built with modern web technology (React, Node.js, MongoDB), hosted in the cloud, and open to future enhancements like real-time updates, better analytics, and multi-user support.

---

**Questions?** Every part is documented above with real examples and explanations! 🎉
