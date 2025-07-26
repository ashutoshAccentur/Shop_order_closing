// Load environment variables from .env file
require('dotenv').config();

// Import necessary modules
const express = require('express');
const cors = require('cors');
const axios = require('axios');

// Initialize Express app and server port
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware: Enable CORS and JSON parsing for requests
app.use(cors());
app.use(express.json());

// Global variable to store OAuth access token in memory (used to authenticate requests to the SAP API)
let accessToken = null;

// Function: Fetch OAuth token from SAP authentication endpoint
async function fetchOAuthToken() {
  const tokenURL = process.env.TOKEN_URL;
  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;

  // Call SAP token endpoint using client credentials grant
  const response = await axios.post(tokenURL, null, {
    params: { grant_type: 'client_credentials' },
    auth: {
      username: clientId,
      password: clientSecret,
    },
  });

  // Save the received access token in memory (global variable) for reuse
  accessToken = response.data.access_token;
}

// Middleware: Ensure valid OAuth token exists before handling API requests
async function ensureToken(req, res, next) {
  if (!accessToken) {
    await fetchOAuthToken();
  }
  next();
}

// API Route: Proxy GET "/api/orders" to SAP DMC order API with filter parameters
app.get('/api/orders', ensureToken, async (req, res) => {
      // SAP Orders API endpoint
    const apiUrl = 'https://api.test.us20.dmc.cloud.sap/order/v1/orders/list';

    // Get query params from frontend (filter/search form)
    const { plant, material, executionStatus, orderNumber, dateFrom, dateTo } = req.query;

    // Validation: 'material' is mandatory (cannot be empty)
    if (!material || typeof material !== 'string' || material.trim() === '') {
        return res.status(400).json({ error: 'Material is mandatory and must be a non-empty string.' });
    }

    // Build SAP API query params from frontend input (ignore empty optionals)
    let params = { material: material.trim() };
    if (plant && plant.trim() !== '') params.plant = plant.trim();
    if (orderNumber && orderNumber.trim() !== '') params.order = orderNumber.trim();
    if (executionStatus && executionStatus.trim() !== '') params.executionStatus = executionStatus.trim();

    // Date validation
    // Helper: Check if a date string is valid and in YYYY-MM-DD format
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
    // Date range validation: dateFrom cannot be after dateTo
    if (params.dateFrom && params.dateTo && params.dateFrom > params.dateTo) {
        return res.status(400).json({ error: 'dateFrom cannot be after dateTo.' });
    }

    // Optional: Log outgoing params for debug
     console.log('Outgoing SAP API params:', params);

    try {
        // Call SAP Orders API with token and filters
        const apiResponse = await axios.get(apiUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
            params,
        });
        // Send SAP API response to frontend
        res.json(apiResponse.data);
        // Log the data (for debugging)
        //console.log(apiResponse.data);
    } catch (error) {
        // If token expired, fetch a new token and retry request
        if (error.response && error.response.status === 401) {
            await fetchOAuthToken();
            return res.redirect(req.originalUrl);
        }
        // For all other errors, return 500 with error details
        res.status(500).json({ error: 'API error', details: error.message });
    }
});

// Start the backend server and listen on the specified port
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});

