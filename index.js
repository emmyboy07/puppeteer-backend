const puppeteer = require('puppeteer');
const express = require('express');
const cors = require('cors');
const logging = require('console');
require('dotenv').config(); // Load environment variables from .env file

const app = express();

app.use(cors());

// Function to get a random User-Agent from the list
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

// Function to configure Puppeteer for scraping
async function createBrowser() {
    const browser = await puppeteer.launch({
        executablePath: process.env.NODE_ENV === 'production'
            ? process.env.PUPPETEER_EXECUTABLE_PATH
            : puppeteer.executablePath(),
        headless: true,
        args: ["--no-sandbox", "--disable-dev-shm-usage", "--start-maximized"]
    });
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({
        'User-Agent': getRandomUserAgent(),
        'Referer': 'https://moviebox.ng/'
    });
    await page.setViewport({ width: 1920, height: 1080 });
    return { browser, page };
}

// Function to fetch movie data using Puppeteer
async function fetchMovieData(movie_name) {
    let browser;
    try {
        logging.info(`🎬 Searching MovieBox for: ${movie_name}`);

        // Create browser instance
        const { browser, page } = await createBrowser();

        // Construct the search URL
        const searchUrl = `https://moviebox.ng/web/searchResult?keyword=${encodeURIComponent(movie_name)}`;
        await page.goto(searchUrl);

        // Wait for the search results to load
        await page.waitForSelector('div.pc-card-btn', { timeout: 60000 });
        logging.info("🔎 Search results loaded.");

        // Click on the first result
        await page.click('div.pc-card-btn');

        // Wait for the navigation to the movie details page
        await page.waitForNavigation({ waitUntil: 'domcontentloaded' });
        logging.info("📄 Movie detail page loaded.");

        // Extract the movie URL
        const movieUrl = page.url();
        logging.info(`📺 Movie URL: ${movieUrl}`);

        // Extract the subjectId from the URL
        const subjectIdMatch = movieUrl.match(/id=(\d+)/);
        if (!subjectIdMatch) {
            throw new Error("❌ Could not extract subjectId from URL.");
        }
        const subjectId = subjectIdMatch[1];

        // Fetch download info from the API using Puppeteer
        const downloadUrl = `https://moviebox.ng/wefeed-h5-bff/web/subject/download?subjectId=${subjectId}&se=0&ep=0`;
        logging.info(`🌐 Download URL: ${downloadUrl}`);

        // Use Puppeteer to fetch the download details
        const downloadPage = await browser.newPage();
        await downloadPage.setExtraHTTPHeaders({
            'User-Agent': getRandomUserAgent(),
            'Referer': 'https://moviebox.ng/'
        });

        await downloadPage.goto(downloadUrl, { waitUntil: 'domcontentloaded' });
        const jsonData = await downloadPage.evaluate(() => {
            return JSON.parse(document.body.innerText);  // Assuming the data is inside the body
        });

        // Filter to show only English subtitles
        const englishSubtitles = jsonData.data.captions.filter(caption => caption.lan === 'en');
        jsonData.data.captions = englishSubtitles;

        logging.info("📦 Download JSON:");
        logging.info(jsonData);

        return jsonData;
    } catch (error) {
        logging.error(`💥 Error: ${error.message}`);
        return { error: error.message };
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// Express route to trigger movie scraping
app.get("/download", async (req, res) => {
    const movie_name = req.query.movie;
    if (!movie_name) {
        return res.status(400).json({ error: "Please provide a movie name using the 'movie' query parameter" });
    }

    // Fetch movie data
    const result = await fetchMovieData(movie_name);

    res.json(result);
});

// Start the server
const PORT = process.env.PORT || 5500;  // Use the port provided by the hosting service or 5500 as fallback
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
