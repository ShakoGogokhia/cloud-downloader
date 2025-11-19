import express from "express";
import cors from "cors";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

const app = express();
app.use(cors());
app.use(express.json());

const VIDEO_DIR = path.join(process.cwd(), "videos");
if (!fs.existsSync(VIDEO_DIR)) fs.mkdirSync(VIDEO_DIR);

app.post("/convert", async (req, res) => {
  const { url } = req.body;

  if (!url) return res.json({ error: "No URL provided" });

  const output = path.join(VIDEO_DIR, `video_${Date.now()}.mp4`);

  console.log("🎬 Converting:", url);

  const ffmpeg = spawn("ffmpeg", [
    "-i", url,
    "-c", "copy",
    output
  ]);

  ffmpeg.stderr.on("data", (d) => console.log(d.toString()));

  ffmpeg.on("close", () => {
    console.log("✔ Conversion done:", output);

    res.json({
      success: true,
      mp4: `/videos/${path.basename(output)}`
    });
  });
});

app.use("/videos", express.static(VIDEO_DIR));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("🌐 Cloud Downloader running on port", PORT));
