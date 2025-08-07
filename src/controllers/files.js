const stripe = require("../config/stripe");
const https = require("https");

/**
 * Serve Stripe uploaded files (logos, icons, etc.)
 * Downloads files from Stripe using the Files API and streams them to the client
 */
async function serveStripeFile(req, res) {
  try {
    const { fileId } = req.params;

    if (!fileId) {
      return res.status(400).json({ error: "File ID is required" });
    }

    console.info(`INFO: Serving Stripe file: ${fileId}`);

    // Retrieve file metadata from Stripe
    const file = await stripe.files.retrieve(fileId);

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    // Download the file content from Stripe using authenticated request
    const fileUrl = `https://files.stripe.com/v1/files/${fileId}/contents`;

    // Create authenticated request to Stripe
    const requestOptions = {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        "User-Agent": "stripe-backend-proxy/1.0",
      },
    };

    https
      .get(fileUrl, requestOptions, (fileResponse) => {
        if (fileResponse.statusCode !== 200) {
          console.error(`Failed to download file: ${fileResponse.statusCode}`);
          return res
            .status(500)
            .json({ error: "Failed to download file from Stripe" });
        }

        // Set appropriate headers for file serving
        res.set({
          "Content-Type": file.type || "application/octet-stream",
          "Content-Length": fileResponse.headers["content-length"],
          "Cache-Control": "public, max-age=3600", // Cache for 1 hour
          ETag: `"${fileId}"`, // Use file ID as ETag for caching
        });

        console.info(
          `INFO: Successfully serving file ${fileId} (${file.type})`
        );

        // Stream the file content to the client
        fileResponse.pipe(res);
      })
      .on("error", (error) => {
        console.error("Error downloading file from Stripe:", error);
        res.status(500).json({ error: "Failed to download file" });
      });
  } catch (error) {
    console.error("ERROR: Failed to serve Stripe file:", error.message);

    if (error.type === "StripeInvalidRequestError") {
      return res.status(404).json({ error: "File not found" });
    }

    res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = {
  serveStripeFile,
};
