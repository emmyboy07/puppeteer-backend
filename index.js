const puppeteer = require('puppeteer');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());

function getRandomUserAgent() {
    const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.82 Safari/537.36',
        'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:47.0) Gecko/20100101 Firefox/47.0',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.120 Safari/537.36',
        'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.90 Mobile Safari/537.36'
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

async function createBrowser() {
    const browser = await puppeteer.launch({
        executablePath: process.env.NODE_ENV === 'production'
            ? process.env.PUPPETEER_EXECUTABLE_PATH
            : puppeteer.executablePath(),
        headless: 'new',
        args: ['--no-sandbox', '--disable-dev-shm-usage', '--start-maximized']
    });

    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({
        'User-Agent': getRandomUserAgent(),
        'Referer': 'https://moviebox.ng/'
    });
    await page.setViewport({ width: 1920, height: 1080 });

    return { browser, page };
}

async function fetchMovieData(movie_name) {
    let browser;
    try {
        console.log(`🎬 Searching MovieBox for: ${movie_name}`);
        const { browser: b, page } = await createBrowser();
        browser = b;

        const searchUrl = `https://moviebox.ng/web/searchResult?keyword=${encodeURIComponent(movie_name)}`;
        await page.goto(searchUrl);
        await page.waitForSelector('div.pc-card-btn', { timeout: 60000 });
        console.log("🔎 Search results loaded.");

        await page.click('div.pc-card-btn');
        await page.waitForNavigation({ waitUntil: 'domcontentloaded' });
        console.log("📄 Movie detail page loaded.");

        const movieUrl = page.url();
        console.log(`📺 Movie URL: ${movieUrl}`);

        const subjectIdMatch = movieUrl.match(/id=(\d+)/);
        if (!subjectIdMatch) {
            throw new Error("❌ Could not extract subjectId from URL.");
        }

        const subjectId = subjectIdMatch[1];
        const downloadUrl = `https://moviebox.ng/wefeed-h5-bff/web/subject/download?subjectId=${subjectId}&se=0&ep=0`;
        console.log(`🌐 Download URL: ${downloadUrl}`);

        const downloadPage = await browser.newPage();
        await downloadPage.setExtraHTTPHeaders({
            'User-Agent': getRandomUserAgent(),
            'Referer': 'https://moviebox.ng/'
        });

        await downloadPage.goto(downloadUrl, { waitUntil: 'domcontentloaded' });

        const jsonData = await downloadPage.evaluate(() => {
            try {
                return JSON.parse(document.body.innerText);
            } catch (e) {
                return { error: 'Failed to parse JSON' };
            }
        });

        // Safely check for captions
        if (jsonData?.data?.captions && Array.isArray(jsonData.data.captions)) {
            jsonData.data.captions = jsonData.data.captions.filter(c => c.lan === 'en');
        }

        return jsonData;

    } catch (error) {
        console.error(`💥 Error: ${error.message}`);
        return { error: error.message };
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

app.get("/download", async (req, res) => {
    const movie_name = req.query.movie;
    if (!movie_name) {
        return res.status(400).json({ error: "Please provide a movie name using the 'movie' query parameter" });
    }

    const result = await fetchMovieData(movie_name);
    res.json(result);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});
