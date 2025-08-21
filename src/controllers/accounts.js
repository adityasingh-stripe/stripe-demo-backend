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
    const { useHardcoded } = req.query;
    const options = {
      useHardcoded: useHardcoded === "true",
    };

    const profiles = accountService.getDemoProfiles(options);

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
 * Generate multiple profiles of a specific type
 */
async function generateProfiles(req, res) {
  try {
    const { type = "individual", count = 5 } = req.query;

    if (!["individual", "company"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Type must be either "individual" or "company"',
      });
    }

    const profileCount = parseInt(count);
    if (isNaN(profileCount) || profileCount < 1 || profileCount > 20) {
      return res.status(400).json({
        success: false,
        message: "Count must be a number between 1 and 20",
      });
    }

    const profiles = accountService.generateMultipleProfiles(
      type,
      profileCount
    );

    res.json({
      success: true,
      type,
      count: profileCount,
      profiles,
    });
  } catch (error) {
    console.error("Error generating profiles:", error);
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
    const { profile_type, profile_data = {}, business_profile = {} } = req.body;

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

    const account = await accountService.createConnectedAccount(
      profile_type,
      profile_data,
      business_profile
    );

    let createdPersons = [];
    if (profile_type === "company" && profile_data.representatives) {
      try {
        createdPersons = await accountService.createAccountPersons(
          account.id,
          profile_data.representatives
        );
      } catch (personError) {
        console.error(
          `Failed to create persons for account ${account.id}:`,
          personError.message
        );
      }
    }

    let location = null;
    try {
      location = await terminalService.createDefaultLocation(account.id);
    } catch (locationError) {
      console.warn(
        `Failed to create default location for account ${account.id}: ${locationError.message}`
      );
    }

    res.json({
      success: true,
      account_id: account.id,
      location_id: location?.id,
      persons_created: createdPersons.length,
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

    const session = await accountService.createAccountSession(accountId);

    res.json({
      clientSecret: session.client_secret,
    });
  } catch (error) {
    console.error(
      `Failed to create account session for account ${req.headers.account}:`,
      error.message
    );

    if (error.type === "StripeInvalidRequestError") {
      console.error(
        `Stripe validation error - ${error.param}: ${error.message}`
      );
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
  const statusInfo = deriveAccountStatus(account);

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

  if (
    statusInfo.requirements.currently_due &&
    statusInfo.requirements.currently_due.length > 0
  ) {
    console.warn(
      `Currently due requirements for ${
        account.id
      }: ${statusInfo.requirements.currently_due.join(", ")}`
    );
  }
  if (
    statusInfo.requirements.past_due &&
    statusInfo.requirements.past_due.length > 0
  ) {
    console.warn(
      `Past due requirements for ${
        account.id
      }: ${statusInfo.requirements.past_due.join(", ")}`
    );
  }
}

/**
 * Fetch account from Stripe and update status
 */
async function fetchAndUpdateAccountStatus(accountId) {
  try {
    const account = await stripe.accounts.retrieve(accountId);
    handleAccountUpdated(account);
  } catch (error) {
    console.error(`Error fetching account ${accountId}:`, error.message);
  }
}

/**
 * Get account status endpoint
 */
async function getAccountStatus(req, res) {
  try {
    const { accountId } = req.params;

    let statusInfo = accountStatuses.get(accountId);

    if (!statusInfo) {
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
    console.error("Error getting account status:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

module.exports = {
  getProfiles,
  generateProfiles,
  createAccount,
  createAccountSession,
  createTestData,
  handleAccountUpdated,
  fetchAndUpdateAccountStatus,
  getAccountStatus,
};
