import express from "express";
import compression from "compression";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Enable gzip/deflate response compression
app.use(compression({
  threshold: 512
}));

// Explicit HTML Page Routes with fast cache & stale-while-revalidate
const sendHtml = (res, file) => {
  res.setHeader("Cache-Control", "public, max-age=600, stale-while-revalidate=86400");
  res.sendFile(path.join(__dirname, file));
};

app.get("/", (req, res) => sendHtml(res, "index.html"));
app.get("/about", (req, res) => sendHtml(res, "about.html"));
app.get("/faq", (req, res) => sendHtml(res, "faq.html"));
app.get("/terms", (req, res) => sendHtml(res, "terms.html"));
app.get("/signup", (req, res) => sendHtml(res, "signup.html"));
app.get("/apply", (req, res) => sendHtml(res, "signup.html"));

// Serve static assets with fine-tuned caching
app.use(express.static(__dirname, {
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    if ([".webp", ".png", ".jpg", ".jpeg", ".svg", ".gif", ".woff2", ".woff"].includes(ext)) {
      res.setHeader("Cache-Control", "public, max-age=2592000, immutable");
    } else if ([".css", ".js"].includes(ext)) {
      res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
    } else if (ext === ".html") {
      res.setHeader("Cache-Control", "public, max-age=600, stale-while-revalidate=86400");
    }
  }
}));

// Fallback all other routes to index.html
app.get("*", (req, res) => sendHtml(res, "index.html"));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});
