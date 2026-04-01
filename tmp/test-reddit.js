const axios = require('axios');

async function testReddit() {
  const REDDIT_BASE_URLS = [
    "https://www.reddit.com",
    "https://api.reddit.com",
    "https://old.reddit.com"
  ];

  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.reddit.com/"
  };

  const endpoint = "/r/Animeedits/hot.json?limit=5&raw_json=1";

  console.log("--- Testing Reddit Connectivity ---");

  for (const baseURL of REDDIT_BASE_URLS) {
    console.log(`\nTrying: ${baseURL}${endpoint}`);
    try {
      const response = await axios.get(`${baseURL}${endpoint}`, { headers, timeout: 5000 });
      console.log(`✅ Success! [${baseURL}] - Found ${response.data?.data?.children?.length || 0} posts.`);
      return; 
    } catch (err) {
      console.error(`❌ Failed! [${baseURL}] - Status: ${err.response?.status || 'UNK'} - Message: ${err.message}`);
      if (err.response?.data) {
          console.error(`Response Data Sample: ${JSON.stringify(err.response.data).substring(0, 200)}`);
      }
    }
  }

  console.log("\n--- ALL ENDPOINTS FAILED ---");
}

testReddit();
