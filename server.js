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

      // FIX #1 — detect child playlists with params
      const variantPlaylists = lines.filter((l) =>
        /\.(m3u8)(\?|$)/.test(l.trim())
      );

      console.log("🎞 Variant playlists found:", variantPlaylists.length);

      // FIX #2 — resolve child playlist URL properly
      const playlistToParse =
        variantPlaylists.length > 0
          ? buildChildUrl(videoUrl, variantPlaylists[variantPlaylists.length - 1])
          : videoUrl;

      console.log("➡ Final playlist to parse:", playlistToParse);

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
   HELPERS (FIXED)
====================================================== */

// FIX #2a — Proper child playlist URL resolution
function buildChildUrl(masterUrl, childLine) {
  try {
    const resolved = new URL(childLine.trim(), masterUrl).toString();
    console.log("➡ Child playlist:", resolved);
    return resolved;
  } catch (e) {
    console.log("❌ Failed resolving child URL:", e);
    return masterUrl;
  }
}

// FIX #3 — resolve segments USING URL()
function resolveUrl(baseUrl, file) {
  try {
    return new URL(file.trim(), baseUrl).toString();
  } catch {
    const base = baseUrl.split("/").slice(0, -1).join("/");
    return `${base}/${file}`;
  }
}

function extractSegments(baseUrl, lines) {
  const segments = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // TS segments
    if (line.endsWith(".ts")) {
      segments.push(resolveUrl(baseUrl, line));
    }

    // m4s, mp4 chunks, etc
    if (
      line.endsWith(".m4s") ||
      line.endsWith(".mp4") ||
      line.endsWith(".cmfv") ||
      line.endsWith(".chunk")
    ) {
      segments.push(resolveUrl(baseUrl, line));
    }

    // EXTINF → next line is a segment
    if (line.startsWith("#EXTINF")) {
      const next = lines[i + 1]?.trim();
      if (next && !next.startsWith("#")) {
        segments.push(resolveUrl(baseUrl, next));
      }
    }
  }

  console.log("📦 Extracted segments:", segments.length);
  return segments;
}

/* ======================================================
   START SERVER
====================================================== */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🌐 Cloud Downloader API running at port ${PORT}`);
});
