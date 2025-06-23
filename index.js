const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
require('dotenv').config();

puppeteer.use(StealthPlugin());
const app = express();

app.get('/', (req, res) => {
  res.send('Amazon Scraper Running. Use /scrape?asin=...');
});

app.get('/scrape', async (req, res) => {
  const asin = req.query.asin;
  if (!asin) return res.status(400).json({ error: 'Missing ASIN parameter' });

  try {
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--window-size=1920x1080'
  ]
});
    const page = await browser.newPage();

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)...');
    await page.setViewport({ width: 1366, height: 768 });

    const reviewUrl = `https://www.amazon.fr/product-reviews/${asin}/`;
    await page.goto(reviewUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    const content = await page.content();
    if (content.includes('captcha')) throw new Error('CAPTCHA triggered');

    const reviews = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('[data-hook="review"]')).map((el) => ({
        title: el.querySelector('[data-hook="review-title"]')?.innerText.trim(),
        rating: el.querySelector('[data-hook="review-star-rating"]')?.innerText.split(' ')[0],
        body: el.querySelector('[data-hook="review-body"] span')?.innerText.trim(),
        date: el.querySelector('[data-hook="review-date"]')?.innerText.trim(),
        reviewer: el.querySelector('.a-profile-name')?.innerText.trim(),
        verified: !!el.querySelector('[data-hook="avp-badge"]'),
        page: 1
      }));
    });

    await browser.close();
    res.json({ asin, reviews });
  } catch (err) {
    console.error('Scraping failed:', err.message);
    res.status(500).json({ error: 'Scraping failed', details: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
