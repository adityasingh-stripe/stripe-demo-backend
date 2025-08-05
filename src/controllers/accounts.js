const stripe = require("../config/stripe");
const accountService = require("../services/accountService");
const terminalService = require("../services/terminalService");
const testDataService = require("../services/testDataService");
const {
  validateIndividualProfile,
  validateCompanyProfile,
  validateBusinessProfile,
  isValidProfileType,
} = require("../utils/validation");
const { deriveAccountStatus } = require("../utils/accountStatus");

// In-memory storage for account statuses (consider using a database in production)
const accountStatuses = new Map();

/**
 * Get demo profiles for profile selection
 */
async function getProfiles(req, res) {
  try {
    const profiles = accountService.getDemoProfiles();

    res.json({
      success: true,
      profiles,
    });
  } catch (error) {
    console.error("Error getting profiles:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * Create a connected account
 */
async function createAccount(req, res) {
  try {
    console.info("INFO: Creating connected account...");

    const {
      profile_type, // 'individual' or 'company'
      profile_data = {},
      business_profile = {},
    } = req.body;

    // Validate input
    if (!isValidProfileType(profile_type)) {
      return res.status(400).json({
        success: false,
        message: "profile_type must be 'individual' or 'company'",
      });
    }

    if (!profile_data || Object.keys(profile_data).length === 0) {
      return res.status(400).json({
        success: false,
        message: "profile_data is required",
      });
    }

    console.info(`INFO: Creating ${profile_type} account`);

    // Validate profile data based on type
    let validation;
    if (profile_type === "individual") {
      validation = validateIndividualProfile(profile_data);
    } else {
      validation = validateCompanyProfile(profile_data);
    }

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: "Profile validation failed",
        errors: validation.errors,
      });
    }

    // Validate business profile if provided
    if (business_profile && Object.keys(business_profile).length > 0) {
      const businessValidation = validateBusinessProfile(business_profile);
      if (!businessValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: "Business profile validation failed",
          errors: businessValidation.errors,
        });
      }
    }

    // Create the account
    const account = await accountService.createConnectedAccount(
      profile_type,
      profile_data,
      business_profile
    );

    console.info(`INFO: Account created successfully: ${account.id}`);

    // Create a default location for Terminal SDK
    let location = null;
    try {
      location = await terminalService.createDefaultLocation(account.id);
    } catch (locationError) {
      console.warn(
        `WARN: Failed to create default location for account ${account.id}: ${locationError.message}`
      );
      // Continue without failing the account creation
    }

    res.json({
      success: true,
      account_id: account.id,
      location_id: location?.id,
      message: "Account created successfully",
    });
  } catch (error) {
    console.error("Error creating account:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * Create account session for embedded components
 */
async function createAccountSession(req, res) {
  try {
    const accountId = req.headers.account;

    if (!accountId) {
      return res.status(400).json({
        error: "Account ID is required in headers",
      });
    }

    console.info(`INFO: Creating account session for account: ${accountId}`);

    const session = await accountService.createAccountSession(accountId);

    console.info(
      `INFO: Account session created successfully for account: ${accountId}`
    );

    res.json({
      clientSecret: session.client_secret,
    });
  } catch (error) {
    console.error(
      `ERROR: Failed to create account session for account ${req.headers.account}:`,
      error.message
    );

    // Log additional details for debugging
    if (error.type === "StripeInvalidRequestError") {
      console.error(
        `ERROR: Stripe validation error - ${error.param}: ${error.message}`
      );
      console.error(
        `ERROR: Full error details:`,
        JSON.stringify(error, null, 2)
      );
    } else {
      console.error(`ERROR: Error type: ${error.type}`);
      console.error(`ERROR: Full error:`, error);
    }

    res.status(500).json({
      error: error.message,
    });
  }
}

/**
 * Create test data for an account
 */
async function createTestData(req, res) {
  try {
    const { account_id } = req.body;

    if (!account_id) {
      return res.status(400).json({
        success: false,
        message: "Account ID is required",
      });
    }

    await testDataService.createAllTestData(account_id);

    res.json({
      success: true,
      message: "Test data created successfully",
    });
  } catch (error) {
    console.error("Error creating test data:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * Handle account.updated webhook
 */
function handleAccountUpdated(account) {
  console.info(`Account updated: ${account.id}`);

  // Derive the current status
  const statusInfo = deriveAccountStatus(account);

  // Store the status
  accountStatuses.set(account.id, {
    account_id: account.id,
    ...statusInfo,
    last_updated: new Date().toISOString(),
    raw_account: {
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
      requirements: account.requirements,
    },
  });

  console.info(
    `Account ${account.id} status: ${statusInfo.status}${
      statusInfo.badge ? ` (${statusInfo.badge})` : ""
    }`
  );

  // Log any requirements that need attention
  if (
    statusInfo.requirements.currently_due &&
    statusInfo.requirements.currently_due.length > 0
  ) {
    console.warn(
      `WARNING: Currently due requirements: ${statusInfo.requirements.currently_due.join(
        ", "
      )}`
    );
  }
  if (
    statusInfo.requirements.past_due &&
    statusInfo.requirements.past_due.length > 0
  ) {
    console.warn(
      `WARNING: Past due requirements: ${statusInfo.requirements.past_due.join(
        ", "
      )}`
    );
  }
}

/**
 * Fetch account from Stripe and update status (for capability/person events)
 */
async function fetchAndUpdateAccountStatus(accountId) {
  try {
    const account = await stripe.accounts.retrieve(accountId);
    handleAccountUpdated(account);
  } catch (error) {
    console.error(`ERROR:Error fetching account ${accountId}:`, error.message);
  }
}

/**
 * Get account status endpoint
 */
async function getAccountStatus(req, res) {
  try {
    const { accountId } = req.params;

    // Check if we have cached status
    let statusInfo = accountStatuses.get(accountId);

    // If no cached status, fetch from Stripe and derive status
    if (!statusInfo) {
      console.info(
        `INFO: No cached status for ${accountId}, fetching from Stripe...`
      );
      try {
        const account = await stripe.accounts.retrieve(accountId);
        const derivedStatus = deriveAccountStatus(account);

        statusInfo = {
          account_id: accountId,
          ...derivedStatus,
          last_updated: new Date().toISOString(),
          raw_account: {
            charges_enabled: account.charges_enabled,
            payouts_enabled: account.payouts_enabled,
            details_submitted: account.details_submitted,
            requirements: account.requirements,
          },
        };

        // Cache it
        accountStatuses.set(accountId, statusInfo);
      } catch (stripeError) {
        return res.status(404).json({
          success: false,
          message: `Account ${accountId} not found`,
          error: stripeError.message,
        });
      }
    }

    res.json({
      success: true,
      account_status: statusInfo,
    });
  } catch (error) {
    console.error("ERROR: Error getting account status:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

module.exports = {
  getProfiles,
  createAccount,
  createAccountSession,
  createTestData,
  handleAccountUpdated,
  fetchAndUpdateAccountStatus,
  getAccountStatus,
};
