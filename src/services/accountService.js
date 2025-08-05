const stripe = require("../config/stripe");
const {
  INDIVIDUAL_PROFILES,
  COMPANY_PROFILES,
} = require("../config/constants");

// Helper function to build base account configuration
function buildBaseAccountConfig() {
  return {
    capabilities: {
      card_payments: {
        requested: true,
      },
      transfers: {
        requested: true,
      },
    },
    country: "GB",
    controller: {
      fees: {
        payer: "application", // account | application
      },
      losses: {
        payments: "stripe", // application | stripe
      },
      requirement_collection: "stripe", // application | stripe
      stripe_dashboard: {
        type: "none", // express | full | none
      },
    },
    additional_verifications: {
      document: {
        apply_to: ["representative"],
        requested: true,
        require_live_capture: true,
        require_matching_selfie: true,
        upfront: [
          {
            disables: "payouts_and_payments",
          },
        ],
      },
    },
    settings: {
      payouts: {
        schedule: {
          interval: "daily",
        },
      },
    },
  };
}

// Helper function to build individual account configuration
function buildIndividualAccountConfig(profileData, businessProfile = {}) {
  const config = buildBaseAccountConfig();

  config.business_type = "individual";

  // Individual details
  config.individual = {
    first_name: profileData.firstName,
    last_name: profileData.lastName,
    email: profileData.email,
    phone: profileData.phone,
    dob: profileData.dob,
    address: profileData.address,
  };

  // Business profile
  config.business_profile = {
    name:
      profileData.businessName ||
      `${profileData.firstName} ${profileData.lastName}`,
    product_description:
      businessProfile.product_description ||
      profileData.product_description ||
      "",
    support_phone: businessProfile.support_phone || profileData.phone || "",
    mcc: businessProfile.mcc || "5999", // Default to misc retail
    url: profileData.website || businessProfile.url,
  };

  // External bank account
  config.external_account = {
    object: "bank_account",
    account_number: "00012345",
    routing_number: "108800",
    country: "GB",
    currency: "gbp",
    account_holder_name: `${profileData.firstName} ${profileData.lastName}`,
    account_holder_type: "individual",
  };

  return config;
}

// Helper function to build company account configuration
function buildCompanyAccountConfig(profileData, businessProfile = {}) {
  const config = buildBaseAccountConfig();

  config.business_type = "company";

  // Company details
  config.company = {
    name: profileData.name,
    address: profileData.address,
    phone: profileData.phone,
  };

  // Business profile
  config.business_profile = {
    name: profileData.name,
    product_description:
      businessProfile.product_description ||
      profileData.product_description ||
      "",
    support_phone: businessProfile.support_phone || profileData.phone || "",
    mcc: profileData.mcc || businessProfile.mcc || "5999", // Default to misc retail
    url: profileData.url || businessProfile.url,
  };

  // External bank account
  config.external_account = {
    object: "bank_account",
    account_number: "00012345",
    routing_number: "108800",
    country: "GB",
    currency: "gbp",
    account_holder_name: profileData.name,
    account_holder_type: "company",
  };

  return config;
}

/**
 * Create a connected account with the provided configuration
 * @param {string} profileType - 'individual' or 'company'
 * @param {object} profileData - Profile data for the account
 * @param {object} businessProfile - Business profile data
 * @returns {Promise<object>} - Created account object
 */
async function createConnectedAccount(
  profileType,
  profileData,
  businessProfile = {}
) {
  let accountConfig;

  if (profileType === "individual") {
    accountConfig = buildIndividualAccountConfig(profileData, businessProfile);
  } else {
    accountConfig = buildCompanyAccountConfig(profileData, businessProfile);
  }

  const account = await stripe.accounts.create(accountConfig);
  return account;
}

/**
 * Get demo profiles for profile selection
 * @returns {object} - Demo profiles for individual and company
 */
function getDemoProfiles() {
  // Return random profiles for demo (instead of always the first ones)
  const { randomSelection } = require("../config/constants");
  const selectedIndividual = randomSelection(INDIVIDUAL_PROFILES);
  const selectedCompany = randomSelection(COMPANY_PROFILES);

  return {
    individual: {
      id: "individual_profile",
      type: "individual",
      name: `${selectedIndividual.firstName} ${selectedIndividual.lastName}`,
      businessName: selectedIndividual.businessName,
      email: selectedIndividual.email,
      phone: selectedIndividual.phone,
      address: selectedIndividual.address,
      profileData: selectedIndividual,
    },
    company: {
      id: "company_profile",
      type: "company",
      name: selectedCompany.name,
      email: selectedCompany.email,
      phone: selectedCompany.phone,
      address: selectedCompany.address,
      representative: selectedCompany.representative,
      profileData: selectedCompany,
    },
  };
}

/**
 * Create account session for embedded components
 * @param {string} accountId - The account ID
 * @returns {Promise<object>} - Account session object
 */
async function createAccountSession(accountId) {
  // First, let's fetch the account to see its current state
  const account = await stripe.accounts.retrieve(accountId);
  console.info(
    `INFO: Account business_type: ${account.business_type}, charges_enabled: ${account.charges_enabled}, payouts_enabled: ${account.payouts_enabled}`
  );
  console.info(
    `INFO: Account requirements currently_due: ${JSON.stringify(
      account.requirements?.currently_due || []
    )}`
  );

  const session = await stripe.accountSessions.create({
    account: accountId,
    components: {
      payments: {
        enabled: true,
        features: {
          refund_management: true,
          dispute_management: true,
          capture_payments: true,
        },
      },
      account_onboarding: {
        enabled: true,
      },
      payouts: {
        enabled: true,
        features: {
          instant_payouts: true,
          edit_payout_schedule: false,
          external_account_collection: true,
        },
      },
      documents: {
        enabled: true,
      },
    },
  });

  return session;
}

module.exports = {
  createConnectedAccount,
  getDemoProfiles,
  createAccountSession,
  buildIndividualAccountConfig,
  buildCompanyAccountConfig,
};
