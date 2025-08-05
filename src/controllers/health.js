/**
 * Health check endpoint
 */
function healthCheck(req, res) {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    message: "HSBC Demo Backend API",
    version: "1.0.0",
    endpoints: {
      "GET /api/profiles": "Get demo profiles for selection",
      "POST /api/accounts": "Create connected account",
      "POST /api/account_links": "Create account link for onboarding",
      "POST /api/payment_links": "Create payment link",
      "GET /api/accounts/:id": "Get account details",
      "POST /api/account_sessions":
        "Create account session for embedded components",
      "POST /account_session": "Create account session (iOS app endpoint)",
      "GET /health": "Health check",
    },
  });
}

/**
 * Simple health check endpoint
 */
function simpleHealthCheck(req, res) {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
}

module.exports = {
  healthCheck,
  simpleHealthCheck,
};
