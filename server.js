import express from "express";
import cors from "cors";
import ytdl from "@distube/ytdl-core";

const app = express();
app.use(cors());
app.use(express.json());

// 🧪 ROOT CHECK
app.get("/", (req, res) => {
  res.send("Cloud Downloader API is running!");
});

/* ======================================================
   🔥 /convert — universal video extractor
   Works for: YouTube, m3u8, HLS, direct MP4
====================================================== */

app.get("/convert", async (req, res) => {
  try {
    const videoUrl = req.query.url;
    if (!videoUrl) {
      return res.json({ success: false, error: "Missing url parameter" });
    }

    console.log("🔥 Extract request:", videoUrl);

    // ---- YOUTUBE SUPPORT ----
    if (ytdl.validateURL(videoUrl)) {
      console.log("🎬 YouTube URL detected");

      const info = await ytdl.getInfo(videoUrl);

      // get highest quality MP4 stream
      const format = ytdl.chooseFormat(info.formats, { quality: "highestvideo" });

      if (!format || !format.url) {
        return res.json({
          success: false,
          error: "Failed to extract MP4 stream"
        });
      }

      return res.json({
        success: true,
        source: "youtube",
        videoUrl: format.url
      });
    }

    // ---- M3U8 / HLS SUPPORT ----
    if (videoUrl.includes(".m3u8") || videoUrl.includes("master.m3u8")) {
      console.log("📡 HLS/m3u8 stream detected");

      return res.json({
        success: true,
        source: "m3u8",
        videoUrl
      });
    }

    // ---- DIRECT MP4 / WEB STREAM ----
    console.log("➡ Direct video stream");
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

/* ======================================================
   🚀 START SERVER
====================================================== */

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🌐 Cloud Downloader API running at port ${PORT}`);
});
