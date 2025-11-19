app.get("/convert", async (req, res) => {
  try {
    const videoUrl = req.query.url;
    if (!videoUrl) {
      return res.json({ success: false, error: "Missing URL" });
    }

    console.log("🔥 Requested:", videoUrl);

    const ytdl = require("@distube/ytdl-core");

    if (ytdl.validateURL(videoUrl)) {
      const info = await ytdl.getInfo(videoUrl);
      const format = ytdl.chooseFormat(info.formats, { quality: "highest" });

      return res.json({
        success: true,
        source: "youtube",
        videoUrl: format.url
      });
    }


    if (videoUrl.includes(".m3u8")) {
      return res.json({
        success: true,
        source: "m3u8",
        videoUrl
      });
    }

    return res.json({
      success: true,
      source: "direct",
      videoUrl
    });
  } catch (err) {
    console.log("❌ ERROR:", err);
    res.json({ success: false, error: err.toString() });
  }
});
