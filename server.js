app.get("/convert", async (req, res) => {
  try {
    const videoUrl = req.query.url;
    if (!videoUrl) {
      return res.json({ success: false, error: "Missing url parameter" });
    }

    console.log("🔥 Extract:", videoUrl);

    // YouTube
    if (ytdl.validateURL(videoUrl)) {
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

    // ---------- HLS / M3U8 ---------- //
    if (videoUrl.includes(".m3u8")) {
      console.log("📡 M3U8 detected");

      const fetchPlaylist = async (url) => {
        const text = await fetch(url).then(r => r.text());
        return text;
      };

      const master = await fetchPlaylist(videoUrl);

      // Does not contain TS → means MASTER playlist (multiple sub-playlists)
      const variantLines = master
        .split("\n")
        .filter(l => l.endsWith(".m3u8"));

      if (variantLines.length > 0) {
        console.log("➡ Master playlist detected");

        // choose highest resolution child playlist
        const child = variantLines[variantLines.length - 1];

        const base = videoUrl.split("/").slice(0, -1).join("/");
        const childUrl = child.startsWith("http") ? child : base + "/" + child;

        console.log("➡ Fetching child playlist:", childUrl);

        const childPlaylist = await fetchPlaylist(childUrl);

        const tsSegments = childPlaylist
          .split("\n")
          .filter(l => l.endsWith(".ts"));

        if (tsSegments.length === 0) {
          return res.json({
            success: false,
            error: "No TS segments found in child playlist"
          });
        }

        const segmentBase = childUrl.split("/").slice(0, -1).join("/");

        const fullSegments = tsSegments.map(seg =>
          seg.startsWith("http") ? seg : segmentBase + "/" + seg
        );

        return res.json({
          success: true,
          source: "hls",
          segments: fullSegments,
          totalSegments: fullSegments.length
        });
      }

      // Normal HLS (already contains TS)
      const tsSegments = master
        .split("\n")
        .filter(l => l.endsWith(".ts"));

      const base = videoUrl.split("/").slice(0, -1).join("/");

      const fullSegments = tsSegments.map(seg =>
        seg.startsWith("http") ? seg : base + "/" + seg
      );

      return res.json({
        success: true,
        source: "hls",
        totalSegments: fullSegments.length,
        segments: fullSegments
      });
    }

    // Direct MP4
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
