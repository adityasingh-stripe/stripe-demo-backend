const stripe = require("../config/stripe");
const { randomSelection, NAMES } = require("../config/constants");

/**
 * Create connection token for Terminal SDK
 */
async function createConnectionToken(req, res) {
  try {
    const { account_id } = req.body;

    if (!account_id) {
      return res.status(400).json({ error: "account_id is required" });
    }

    const connectionToken = await stripe.terminal.connectionTokens.create(
      {},
      { stripeAccount: account_id }
    );

    res.json({ secret: connectionToken.secret });
  } catch (error) {
    console.error("Error creating connection token:", error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Create payment intent
 */
async function createPaymentIntent(req, res) {
  try {
    const {
      amount,
      currency = "gbp",
      account_id,
      payment_method_types = ["card_present"],
    } = req.body;

    if (!account_id) {
      return res.status(400).json({ error: "account_id is required" });
    }

    const customer = await stripe.customers.create(
      {
        name: `${randomSelection(NAMES).firstName} ${
          randomSelection(NAMES).lastName
        }`,
      },
      { stripeAccount: account_id }
    );

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount,
        currency,
        customer: customer.id,
        payment_method_types,
      },
      { stripeAccount: account_id }
    );

    res.json({
      clientSecret: paymentIntent.client_secret,
      customer: customer,
    });
  } catch (error) {
    console.error("Error creating payment intent:", error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get locations for Terminal SDK
 */
async function getLocations(req, res) {
  try {
    const { account_id } = req.query;

    if (!account_id) {
      return res.status(400).json({ error: "account_id is required" });
    }

    const locations = await stripe.terminal.locations.list(
      {},
      { stripeAccount: account_id }
    );

    res.json({ locations: locations.data });
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
