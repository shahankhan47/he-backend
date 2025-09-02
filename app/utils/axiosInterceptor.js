const axios = require('axios');

const aiService = axios.create({
  baseURL: process.env.PYTHON_URL,
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.AI_SERVICE_API_KEY,
  },
});

// Request interceptor
aiService.interceptors.request.use(
  (config) => {
    // Log request details in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[AI Service] Making request to: ${config.url}`);
    }
    return config;
  },
  (error) => {
    console.error('[AI Service] Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
aiService.interceptors.response.use(
  (response) => {
    // Log response details in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[AI Service] Received response from: ${response.config.url}`);
    }
    return response;
  },
  (error) => {
    console.error('[AI Service] Response error:', {
      url: error.config?.url,
      status: error.response?.status,
      data: error.response?.data,
    });
    return Promise.reject(error);
  }
);

module.exports = aiService;
