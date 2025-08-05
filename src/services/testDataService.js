const stripe = require("../config/stripe");
const {
  NAMES,
  CARD_TOKENS,
  DISPUTE_TOKEN,
  BYPASS_BALANCE_TOKEN,
  TOP_UP_AMOUNT,
  PAYOUT_AMOUNTS,
  randomPrice,
  randomSelection,
} = require("../config/constants");

/**
 * Create test customers for an account
 * @param {string} accountId - The account ID
 * @returns {Promise<string[]>} - Array of customer IDs
 */
async function createTestCustomers(accountId) {
  console.log(`Creating test customers for account: ${accountId}`);

  const customerPromises = NAMES.map((name) =>
    stripe.customers.create(
      {
        name: `${name.firstName} ${name.lastName}`,
        email: `${name.firstName.toLowerCase()}@${name.lastName.toLowerCase()}.co.uk`,
      },
      { stripeAccount: accountId }
    )
  );

  const customers = await Promise.all(customerPromises);
  const customerIds = customers.map((c) => c.id);
  console.log(`Created ${customerIds.length} customers`);

  return customerIds;
}

/**
 * Create test payments for an account
 * @param {string} accountId - The account ID
 * @param {string[]} customerIds - Array of customer IDs
 * @returns {Promise<void>}
 */
async function createTestPayments(accountId, customerIds) {
  console.log(`Creating test payments for account: ${accountId}`);

  // Create the "top up" payment
  await stripe.paymentIntents.create(
    {
      amount: TOP_UP_AMOUNT,
      payment_method: BYPASS_BALANCE_TOKEN,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: "never",
      },
      currency: "gbp",
      customer: randomSelection(customerIds),
      confirm: true,
    },
    { stripeAccount: accountId }
  );

  // Create regular payments
  const paymentPromises = Array.from({ length: 20 }, () =>
    stripe.paymentIntents.create(
      {
        amount: randomPrice(),
        payment_method: randomSelection(CARD_TOKENS),
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: "never",
        },
        currency: "gbp",
        customer: randomSelection(customerIds),
        confirm: true,
      },
      { stripeAccount: accountId }
    )
  );

  // Create disputed payments
  const disputePromises = Array.from({ length: 5 }, () =>
    stripe.paymentIntents.create(
      {
        amount: randomPrice(),
        payment_method: DISPUTE_TOKEN,
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: "never",
        },
        currency: "gbp",
        customer: randomSelection(customerIds),
        confirm: true,
      },
      { stripeAccount: accountId }
    )
  );

  await Promise.all([...paymentPromises, ...disputePromises]);
  console.log("Created test payments");
}

/**
 * Create test payouts for an account
 * @param {string} accountId - The account ID
 * @returns {Promise<void>}
 */
async function createTestPayouts(accountId) {
  console.log(`Creating test payouts for account: ${accountId}`);

  let balanceAvailable = false;
  let noLoops = 0;
  const maxLoops = 10;
  const sleepTime = 1000;
  const payoutTotal = PAYOUT_AMOUNTS.reduce((sum, amount) => sum + amount, 0);

  while (!balanceAvailable && noLoops <= maxLoops) {
    const balance = await stripe.balance.retrieve({ stripeAccount: accountId });
    const availableBalance =
      balance.available.find((b) => b.currency === "gbp")?.amount || 0;

    balanceAvailable = availableBalance >= payoutTotal;
    console.info(
      `Balance check ${noLoops + 1}: ${availableBalance} (need ${payoutTotal})`
    );

    if (!balanceAvailable) {
      await new Promise((resolve) => setTimeout(resolve, sleepTime));
    }
    noLoops += 1;
  }

  if (balanceAvailable) {
    await Promise.all(
      PAYOUT_AMOUNTS.map((amount) =>
        stripe.payouts.create(
          {
            amount: amount,
            currency: "gbp",
          },
          { stripeAccount: accountId }
        )
      )
    );
    console.log("Created test payouts");
  } else {
    console.info("Balance not available for payouts after max retries");
  }
}

/**
 * Create all test data for an account
 * @param {string} accountId - The account ID
 * @returns {Promise<void>}
 */
async function createAllTestData(accountId) {
  console.log(`Creating all test data for account: ${accountId}`);

  // Create customers first
  const customerIds = await createTestCustomers(accountId);

  // Create payments
  await createTestPayments(accountId, customerIds);

  // Wait for balance to be available and create payouts
  await createTestPayouts(accountId);

  console.log("All test data created successfully");
}

module.exports = {
  createTestCustomers,
  createTestPayments,
  createTestPayouts,
  createAllTestData,
};
