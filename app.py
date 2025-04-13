import time
from flask import Flask, request, jsonify
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
import logging

# Flask app setup
app = Flask(__name__)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Configure the Chrome WebDriver
def create_driver():
    chrome_options = Options()
    chrome_options.add_argument("--headless")  # Run headlessly
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    driver_service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=driver_service, options=chrome_options)
    return driver

# Function to fetch movie data from MovieBox using Selenium
def fetch_movie_data(movie_name):
    driver = create_driver()
    try:
        logging.info(f"🎬 Searching MovieBox for: {movie_name}")

        # Open MovieBox website
        driver.get("https://moviebox.ng")

        # Wait for the search input to load and type the movie name
        search_input = driver.find_element(By.CSS_SELECTOR, 'input.pc-search-input')
        search_input.send_keys(movie_name)
        search_input.send_keys(Keys.RETURN)

        # Wait for search results to load
        time.sleep(3)  # This can be replaced with WebDriverWait for better stability
        first_result = driver.find_element(By.CSS_SELECTOR, 'div.pc-card-btn')
        first_result.click()

        # Wait for the movie detail page to load
        time.sleep(3)
        movie_url = driver.current_url
        logging.info(f"📺 Movie URL: {movie_url}")

        # Extract the subjectId from the URL (which contains the movie details)
        subject_id = movie_url.split("id=")[-1]
        if not subject_id:
            raise Exception("❌ Could not extract subjectId from URL.")
        
        # Fetch download info from the API
        download_url = f"https://moviebox.ng/wefeed-h5-bff/web/subject/download?subjectId={subject_id}&se=0&ep=0"
        logging.info(f"🌐 Download URL: {download_url}")

        # Get download data (JSON response)
        response = requests.get(download_url)
        json_data = response.json()

        # Filter to show only English subtitles
        english_subtitles = [caption for caption in json_data['data']['captions'] if caption['lan'] == 'en']
        json_data['data']['captions'] = english_subtitles

        logging.info("📦 Download JSON:")
        logging.info(json_data)

        return json_data

    except Exception as e:
        logging.error(f"💥 Error: {e}")
        return {"error": str(e)}

    finally:
        driver.quit()  # Close the browser

# Flask route to trigger movie scraping
@app.route("/download", methods=["GET"])
def fetch_movie_json():
    movie_name = request.args.get("movie")
    if not movie_name:
        return jsonify({"error": "Missing movie name"}), 400

    # Fetch movie data
    result = fetch_movie_data(movie_name)

    return jsonify(result)

if __name__ == "__main__":
    app.run(debug=True)
