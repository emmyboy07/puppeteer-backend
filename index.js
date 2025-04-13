const puppeteer = require('puppeteer');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());

// TMDB API Key
const TMDB_API_KEY = '1e2d76e7c45818ed61645cb647981e5c';

async function getMovieFromTMDB(tmdb_id) {
    const url = `https://api.themoviedb.org/3/movie/${tmdb_id}?api_key=${TMDB_API_KEY}`;
    try {
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        console.error(`Error fetching data from TMDB: ${error.message}`);
        return null;
    }
}

async function createBrowser() {
    const browser = await puppeteer.launch({
        headless: true,  // Run the browser in headless mode for production
        args: [
            "--disable-setuid-sandbox",
            "--no-sandbox",
            "--single-process",
            "--no-zygote",
        ],
        executablePath:
            process.env.NODE_ENV === "production"
                ? process.env.PUPPETEER_EXECUTABLE_PATH
                : puppeteer.executablePath(),
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    return { browser, page };
}

async function fetchDownloadLink(movie_name, expectedYear) {
    let browser;
    try {
        console.log(`🎬 Searching MovieBox for: ${movie_name} ${expectedYear}`);
        const { browser: b, page } = await createBrowser();
        browser = b;

        const searchQuery = `${movie_name} ${expectedYear}`;
        const searchUrl = `https://moviebox.ng/web/searchResult?keyword=${encodeURIComponent(searchQuery)}`;
        await page.goto(searchUrl);
        await page.waitForSelector('div.pc-card-btn', { timeout: 60000 });
        console.log("✅ Search results loaded.");

        let found = false;
        let movieUrl;
        let downloadUrl;

        for (let i = 1; i <= 4; i++) {  
            console.log(`➡️ Trying to open result #${i}`);

            await page.evaluate((index) => {
                const result = document.querySelectorAll('div.pc-card-btn')[index - 1];
                if (result) result.click();
            }, i);

            await page.waitForNavigation({ waitUntil: 'domcontentloaded' });

            movieUrl = page.url();
            console.log(`🔗 Opened: ${movieUrl}`);

            let title;
            try {
                title = await page.$eval('h2.pc-title', (el) => el.innerText.trim());
                console.log(`Title found from h2.pc-title: ${title}`);
            } catch (error) {
                console.log('Failed to get title from h2 tag');
            }

            const releaseDateText = await page.$eval('div.pc-time', (el) => el.innerText);
            const releaseYear = releaseDateText.split('-')[0];

            console.log(`Year found: ${releaseYear}`);

            const normalizedTitle = title ? title.toLowerCase().trim() : '';
            const normalizedMovieName = movie_name.toLowerCase().trim();
            const titleMatch = normalizedTitle === normalizedMovieName;
            const yearMatch = releaseYear === expectedYear;

            if (titleMatch && yearMatch) {
                console.log(`✅ Title and Year match: expected ${movie_name} (${expectedYear}), got ${title} (${releaseYear})`);
                found = true;
                break;
            } else {
                console.log(`❌ Mismatch: Title match - ${titleMatch}, Year match - ${yearMatch}`);
            }

            await page.goBack();
            await page.waitForSelector('div.pc-card-btn');
        }

        if (!found) {
            console.log("❌ No matching results found.");
            return { error: "Download unavailable" };
        }

        const subjectIdMatch = movieUrl.match(/id=(\d+)/);
        if (!subjectIdMatch) {
            throw new Error("❌ Could not extract subjectId from URL.");
        }

        const subjectId = subjectIdMatch[1];
        downloadUrl = `https://moviebox.ng/wefeed-h5-bff/web/subject/download?subjectId=${subjectId}&se=0&ep=0`;
        console.log(`🔗 Download URL: ${downloadUrl}`);

        return {
            title: movie_name,
            releaseYear: expectedYear,
            downloadUrl: downloadUrl,
        };

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
    const tmdb_id = req.query.tmdb_id;
    if (!tmdb_id) {
        return res.status(400).json({ error: "Please provide a TMDB movie ID using the 'tmdb_id' query parameter" });
    }

    const movieData = await getMovieFromTMDB(tmdb_id);
    if (!movieData) {
        return res.status(500).json({ error: "Could not fetch movie details from TMDB" });
    }

    const movie_name = movieData.title;
    const expectedYear = movieData.release_date.split('-')[0];

    const result = await fetchDownloadLink(movie_name, expectedYear);

    if (result.error) {
        return res.status(404).json(result);
    }

    res.json(result);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});
