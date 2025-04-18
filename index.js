const puppeteer = require('puppeteer');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());

const TMDB_API_KEY = '1e2d76e7c45818ed61645cb647981e5c';

async function getTMDBData(tmdb_id, type) {
    const url = `https://api.themoviedb.org/3/${type}/${tmdb_id}?api_key=${TMDB_API_KEY}`;
    try {
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        console.error(`❌ TMDB fetch error: ${error.message}`);
        return null;
    }
}

async function createBrowser() {
    console.log("🚀 Launching browser...");
    const browser = await puppeteer.launch({
        executablePath: process.env.NODE_ENV === 'production'
            ? process.env.PUPPETEER_EXECUTABLE_PATH
            : puppeteer.executablePath(),
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--single-process',
        ],
    });

    if (!browser) throw new Error("❌ Browser did not launch");

    const page = await browser.newPage();

    try {
        if (!page.isClosed()) {
            console.log("🖥 Setting viewport...");
            await page.setViewport({ width: 1920, height: 1080 });
            console.log("✅ Viewport set");
        }
    } catch (err) {
        console.warn('⚠️ Could not set viewport:', err.message);
    }

    return { browser, page };
}

async function fetchDownloadLink(title, expectedYear = null, matchYear = true) {
    let browser;
    try {
        console.log(`🎬 Searching MovieBox for: ${title} ${expectedYear || ''}`);
        const { browser: b, page } = await createBrowser();
        browser = b;

        const searchQuery = matchYear && expectedYear ? `${title} ${expectedYear}` : title;
        const searchUrl = `https://moviebox.ng/web/searchResult?keyword=${encodeURIComponent(searchQuery)}`;
        await page.goto(searchUrl);
        await page.waitForSelector('div.pc-card-btn', { timeout: 60000 });

        let found = false;
        let movieUrl;
        let downloadUrl;

        for (let i = 1; i <= 4; i++) {
            console.log(`➡️ Trying result #${i}`);

            await page.evaluate((index) => {
                const result = document.querySelectorAll('div.pc-card-btn')[index - 1];
                if (result) result.click();
            }, i);

            await page.waitForNavigation({ waitUntil: 'domcontentloaded' });
            movieUrl = page.url();

            let extractedTitle = '';
            try {
                extractedTitle = await page.$eval('h2.pc-title', el => el.innerText.trim());
            } catch {}

            let titleMatch = extractedTitle.toLowerCase().trim() === title.toLowerCase().trim();
            let yearMatch = true;

            if (matchYear) {
                try {
                    const releaseDateText = await page.$eval('div.pc-time', el => el.innerText);
                    const foundYear = releaseDateText.split('-')[0];
                    yearMatch = foundYear === expectedYear;
                } catch {
                    yearMatch = false;
                }
            }

            if (titleMatch && yearMatch) {
                found = true;
                break;
            } else {
                console.log(`❌ No match: title=${titleMatch}, year=${yearMatch}`);
            }

            await page.goBack();
            await page.waitForSelector('div.pc-card-btn');
        }

        if (!found) return { error: "Download unavailable" };

        const subjectIdMatch = movieUrl.match(/id=(\d+)/);
        if (!subjectIdMatch) throw new Error("❌ Could not extract subjectId from URL.");

        const subjectId = subjectIdMatch[1];
        downloadUrl = `https://moviebox.ng/wefeed-h5-bff/web/subject/download?subjectId=${subjectId}&se=0&ep=0`;

        return {
            title,
            releaseYear: expectedYear,
            downloadUrl,
        };

    } catch (error) {
        console.error(`💥 Error: ${error.message}`);
        return { error: error.message };
    } finally {
        if (browser) await browser.close();
    }
}

app.get("/download", async (req, res) => {
    const tmdb_id = req.query.tmdb_id;
    const type = req.query.type === 'tv' ? 'tv' : 'movie'; // default to movie

    if (!tmdb_id) {
        return res.status(400).json({ error: "Please provide a TMDB ID using the 'tmdb_id' query parameter" });
    }

    const tmdbData = await getTMDBData(tmdb_id, type);
    if (!tmdbData) {
        return res.status(500).json({ error: "Could not fetch data from TMDB" });
    }

    const title = type === 'tv' ? tmdbData.name : tmdbData.title;
    const expectedYear = type === 'tv' ? null : tmdbData.release_date.split('-')[0];

    const result = await fetchDownloadLink(title, expectedYear, type === 'movie');

    if (result.error) {
        return res.status(404).json(result);
    }

    res.json(result);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
