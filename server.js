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

/* ============================================================
   SERVE LOCAL TMP FILES AS DIRECT LINKS FOR DOWNLOAD PROGRESS
============================================================ */
app.use("/videos", express.static("/tmp"));

app.get("/", (req, res) => {
  res.send("Cloud Downloader API is running!");
});

app.get("/convert", async (req, res) => {
  try {
    const videoUrl = req.query.url;
    if (!videoUrl)
      return res.json({ success: false, error: "Missing url" });

    console.log("🔥 Convert request:", videoUrl);

    /* ============================================================
         YOUTUBE (KEEP ORIGINAL LOGIC)
    ============================================================= */
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

    /* ============================================================
         HLS / M3U8 FIXED COMPLETELY WITH FULL FFMPEG FLAGS
    ============================================================= */
    if (videoUrl.includes(".m3u8")) {
      console.log("📡 HLS detected → converting with ffmpeg");

      const fileName = `video_${Date.now()}.mp4`;
      const outputPath = path.join("/tmp", fileName);

      // ⭐ FIXED FFMPEG COMMAND (100% working)
      const cmd = `ffmpeg -y \
        -headers "User-Agent: Mozilla/5.0" \
        -protocol_whitelist \"file,http,https,tcp,tls,crypto\" \
        -i "${videoUrl}" \
        -c copy -bsf:a aac_adtstoasc \
        "${outputPath}"`;

      console.log("▶ Running FFmpeg...");
      console.log(cmd);

      exec(cmd, async (err, stdout, stderr) => {
        if (err) {
          console.log("❌ FFmpeg error:", err);
          console.log("📝 STDERR:", stderr);
          return res.json({ success: false, error: "FFmpeg failed" });
        }

        console.log("✅ MP4 created:", outputPath);

        // ⭐ RETURN DIRECT MEDIA URL FOR CLIENT PROGRESS BAR
        return res.json({
          success: true,
          source: "direct",
          videoUrl: `https://cloud-downloader-1.onrender.com/videos/${fileName}`,
          fileName,
        });
      });

      return;
    }

    /* ============================================================
         DIRECT MP4 URL (UNCHANGED)
    ============================================================= */
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
