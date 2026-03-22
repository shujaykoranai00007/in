# 🎵 Reel with Music - Complete Implementation Guide

## 6 POSSIBLE APPROACHES TO UPLOAD REELS WITH MUSIC

### ✅ APPROACH 1: Direct Upload (Easiest)
**Upload video with audio already embedded**
- Video file has audio/music mixed in
- Just upload via `/api/uploads`
- System automatically preserves audio

```bash
# Upload video with embedded audio
POST /api/uploads with video file (MP4, MOV)
```

✅ **Status**: WORKING NOW

---

### ✅ APPROACH 2: Music File Upload + Merge
**Upload music separately, then merge with video**

#### Step 1: Upload Music File
```bash
POST /api/music/upload
Body: multipart/form-data with audioFile (MP3, WAV, AAC)

Response: { musicId, filename, url }
```

#### Step 2: Create Reel with Music
```bash
POST /api/music/merge
Body: {
  "videoUrl": "http://localhost:5000/media/video.mp4",
  "musicUrl": "/music-library/music.mp3",
  "blendMode": "replace",  // or "mix" or "overlay"
  "musicVolume": 1.0,
  "videoAudioVolume": 0.5
}

Response: { outputUrl, filename }
```

#### Step 3: Create Post with the Merged Reel
```bash
POST /api/posts
Body: {
  "mediaUrl": "http://localhost:5000/media/merged-reel-xxx.mp4",
  "postType": "reel",
  "caption": "Your caption",
  "scheduledTime": "2026-03-20T10:00:00Z"
}
```

✅ **Status**: READY TO USE

---

### ✅ APPROACH 3: Extract Audio from Another Video
**Use audio from existing video and apply to anime reel**

```bash
POST /api/music/extract-from-video
Body: {
  "videoUrl": "https://example.com/source-video.mp4"
}

Response: { audioPath, filename, url }
```

Then use the extracted audio with APPROACH 2 (merge step)

✅ **Status**: READY TO USE

---

### ✅ APPROACH 4: YouTube Audio Extraction
**Extract audio track from YouTube video**

```bash
POST /api/music/extract-youtube
Body: {
  "youtubeUrl": "https://www.youtube.com/watch?v=VIDEO_ID"
}

Response: { audioPath, filename, url }
```

⚠️ **Important**: Only use music you have rights to use (Creative Commons, royalty-free)

✅ **Status**: READY TO USE

---

### ✅ APPROACH 5: Free Music Library Search
**Get royalty-free music for reels**

```bash
GET /api/music/search?q=anime epic&library=pixabay

Response: [
  {
    id: "track_id",
    title: "Anime Epic Music",
    url: "https://...",
    source: "pixabay"
  }
]
```

Supported libraries:
- **pixabay** (requires PIXABAY_API_KEY in .env)
- **archive** (requires ARCHIVE_ORG_API_KEY in .env)
- **builtin** (default anime-related tracks)

✅ **Status**: READY (requires API keys for full features)

---

### ✅ APPROACH 6: Smart Audio Analysis + Replacement
**Automatically detect video audio and choose strategy**

```bash
POST /api/music/analyze-video
Body: {
  "videoUrl": "https://example.com/video.mp4"
}

Response: {
  "hasAudio": false,
  "duration": 30,
  "recommendation": "replace"  // or "merge" if has audio
}
```

Based on recommendation:
- `replace` → Use only music (silent video)
- `merge` → Blend video audio + music (if video has audio)

✅ **Status**: READY TO USE

---

## 🚀 QUICK START: POST REEL WITH MUSIC IN 3 STEPS

### Step 1: Upload Music
```javascript
const formData = new FormData();
formData.append('audioFile', musicFileInput.files[0]);

const musicResponse = await fetch('/api/music/upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
const { musicId, url: musicUrl } = await musicResponse.json();
```

### Step 2: Upload Video and Reel with Music
```javascript
const formData = new FormData();
formData.append('videoFile', videoFileInput.files[0]);
formData.append('musicUrl', musicUrl);
formData.append('blendMode', 'replace'); // music only

const uploadResponse = await fetch('/api/uploads/with-music', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
const { mediaUrl } = await uploadResponse.json();
```

### Step 3: Schedule & Post
```javascript
const postResponse = await fetch('/api/posts', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    mediaUrl: mediaUrl,
    postType: 'reel',
    caption: '#AnimeEdit #AnimeReels 🎵',
    scheduledTime: new Date(Date.now() + 3600000).toISOString()
  })
});
```

---

## 📦 .ENV CONFIGURATION

Add these to your `.env` for full music features:

```env
# Pixabay Music API (for royalty-free music)
PIXABAY_API_KEY=your_pixabay_key_here

# Internet Archive API (for archive.org music)
ARCHIVE_ORG_API_KEY=optional_archive_key

# Music processing settings
MUSIC_MAX_UPLOAD_SIZE=100000000  # 100MB
MUSIC_CLEANUP_HOURS=24           # Auto-delete old files after 24h
```

Get free API keys:
- **Pixabay**: https://pixabay.com/api/docs/
- **Archive.org**: Already public API, no key needed

---

## 🎬 AUDIO BLEND MODES EXPLAINED

### `replace`
Uses **ONLY the music**, removes any original video audio
- Best for: Anime clips with copyright audio
- Result: Clean music track only
- Volume: `musicVolume: 1.0`

### `mix`
Blends video audio + music together
- Best for: Ambient videos needing background music
- Result: Both sounds audible
- Volumes: `videoAudioVolume: 0.5, musicVolume: 1.0`

### `overlay`
Layers music on top of existing audio
- Best for: Adding background to speech/dialogue
- Result: Both sounds, music slightly softer
- Volumes: `videoAudioVolume: 0.7, musicVolume: 0.8`

---

## 🔗 FULL API ENDPOINTS

### Music Management
```
POST   /api/music/upload               - Upload audio file
POST   /api/music/extract-from-video   - Extract audio from video URL
POST   /api/music/extract-youtube      - Extract audio from YouTube
GET    /api/music/search               - Search free music libraries
POST   /api/music/analyze-video        - Analyze video audio
POST   /api/music/merge                - Merge video + music
GET    /api/music/library              - List uploaded music
DELETE /api/music/library/:filename    - Delete music file
```

### Upload (Enhanced)
```
POST /api/uploads                      - Upload video (existing)
POST /api/uploads/with-music           - Upload video + music merged
```

### Posts (Existing)
```
POST   /api/posts                      - Create reel/post (schedule later)
GET    /api/posts                      - Get pending posts
PATCH  /api/posts/:id                  - Edit post
DELETE /api/posts/:id                  - Delete post
```

---

## 💡 PRACTICAL EXAMPLES

### Example 1: Upload Anime with Your Music Library Track
```bash
# 1. Check what music you have
curl http://localhost:5000/api/music/library \
  -H "Authorization: Bearer YOUR_TOKEN"

# 2. Download anime video
# 3. Post with your music
curl http://localhost:5000/api/posts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "mediaUrl": "http://localhost:5000/media/anime-video.mp4",
    "postType": "reel",
    "caption": "Epic anime moment with music #AnimeReels",
    "scheduledTime": "2026-03-20T12:00:00Z"
  }'
```

### Example 2: Extract Music from YouTube & Create Reel
```bash
# 1. Extract music from YouTube
curl -X POST http://localhost:5000/api/music/extract-youtube \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"youtubeUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'

# Returns: { "filename": "youtube-audio-12345.aac", "url": "/music-library/youtube-audio-12345.aac" }

# 2. Extract audio from your anime video for analysis
curl -X POST http://localhost:5000/api/music/analyze-video \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"videoUrl": "http://localhost:5000/media/anime.mp4"}'

# 3. Merge with extracted YouTube audio
curl -X POST http://localhost:5000/api/music/merge \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "videoUrl": "http://localhost:5000/media/anime.mp4",
    "musicUrl": "/music-library/youtube-audio-12345.aac",
    "blendMode": "replace",
    "musicVolume": 1.0
  }'

# 4. Schedule the merged reel
curl -X POST http://localhost:5000/api/posts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mediaUrl": "http://localhost:5000/media/merged-reel-xxx.mp4", "postType": "reel", "caption": "With Music", "scheduledTime": "2026-03-20T14:00:00Z"}'
```

### Example 3: Search & Use Free Music
```bash
# 1. Search for anime music
curl "http://localhost:5000/api/music/search?q=anime+epic&library=pixabay" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 2. Use the URL from search results to merge
# (same as Example 2, step 3)
```

---

## ⚡ AUTOMATION: Auto-Add Music to All Reels

Add this to Post model pre-save hook:
```javascript
// In Auto Anime Config
musicLibraryUrl: "/music-library/default-anime-music.mp3",
autoAddMusic: true,
musicBlendMode: "replace"
```

Then scheduler automatically merges music when posting:
```javascript
if (post.autoAddMusic && post.musicLibraryUrl) {
  const mergedPost = await mergeVideoWithAudio(
    post.mediaUrl,
    post.musicLibraryUrl,
    post.musicBlendMode
  );
  post.mediaUrl = mergedPost;
}
```

---

## 🐛 TROUBLESHOOTING

### Issue: "Only photo or video can be accepted"
→ Instagram doesn't recognize the video format
→ Solution: Ensure video is properly transcoded via FFmpeg
→ Check: `transcodeToInstagramReelWithMusic` function

### Issue: "Media processing failed"
→ Video codec incompatible or music audio track issue
→ Solution: Re-merge with `blendMode: "replace"`
→ Or download fresh video and try again

### Issue: Music volume too quiet/loud
→ Adjust `musicVolume` and `videoAudioVolume` parameters
→ Range: 0.1 to 1.5 (1.0 = 100%)

### Issue: FFmpeg not found
→ On Windows: Already included via `ffmpeg-static`
→ On Mac: `brew install ffmpeg`
→ On Linux: `sudo apt install ffmpeg`

---

## 🎯 RECOMMENDED WORKFLOW

```
1. Upload anime video
   ↓
2. Search free music OR upload your own
   ↓
3. Analyze video to check audio
   ↓
4. Merge video + music with chosen blend mode
   ↓
5. Generate caption with music-related hashtags
   ↓
6. Schedule post at peak time
   ↓
7. Auto-publish via scheduler
```

---

## 📊 SUPPORTED AUDIO FORMATS

**Upload**: MP3, WAV, AAC, OGG, WebM, M4A  
**Processing**: All above + FLAC, ALAC  
**Output**: AAC (Instagram native format)

---

**All 6 approaches are now ready to use! Start with APPROACH 1 or 2 for quickest results.** 🚀
