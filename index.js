const express = require("express");
const { chromium } = require("playwright");
require("dotenv").config();

const app = express();

app.get("/", (req, res) => {
  res.status(200).send("Playwright scraper live — use /scrape?asin=...");
});

app.get("/scrape", async (req, res) => {
  const { asin } = req.query;

  if (!asin) {
    return res.status(400).json({ error: "Missing ASIN parameter" });
  }

  try {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    const url = `https://www.amazon.fr/product-reviews/${asin}`;
    await page.goto(url, { waitUntil: "networkidle" });

    // Check for CAPTCHA
    const pageContent = await page.content();
    if (pageContent.includes("captcha")) {
      throw new Error("CAPTCHA triggered");
    }

    // Scrape review data
    const reviews = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('[data-hook="review"]')).map((el) => ({
        title: el.querySelector('[data-hook="review-title"]')?.innerText.trim() || "",
        rating: el.querySelector('[data-hook="review-star-rating"]')?.innerText.split(" ")[0] || "",
        body: el.querySelector('[data-hook="review-body"] span')?.innerText.trim() || "",
        date: el.querySelector('[data-hook="review-date"]')?.innerText.trim() || "",
        reviewer: el.querySelector('.a-profile-name')?.innerText.trim() || "",
        verified: el.querySelector('[data-hook="avp-badge"]') !== null
      }));
    });

    await browser.close();
    res.json({ asin, reviews });

  } catch (err) {
    console.error("Scraping failed:", err.message);
    res.status(500).json({ error: "Scraping failed", details: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
