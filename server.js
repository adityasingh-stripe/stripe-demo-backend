const app = require("./src/app");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;

// Start server
app.listen(PORT, () => {
  console.log(`HSBC Demo Backend Server running on port ${PORT}`);
});

module.exports = app;
