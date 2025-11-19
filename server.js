app.get("/convert", async (req, res) => {
  try {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.json({ success: false, error: "Missing url parameter" });

    console.log("🔥 Extract request:", videoUrl);

    /* ============================================
       1️⃣ YOUTUBE MP4 (KEEP SAME)
    ============================================ */
    if (ytdl.validateURL(videoUrl)) {
      console.log("🎬 YouTube detected");
      const info = await ytdl.getInfo(videoUrl);
      const format = ytdl.chooseFormat(info.formats, { quality: "highestvideo" });

      return res.json({
        success: true,
        source: "youtube",
        quality: format.qualityLabel,
        videoUrl: format.url
      });
    }

    /* ============================================
       2️⃣ HLS (.m3u8) SUPPORT — RETURN SEGMENT LIST
    ============================================ */
    if (videoUrl.includes(".m3u8")) {
      console.log("📡 HLS detected:", videoUrl);

      const m3u8Text = await fetch(videoUrl).then(r => r.text());

      // Extract TS segments
      const lines = m3u8Text.split("\n");
      const segments = lines.filter(l => l.endsWith(".ts"));

      if (segments.length === 0) {
        return res.json({
          success: false,
          error: "No .ts segments found"
        });
      }

      // Convert relative paths → full URL
      const base = videoUrl.split("index.m3u8")[0]
        || videoUrl.split("master.m3u8")[0]
        || videoUrl.substring(0, videoUrl.lastIndexOf("/") + 1);

      const fullSegments = segments.map(s => base + s);

      return res.json({
        success: true,
        source: "hls",
        totalSegments: fullSegments.length,
        segments: fullSegments
      });
    }

    /* ============================================
       3️⃣ DIRECT VIDEO (MP4, WEBM…)
    ============================================ */
    return res.json({
      success: true,
      source: "direct",
      videoUrl
    });

  } catch (err) {
    console.log("❌ ERROR:", err);
    return res.json({
      success: false,
      error: err.toString()
    });
  }
});
