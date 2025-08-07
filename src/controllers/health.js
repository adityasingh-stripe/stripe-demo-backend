/**
 * Health check endpoint that also returns publishable key and branding info for app configuration
 */
async function healthCheck(req, res) {
  try {
    const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;

    if (!publishableKey) {
      return res.status(500).json({
        error: "Stripe publishable key not configured",
      });
    }

    // Get branding info from your platform account (or a specific connected account)
    const stripe = require("../config/stripe");
    let logoUrl = null;
    let iconUrl = null;

    try {
      const account = await stripe.accounts.retrieve(
        process.env.STRIPE_ACCOUNT_ID
      );

      // Get file IDs from account settings
      const logoFileId = account.settings?.branding?.logo;
      const iconFileId = account.settings?.branding?.icon;
      const primaryColor = account.settings?.branding?.primary_color;
      const secondaryColor = account.settings?.branding?.secondary_color;

      // Convert file IDs to our backend endpoints that will serve the files
      if (logoFileId) {
        logoUrl = `${req.protocol}://${req.get("host")}/api/file/${logoFileId}`;
        console.info(`INFO: Logo file endpoint: ${logoUrl}`);
      }

      if (iconFileId) {
        iconUrl = `${req.protocol}://${req.get("host")}/api/file/${iconFileId}`;
        console.info(`INFO: Icon file endpoint: ${iconUrl}`);
      }

      const response = {
        publishableKey: publishableKey,
      };

      // Add branding info if available
      if (logoUrl) {
        response.logoUrl = logoUrl;
      }
      if (iconUrl) {
        response.iconUrl = iconUrl;
      }
      if (primaryColor) {
        response.primaryColor = primaryColor;
      }
      if (secondaryColor) {
        response.secondaryColor = secondaryColor;
      }

      res.json(response);
    } catch (brandingError) {
      console.warn("Could not fetch branding info:", brandingError.message);
      // Continue without branding info - return basic response
      res.json({
        publishableKey: publishableKey,
      });
    }
  } catch (error) {
    console.error("ERROR: Failed to get app info:", error.message);
    res.status(500).json({
      error: "Internal server error",
    });
  }
}

module.exports = {
  healthCheck,
};
