const stripe = require("../config/stripe");
const {
  handleAccountUpdated,
  fetchAndUpdateAccountStatus,
} = require("./accounts");

/**
 * Webhook endpoint for Stripe events
 */
function handleWebhook(req, res) {
  const sig = req.headers["stripe-signature"];
  let event;

  // Check if this is actually a webhook from Stripe (has signature header)
  if (!sig) {
    console.info("Received request without Stripe signature - ignoring");
    return res.status(400).send("Missing Stripe signature");
  }

  try {
    // Note: Set STRIPE_WEBHOOK_SECRET in your .env file when you configure webhooks
    if (process.env.STRIPE_WEBHOOK_SECRET) {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } else {
      console.warn("WARNING: Webhook signature verification disabled.");
      try {
        const bodyString = req.body.toString("utf8");
        event = JSON.parse(bodyString);
      } catch (parseError) {
        console.error(
          `ERROR: Failed to parse webhook body as JSON:`,
          parseError.message
        );
        return res.status(400).send(`Invalid JSON: ${parseError.message}`);
      }
    }
  } catch (err) {
    console.error(`ERROR: Webhook signature verification failed.`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.info(
    `INFO: Received webhook event: ${event.type} for account: ${
      event.account || "platform"
    }`
  );

  // Handle the event
  switch (event.type) {
    case "account.updated":
      handleAccountUpdated(event.data.object);
      break;
    case "capability.updated":
      console.info(`INFO: Capability updated for account: ${event.account}`);
      // Fetch the full account to get updated status
      if (event.account) {
        fetchAndUpdateAccountStatus(event.account);
      }
      break;
    case "account.application.authorized":
      console.info(
        `INFO: Account application authorized for account: ${event.account}`
      );
      // This means the user has completed phone verification and authorized the app
      // Fetch the full account to get updated status and continue onboarding
      if (event.account) {
        fetchAndUpdateAccountStatus(event.account);
      }
      break;
    case "person.created":
    case "person.updated":
    case "person.deleted":
      console.info(`INFO: Person ${event.type} for account: ${event.account}`);
      // Fetch the full account to get updated status
      if (event.account) {
        fetchAndUpdateAccountStatus(event.account);
      }
      break;
    default:
      console.info(`INFO: Unhandled event type: ${event.type}`);
  }

  res.json({ received: true });
}

module.exports = {
  handleWebhook,
};
