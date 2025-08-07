const app = require("./src/app");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 4242;

// Start server
app.listen(PORT, () => {
  console.log(`Bank demo Backend Server running on port ${PORT}`);
});

module.exports = app;
