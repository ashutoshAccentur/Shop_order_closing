require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let accessToken = null;

// Function to fetch OAuth token
async function fetchOAuthToken() {
  const tokenURL = process.env.TOKEN_URL;
  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;

  const response = await axios.post(tokenURL, null, {
    params: { grant_type: 'client_credentials' },
    auth: {
      username: clientId,
      password: clientSecret,
    },
  });

  accessToken = response.data.access_token;
}

// Middleware to check/fetch token
async function ensureToken(req, res, next) {
  if (!accessToken) {
    await fetchOAuthToken();
  }
  next();
}

// Proxy API call route
app.get('/api/orders', ensureToken, async (req, res) => {
  const apiUrl = 'https://api.test.us20.dmc.cloud.sap/order/v1/orders/list';
  
  try {
    const apiResponse = await axios.get(apiUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: req.query,
    });
    res.json(apiResponse.data);
  } catch (error) {
    if (error.response && error.response.status === 401) {
      // If token expired, refresh token once
      await fetchOAuthToken();
      return res.redirect(req.originalUrl);
    }
    res.status(500).json({ error: 'API error', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
