require("dotenv").config();
const app = require("./src/app");

const PORT = process.env.PORT || 4242;

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
