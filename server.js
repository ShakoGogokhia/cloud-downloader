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

/* =======================================================
   /convert — UNIVERSAL VIDEO EXTRACTOR
======================================================= */

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
        quality: "highest",
        filter: "videoandaudio"
      });

      return res.json({
        success: true,
        source: "youtube",
        videoUrl: format.url
      });
    }

    /* ---------- M3U8 / HLS ---------- */
    if (videoUrl.includes(".m3u8")) {
      console.log("📡 M3U8 detected");

      const getPlaylist = async (url) =>
        await fetch(url).then((res) => res.text());

      const text = await getPlaylist(videoUrl);
      const lines = text.split("\n");

      // detect child playlists
      const variants = lines.filter((l) => l.trim().endsWith(".m3u8"));

      if (variants.length > 0) {
        const child = variants[variants.length - 1];

        const base = videoUrl.split("/").slice(0, -1).join("/");
        const childUrl = child.startsWith("http")
          ? child
          : `${base}/${child}`;

        console.log("➡ Child playlist:", childUrl);

        const childText = await getPlaylist(childUrl);

        const tsLines = childText
          .split("\n")
          .filter((l) => l.trim().endsWith(".ts"));

        if (tsLines.length === 0) {
          return res.json({
            success: false,
            error: "No TS segments found in child playlist"
          });
        }

        const childBase = childUrl.split("/").slice(0, -1).join("/");

        const fullSegments = tsLines.map((ts) =>
          ts.startsWith("http") ? ts : `${childBase}/${ts}`
        );

        return res.json({
          success: true,
          source: "hls",
          segments: fullSegments,
          totalSegments: fullSegments.length
        });
      }

      // direct TS playlist
      const tsSegments = lines.filter((l) => l.trim().endsWith(".ts"));
      const base = videoUrl.split("/").slice(0, -1).join("/");

      const fullSegments = tsSegments.map((ts) =>
        ts.startsWith("http") ? ts : `${base}/${ts}`
      );

      return res.json({
        success: true,
        source: "hls",
        segments: fullSegments,
        totalSegments: fullSegments.length
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
    return res.json({ success: false, error: err.toString() });
  }
});

/* =======================================================
   START SERVER
======================================================= */

const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log(`🌐 Cloud Downloader API running at port ${PORT}`)
);
