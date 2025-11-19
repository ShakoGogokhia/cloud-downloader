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
   UNIVERSAL VIDEO EXTRACTOR
======================================================= */
app.get("/convert", async (req, res) => {
  try {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.json({ success: false, error: "Missing url" });

    console.log("\n🔥 Extract request:", videoUrl);

    /* ---------- YOUTUBE ---------- */
    if (ytdl.validateURL(videoUrl)) {
      console.log("🎬 YouTube detected");

      const info = await ytdl.getInfo(videoUrl);
      const format = ytdl.chooseFormat(info.formats, {
        quality: "highest",
        filter: "videoandaudio",
      });

      return res.json({
        success: true,
        source: "youtube",
        videoUrl: format.url,
      });
    }

    /* ---------- M3U8 / HLS ---------- */
    if (videoUrl.includes(".m3u8")) {
      console.log("📡 M3U8 detected");

      const fetchText = async (url) => await fetch(url).then((r) => r.text());
      const text = await fetchText(videoUrl);
      const lines = text.split("\n");

      // detect child playlists
      const variantPlaylists = lines.filter((l) =>
        l.trim().endsWith(".m3u8")
      );

      const playlistToParse =
        variantPlaylists.length > 0
          ? buildChildUrl(videoUrl, variantPlaylists[variantPlaylists.length - 1])
          : videoUrl;

      const playlistText = await fetchText(playlistToParse);
      const playlistLines = playlistText.split("\n");

      const segments = extractSegments(playlistToParse, playlistLines);

      if (segments.length === 0) {
        return res.json({
          success: false,
          error: "No segments found",
        });
      }

      return res.json({
        success: true,
        source: "hls",
        segments,
        totalSegments: segments.length,
      });
    }

    /* ---------- DIRECT MP4 ---------- */
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

/* ======================================================
   HELPERS
====================================================== */

function buildChildUrl(masterUrl, childLine) {
  if (childLine.startsWith("http")) return childLine;
  const base = masterUrl.split("/").slice(0, -1).join("/");
  const childUrl = `${base}/${childLine}`;
  console.log("➡ Child playlist:", childUrl);
  return childUrl;
}

function extractSegments(baseUrl, lines) {
  const base = baseUrl.split("/").slice(0, -1).join("/");

  const segments = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // match TS segments
    if (line.endsWith(".ts")) {
      segments.push(resolveUrl(base, line));
    }

    // PHN / XV style segments: .mp4 chunks, .m4s, .chunk
    if (
      line.endsWith(".m4s") ||
      line.endsWith(".mp4") ||
      line.endsWith(".cmfv") ||
      line.endsWith(".chunk")
    ) {
      segments.push(resolveUrl(base, line));
    }

    // EXTINF lines: next line is segment file
    if (line.startsWith("#EXTINF")) {
      const next = lines[i + 1]?.trim();
      if (next && !next.startsWith("#")) {
        segments.push(resolveUrl(base, next));
      }
    }
  }

  console.log("📦 Extracted segments:", segments.length);
  return segments;
}

function resolveUrl(base, file) {
  return file.startsWith("http") ? file : `${base}/${file}`;
}

/* ======================================================
   START SERVER
====================================================== */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🌐 Cloud Downloader API running at port ${PORT}`);
});
