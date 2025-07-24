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

    // Gather the parameters from frontend
    const { plant, material, orderNumber, dateFrom, dateTo } = req.query;

    // Validate mandatory 'material' parameter
    if (!material || typeof material !== 'string' || material.trim() === '') {
        return res.status(400).json({ error: 'Material is mandatory and must be a non-empty string.' });
    }

    // Validate optional fields and build SAP params
    let params = { material: material.trim() };
    if (plant && plant.trim() !== '') params.plant = plant.trim();
    if (orderNumber && orderNumber.trim() !== '') params.order = orderNumber.trim();

    // Date validation
    function isValidDate(d) {
        return /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d));
    }
    if (dateFrom && dateFrom.trim() !== '') {
        if (!isValidDate(dateFrom)) {
            return res.status(400).json({ error: 'dateFrom must be in YYYY-MM-DD format.' });
        }
        params.dateFrom = dateFrom;
    }
    if (dateTo && dateTo.trim() !== '') {
        if (!isValidDate(dateTo)) {
            return res.status(400).json({ error: 'dateTo must be in YYYY-MM-DD format.' });
        }
        params.dateTo = dateTo;
    }
    if (params.dateFrom && params.dateTo && params.dateFrom > params.dateTo) {
        return res.status(400).json({ error: 'dateFrom cannot be after dateTo.' });
    }

    // Optional: Log outgoing params for debug
    // console.log('Outgoing SAP API params:', params);

    try {
        const apiResponse = await axios.get(apiUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
            params,
        });
        res.json(apiResponse.data);
    } catch (error) {
        if (error.response && error.response.status === 401) {
            await fetchOAuthToken();
            return res.redirect(req.originalUrl);
        }
        res.status(500).json({ error: 'API error', details: error.message });
    }
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
