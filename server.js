import express from "express";
import cors from "cors";
import ytdl from "@distube/ytdl-core";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Cloud Downloader API is running!");
});

/* ======================================================
   🔥 /convert — universal extractor
   - YouTube → highest MP4
   - Direct MP4
   - M3U8 → segment list
====================================================== */

app.get("/convert", async (req, res) => {
  try {
    const videoUrl = req.query.url;
    if (!videoUrl) {
      return res.json({ success: false, error: "Missing url parameter" });
    }

    console.log("🔥 Extract request:", videoUrl);

    /* ---------- YOUTUBE ---------- */
    if (ytdl.validateURL(videoUrl)) {
      console.log("🎬 YouTube detected");

      const info = await ytdl.getInfo(videoUrl);

      const format = ytdl.chooseFormat(info.formats, {
        quality: "highestvideo",
        filter: "videoandaudio"
      });

      return res.json({
        success: true,
        source: "youtube",
        videoUrl: format.url
      });
    }

    /* ---------- HLS / M3U8 ---------- */
    if (videoUrl.includes(".m3u8")) {
      console.log("📡 M3U8 detected");

      const playlist = await fetch(videoUrl).then(r => r.text());

      // extract .ts segments
      const segments = playlist
        .split("\n")
        .filter(line => line.endsWith(".ts"));

      if (segments.length === 0) {
        return res.json({
          success: false,
          error: "No TS segments found in m3u8"
        });
      }

      // build full URLs
      const baseUrl = videoUrl.split("/").slice(0, -1).join("/");

      const fullSegments = segments.map(seg => {
        if (seg.startsWith("http")) return seg;
        return baseUrl + "/" + seg;
      });

      return res.json({
        success: true,
        source: "hls",
        totalSegments: fullSegments.length,
        segments: fullSegments
      });
    }

    /* ---------- DIRECT MP4 ---------- */
    return res.json({
      success: true,
      source: "direct",
      videoUrl
    });

  } catch (err) {
    console.log("❌ ERROR:", err);
    res.json({
      success: false,
      error: err.toString()
    });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log(`🌐 Cloud Downloader API running at port ${PORT}`)
);
