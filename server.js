import express from "express";
import cors from "cors";
import ytdl from "@distube/ytdl-core";
import fetch from "node-fetch";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";

const app = express();
app.use(cors());
app.use(express.json());

// Serve local tmp files
app.use("/videos", express.static("/tmp"));

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118 Safari/537.36";

/* ===================================================================
    FETCH TEXT UTILITY
=================================================================== */
async function fetchText(url, headers = {}) {
  const res = await fetch(url, { headers });
  return await res.text();
}

/* ===================================================================
    1) TRY TO USE FFMPEG FIRST (FASTER + CLEANER)
=================================================================== */
function ffmpegConvert(m3u8Url, outputPath, extraHeaders = "") {
  return new Promise((resolve) => {
    const cmd = `ffmpeg -y \
      -user_agent "${UA}" \
      -headers "${extraHeaders}" \
      -protocol_whitelist \"file,http,https,tcp,tls,crypto\" \
      -allowed_extensions ALL \
      -i "${m3u8Url}" \
      -c copy -bsf:a aac_adtstoasc \
      "${outputPath}"`;

    exec(cmd, (err, stdout, stderr) => {
      if (err) return resolve(false);
      resolve(true);
    });
  });
}

/* ===================================================================
    2) FALLBACK: MANUAL SEGMENT DOWNLOADER
=================================================================== */
async function manualDownload(m3u8Url, finalOutput) {
  try {
    const base = m3u8Url.split("/").slice(0, -1).join("/");
    const playlistText = await fetchText(m3u8Url, {
      "User-Agent": UA,
      Referer: base,
    });

    const lines = playlistText.split("\n").filter((l) => l.includes(".ts"));

    if (lines.length === 0) return false;

    const segmentPaths = [];
    const tempFolder = `/tmp/seg_${Date.now()}`;

    fs.mkdirSync(tempFolder);

    let index = 0;
    for (const seg of lines) {
      const segUrl = seg.startsWith("http") ? seg : base + "/" + seg;
      const segPath = `${tempFolder}/${index}.ts`;

      const r = await fetch(segUrl, {
        headers: { "User-Agent": UA, Referer: base },
      });

      const buf = await r.arrayBuffer();
      fs.writeFileSync(segPath, Buffer.from(buf));
      segmentPaths.push(segPath);
      index++;
    }

    // MERGE ALL TS
    const concatList = `${tempFolder}/list.txt`;
    fs.writeFileSync(
      concatList,
      segmentPaths.map((p) => `file '${p}'`).join("\n")
    );

    const cmd = `ffmpeg -y -f concat -safe 0 -i "${concatList}" -c copy "${finalOutput}"`;

    return new Promise((resolve) => {
      exec(cmd, () => {
        fs.rmSync(tempFolder, { recursive: true });
        resolve(true);
      });
    });
  } catch (e) {
    return false;
  }
}

/* ===================================================================
    3) MAIN ROUTE
=================================================================== */
app.get("/convert", async (req, res) => {
  try {
    const videoUrl = req.query.url;
    let cookies = req.headers["x-download-cookies"] || "";
    let referer = req.headers["x-download-referer"] || videoUrl;
    let extraHeaders = `User-Agent: ${UA}\nReferer: ${referer}\nCookie: ${cookies}`;

    if (!videoUrl)
      return res.json({ success: false, error: "Missing url" });

    console.log("🔥 REQUEST:", videoUrl);

    /* 1. YOUTUBE */
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

    /* 2. DIRECT MP4 */
    if (videoUrl.endsWith(".mp4")) {
      return res.json({
        success: true,
        source: "direct",
        videoUrl,
      });
    }

    /* 3. HLS / M3U8 */
    if (videoUrl.includes(".m3u8")) {
      console.log("📡 HLS detected");

      const fileId = nanoid();
      const fileName = `video_${fileId}.mp4`;
      const outputPath = `/tmp/${fileName}`;

      // Try FFMPEG first
      const ok = await ffmpegConvert(videoUrl, outputPath, extraHeaders);

      if (ok) {
        console.log("🎉 FFMPEG SUCCESS");
        return res.json({
          success: true,
          source: "direct",
          videoUrl: `https://cloud-downloader-1.onrender.com/videos/${fileName}`,
        });
      }

      // Fallback to manual download
      console.log("⚠ FFmpeg failed → starting fallback…");

      const fallbackOK = await manualDownload(videoUrl, outputPath);

      if (!fallbackOK) {
        console.log("❌ Fallback also failed.");
        return res.json({ success: false, error: "HLS download failed" });
      }

      console.log("🎉 FALLBACK SUCCESS");
      return res.json({
        success: true,
        source: "direct",
        videoUrl: `https://cloud-downloader-1.onrender.com/videos/${fileName}`,
      });
    }

    // Unknown file format → return direct stream
    return res.json({
      success: true,
      source: "direct",
      videoUrl,
    });
  } catch (err) {
    console.log("❌ SERVER ERROR:", err);
    return res.json({ success: false, error: err.toString() });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log(`🚀 API running on port ${PORT}`)
);
