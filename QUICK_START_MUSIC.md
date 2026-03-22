# 🎵 REEL WITH MUSIC - QUICK START

## ✅ SYSTEM READY - 6 APPROACHES AVAILABLE

Your backend is now running with **complete music support**. You can now upload anime reels with music using **ANY of these 6 approaches**:

---

## 🚀 FASTEST WAY (2 Steps)

### Step 1: Upload Music + Video
```bash
curl -X POST http://localhost:5000/api/uploads/video-with-music \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "video=@anime.mp4" \
  -F "music=@music.mp3" \
  -F "blendMode=replace"
```

**Response:**
```json
{
  "filename": "reel-with-music-17826354.mp4",
  "mediaUrl": "http://localhost:5000/media/reel-with-music-17826354.mp4",
  "message": "Video and music merged successfully"
}
```

### Step 2: Schedule Post
```bash
curl -X POST http://localhost:5000/api/posts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "mediaUrl": "http://localhost:5000/media/reel-with-music-17826354.mp4",
    "postType": "reel",
    "caption": "Epic anime moment with music 🎵 #AnimeReels",
    "scheduledTime": "2026-03-20T12:00:00Z"
  }'
```

✅ **DONE!** Your reel with music is scheduled for posting!

---

## 📚 ALL 6 APPROACHES

### APPROACH 1: Direct Upload (Easiest)
Video file already has audio embedded → Upload as-is
```
POST /api/uploads/media
→ No music processing needed
```

### APPROACH 2: Music File + Video (Recommended)
Upload separate video and music files
```
POST /api/uploads/video-with-music
Body: video + music files
→ Auto-merges with FFmpeg
```

### APPROACH 3: Extract Audio from Video
Get audio from another video file
```
POST /api/music/extract-from-video
Body: { "videoUrl": "https://..." }
→ Returns extracted audio file
```

### APPROACH 4: YouTube Audio Extraction
Extract audio directly from YouTube
```
POST /api/music/extract-youtube
Body: { "youtubeUrl": "https://www.youtube.com/watch?v=VIDEO_ID" }
→ Returns audio file (⚠️ use only royalty-free music)
```

### APPROACH 5: Royalty-Free Music Library
Search free music from Pixabay or Archive.org
```
GET /api/music/search?q=anime+epic&library=pixabay
→ Returns list of free tracks to use
```

### APPROACH 6: Smart Analysis + Merge
Analyze video audio and choose best strategy
```
POST /api/music/analyze-video
→ Detects if video has audio
→ Recommends: "replace" or "merge"
POST /api/music/merge
→ Merges with chosen audio blend mode
```

---

## 🎬 AUDIO BLEND MODES

| Mode | Usage | Best For |
|------|-------|----------|
| `replace` | Use ONLY music, remove video audio | Anime clips with copyrighted audio |
| `mix` | Blend both audio tracks | Add background music to speech |
| `overlay` | Layer music on top | Music + dialogue together |

---

## 📋 MUSIC LIBRARY API

```
POST   /api/music/upload                 - Upload audio file
POST   /api/music/extract-from-video     - Extract audio from video URL
POST   /api/music/extract-youtube        - Extract audio from YouTube
GET    /api/music/search                 - Search free music libraries
POST   /api/music/analyze-video          - Analyze video audio
POST   /api/music/merge                  - Merge video + music
POST   /api/uploads/video-with-music    - Upload & merge in one step
GET    /api/music/library                - List your uploaded music
DELETE /api/music/library/:filename      - Delete music file
```

---

## 🎯 EXAMPLE WORKFLOWS

### Workflow A: Upload Anime + Add Music File
```
1. Upload anime.mp4 + music.mp3 via /api/uploads/video-with-music
2. Get output mediaUrl
3. POST to /api/posts with mediaUrl
4. Scheduler auto-publishes at scheduledTime
```

### Workflow B: Extract YouTube Audio + Use It
```
1. POST youtube URL to /api/music/extract-youtube
2. Get audio filename from response
3. POST new video + audio to /api/music/merge
4. POST result to /api/posts
```

### Workflow C: Search Free Music + Use It
```
1. GET /api/music/search?q=anime+epic
2. Download track from returned URL (or note the URL)
3. Use one of Approaches 2-6 with that music
4. Post to Instagram
```

---

## 🔧 SUPPORTED FORMATS

**Input Video:** MP4, MOV, WebM, AVI  
**Input Audio:** MP3, WAV, AAC, OGG, WebM, FLAC, M4A  
**Output:** MP4 (Instagram native) with AAC audio layer

---

## ⚡ LIVE TESTING

### Test Upload with Music (Right Now!)
```bash
# 1. Get authorization token (you already have it from login)
TOKEN="your_token_here"

# 2. Get a sample anime video
# (Use any MP4 you have)

# 3. Get sample music
# (Download from pixabay.com free music)

# 4. Upload and merge
curl -X POST http://localhost:5000/api/uploads/video-with-music \
  -H "Authorization: Bearer $TOKEN" \
  -F "video=@your_anime.mp4" \
  -F "music=@music.mp3" \
  -F "blendMode=replace" \
  -F "musicVolume=1.0"

# 5. Copy the mediaUrl from response

# 6. Schedule the post
curl -X POST http://localhost:5000/api/posts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "mediaUrl": "PASTE_MEDIA_URL_HERE",
    "postType": "reel",
    "caption": "Test reel with music #AnimeReels",
    "scheduledTime": "2026-03-20T15:00:00Z"
  }'
```

---

##  TROUBLESHOOTING

### "ffmpeg not found"
→ ffmpeg-static is auto-installed, should just work

### "Only photo or video can be accepted"
→ Instagram rejected the format
→ Solution: Re-merge with better quality settings

### Music too quiet/loud
→ Adjust parameters:
   - `musicVolume`: 0.5 to 1.5 (1.0 = 100%)
   - `videoAudioVolume`: 0.1 to 1.0

### Music extraction failed from YouTube
→ Some videos have DRM protection
→ Use Approach 5 (free music search) instead

---

## 🎁 FREE MUSIC SOURCES (No Keys Required)

1. **Pixabay Music** - `GET /api/music/search?q=anime&library=pixabay`
2. **Archive.org Audio** - `GET /api/music/search?q=bgm&library=archive`
3. **Built-in Anime Music** - Default tracks included

---

## 📊 NEXT STEPS

1. **Test APPROACH 2** - Easiest & most reliable
2. **Upload anime video + music file**
3. **Schedule post**
4. **Let scheduler auto-publish**
5. **Enjoy automatic anime reels with music! 🎵**

---

**All systems are GO!** Your application now supports uploading anime reels with music in **6 different ways**. Pick whichever works best for you! 🚀
