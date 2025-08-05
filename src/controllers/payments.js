const stripe = require("../config/stripe");
const terminalService = require("../services/terminalService");

/**
 * Connection token endpoint for Stripe Terminal SDK (Connected Account scoped)
 */
async function createConnectionToken(req, res) {
  try {
    const { account_id } = req.body;

    if (!account_id) {
      return res.status(400).json({ error: "account_id is required" });
    }

    const connectionToken = await terminalService.createConnectionToken(
      account_id
    );

    res.json({ secret: connectionToken.secret });
  } catch (error) {
    console.error("Error creating connection token:", error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Create PaymentIntent for Terminal SDK (Connected Account scoped)
 */
async function createPaymentIntent(req, res) {
  try {
    const {
      amount,
      currency,
      payment_method_types = ["card_present"],
      capture_method = "automatic",
      account_id,
    } = req.body;

    console.info(
      `INFO: Creating PaymentIntent - Amount: ${amount} ${currency} (£${
        amount / 100
      })`
    );

    if (!account_id) {
      return res.status(400).json({ error: "account_id is required" });
    }

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: amount,
        currency: currency,
        payment_method_types: payment_method_types,
        capture_method: capture_method,
      },
      {
        stripeAccount: account_id, // Create PaymentIntent for the connected account
      }
    );

    res.json({
      client_secret: paymentIntent.client_secret,
      id: paymentIntent.id,
    });
  } catch (error) {
    console.error("Error creating payment intent:", error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get locations for a connected account
 */
async function getLocations(req, res) {
  try {
    const { account_id } = req.query;

    if (!account_id) {
      return res.status(400).json({ error: "account_id is required" });
    }

    const locations = await terminalService.getLocations(account_id);

    res.json({ locations });
  } catch (error) {
    console.error("Error fetching locations:", error);
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  createConnectionToken,
  createPaymentIntent,
  getLocations,
};
