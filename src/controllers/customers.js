const stripe = require("../config/stripe");

/**
 * Get customers for a connected account
 */
async function getCustomers(req, res) {
  try {
    const { account_id } = req.query;

    if (!account_id) {
      return res.status(400).json({
        success: false,
        message: "account_id is required",
      });
    }

    console.info(`INFO: Fetching customers for account: ${account_id}`);

    const customers = await stripe.customers.list(
      {
        limit: 100,
      },
      {
        stripeAccount: account_id,
      }
    );

    res.json({
      success: true,
      customers: customers.data.map((customer) => ({
        id: customer.id,
        name: customer.name,
        email: customer.email,
        created: customer.created,
      })),
    });
  } catch (error) {
    console.error(`ERROR: Failed to fetch customers:`, error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * Create a new customer for a connected account
 */
async function createCustomer(req, res) {
  try {
    const { account_id, name, email } = req.body;

    if (!account_id || !name || !email) {
      return res.status(400).json({
        success: false,
        message: "account_id, name, and email are required",
      });
    }

    console.info(`INFO: Creating customer for account: ${account_id}`);

    const customer = await stripe.customers.create(
      {
        name: name,
        email: email,
      },
      {
        stripeAccount: account_id,
      }
    );

    res.json({
      success: true,
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        created: customer.created,
      },
    });
  } catch (error) {
    console.error(`ERROR: Failed to create customer:`, error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

module.exports = {
  getCustomers,
  createCustomer,
};
