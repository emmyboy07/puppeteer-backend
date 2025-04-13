const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const puppeteer = require("puppeteer");
const cors = require("cors");
const logging = require("console");
require("dotenv").config(); // Load environment variables from .env file

const app = express();


app.use(cors());

// Function to configure Puppeteer for scraping (non-headless mode)
async function createBrowser() {
    const browser = await puppeteer.launch({
        executablePath:
        process.env.NODE_ENV === "production"
           ? process.env.PUPPETEER_EXECUTABLE_PATH
           : puppeteer.executablePath(),
          
        headless: true,  // Set to false to see the browser
        args: [
            "--no-sandbox", 
            "--disable-dev-shm-usage", 
            "--start-maximized"  // Maximize the window on launch
        ]
    });
    const page = await browser.newPage();

    // Set the viewport size to match a typical full-screen resolution (e.g., 1920x1080)
    await page.setViewport({ width: 1920, height: 1080 });

    return { browser, page };
}

// Function to fetch movie data from MovieBox using Puppeteer
async function fetchMovieData(movie_name) {
    let browser;
    try {
        logging.info(`🎬 Searching MovieBox for: ${movie_name}`);

        // Create browser instance (not headless)
        const { browser, page } = await createBrowser();

        // Construct the search URL
        const searchUrl = `https://moviebox.ng/web/searchResult?keyword=${encodeURIComponent(movie_name)}`;

        // Open the search result page
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

        // Extract the subjectId from the URL (which contains the movie details)
        const subjectIdMatch = movieUrl.match(/id=(\d+)/);
        if (!subjectIdMatch) {
            throw new Error("❌ Could not extract subjectId from URL.");
        }
        const subjectId = subjectIdMatch[1];

        // Fetch download info from the API
        const downloadUrl = `https://moviebox.ng/wefeed-h5-bff/web/subject/download?subjectId=${subjectId}&se=0&ep=0`;
        logging.info(`🌐 Download URL: ${downloadUrl}`);

        // Get download data (JSON response)
        const response = await axios.get(downloadUrl);
        const jsonData = response.data;

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
        return res.status(400).json({ error: "Missing movie name" });
    }

    // Fetch movie data
    const result = await fetchMovieData(movie_name);

    res.json(result);
});

// Start the server
const PORT = process.env.PORT || 5500;  // Use the port provided by the hosting service or 5000 as fallback

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});