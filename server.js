import express from "express";
import cors from "cors";
import ytdl from "@distube/ytdl-core";
import fetch from "node-fetch";
import { exec } from "child_process";
import fs from "fs";
import path from "path";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Cloud Downloader API is running!");
});

app.get("/convert", async (req, res) => {
  try {
    const videoUrl = req.query.url;
    if (!videoUrl)
      return res.json({ success: false, error: "Missing url" });

    console.log("🔥 Convert request:", videoUrl);

    /* -----------------------------
       YOUTUBE
    ----------------------------- */
    if (ytdl.validateURL(videoUrl)) {
      console.log("🎬 YouTube detected");

      const info = await ytdl.getInfo(videoUrl);
      const format = ytdl.chooseFormat(info.formats, {
        quality: "highest",
        filter: "videoandaudio",
      });

      return res.json({
        success: true,
        source: "direct",
        videoUrl: format.url,
      });
    }

    /* -----------------------------
       HLS / M3U8
    ----------------------------- */
    if (videoUrl.includes(".m3u8")) {
      console.log("📡 HLS detected → converting with ffmpeg");

      const fileName = `video_${Date.now()}.mp4`;
      const outputPath = path.join("/tmp", fileName);

      const cmd = `ffmpeg -y -i "${videoUrl}" -c copy "${outputPath}"`;

      exec(cmd, async (err) => {
        if (err) {
          console.log("❌ FFmpeg error:", err);
          return res.json({ success: false, error: "FFmpeg failed" });
        }

        console.log("✅ MP4 created:", outputPath);

        // Upload file to your server (simple local HTTP server)
        const fileBuffer = fs.readFileSync(outputPath);
        const base64 = fileBuffer.toString("base64");

        return res.json({
          success: true,
          source: "mp4",
          fileName,
          base64,
        });
      });

      return;
    }

    /* -----------------------------
       DIRECT MP4
    ----------------------------- */
    return res.json({
      success: true,
      source: "direct",
      videoUrl,
    });
  } catch (err) {
    console.log("❌ ERROR:", err);
    return res.json({ success: false, error: err.toString() });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🌐 Cloud Downloader API running at port ${PORT}`);
});
