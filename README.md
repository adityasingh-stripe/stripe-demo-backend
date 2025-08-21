# BankDemo Backend

Node.js backend server for the BankDemo iOS application, providing Stripe Terminal and Connect integration with multi-bank support.

## Features

- **Stripe Terminal Integration**: Connection tokens, payment intents, locations
- **Stripe Connect Integration**: Account sessions, customer management
- **Payment Links & Checkout**: Alternative payment methods for failed in-person payments
- **Multi-Bank Support**: Dynamic configuration based on account context
- **Comprehensive Logging**: Detailed API operation logging for debugging

## Quick Start

### Prerequisites

- Node.js 18.0+
- Stripe Account with Terminal and Connect enabled

### Installation

1. **Install dependencies**

   ```bash
   cd DemoBackend
   npm install
   ```

2. **Configure environment**

   ```bash
   cp .env.example .env
   # Edit .env with your Stripe keys
   ```

3. **Start the server**

   ```bash
   npm start
   ```

4. **Test the setup**
   ```bash
   curl http://localhost:4242/api/app_info
   ```

## Configuration

### Environment Variables

Create `.env` file in the `DemoBackend` directory:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...      # Optional - for webhook signature verification
STRIPE_ACCOUNT_ID=acct_...           # Optional - your platform account ID

# Server Configuration
PORT=4242                            # Server port (defaults to 4242)
BASE_URL=http://localhost:4242       # Server's URL - used for serving files
```

### Stripe Setup

1. **Create Stripe Account**

   - Enable Terminal in your Stripe Dashboard
   - Enable Connect in your Stripe Dashboard

2. **Create Connect Application**

   - Go to Connect → Settings
   - Create a new application
   - Configure webhook endpoints

3. **Configure Terminal**
   - Create locations for your merchants
   - Set up reader configurations

## API Endpoints

### Health & Configuration

#### `GET /api/app_info`

Returns application configuration and health status.

**Response:**

```json
{
  "publishableKey": "pk_test_...",
  "status": "healthy",
  "version": "1.0.0"
}
```

### Terminal Integration

#### `POST /api/connection_token`

Creates connection tokens for Terminal SDK.

**Request:**

```json
{
  "account_id": "acct_...",
  "location": "tml_..."
}
```

**Response:**

```json
{
  "secret": "pst_test_...",
  "account_id": "acct_..."
}
```

#### `POST /api/create_payment_intent`

Creates payment intents for Terminal payments.

**Request:**

```json
{
  "amount": 2000,
  "currency": "gbp",
  "account_id": "acct_...",
  "customer": {
    "id": "cus_...",
    "name": "John Doe"
  },
  "description": "Payment for services"
}
```

**Response:**

```json
{
  "client_secret": "pi_..._secret_...",
  "id": "pi_...",
  "amount": 2000,
  "currency": "gbp"
}
```

#### `GET /api/locations`

Retrieves available Terminal locations.

**Query Parameters:**

- `account_id` (required): Stripe Connect account ID

**Response:**

```json
{
  "locations": [
    {
      "id": "tml_...",
      "display_name": "Main Location",
      "address": {...}
    }
  ]
}
```

### Customer Management

#### `POST /api/customers`

Creates a new customer.

**Request:**

```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "account_id": "acct_..."
}
```

**Response:**

```json
{
  "id": "cus_...",
  "name": "Jane Smith",
  "email": "jane@example.com"
}
```

#### `GET /api/customers`

Lists customers for an account.

**Query Parameters:**

- `account_id` (required): Stripe Connect account ID
- `limit` (optional): Number of customers to return (default: 20)

### Payment Recovery

#### `POST /api/create_payment_link`

Creates Stripe Payment Links for failed in-person payments.

**Request:**

```json
{
  "amount": 2000,
  "currency": "gbp",
  "account_id": "acct_...",
  "customer": {
    "id": "cus_...",
    "name": "John Doe"
  },
  "description": "Payment recovery"
}
```

**Response:**

```json
{
  "url": "https://buy.stripe.com/test_...",
  "id": "plink_...",
  "amount": 2000,
  "currency": "gbp"
}
```

#### `POST /api/create_checkout_session`

Creates Stripe Checkout sessions for online payments.

**Request:**

```json
{
  "amount": 2000,
  "currency": "gbp",
  "account_id": "acct_...",
  "customer": {
    "id": "cus_...",
    "name": "John Doe"
  },
  "business_name": "HSBC Business"
}
```

**Response:**

```json
{
  "url": "https://checkout.stripe.com/c/pay/cs_...",
  "id": "cs_...",
  "amount": 2000,
  "currency": "gbp"
}
```

#### `GET /api/checkout_session/:sessionId`

Retrieves checkout session details for success page.

**Query Parameters:**

- `account_id` (required): Stripe Connect account ID

**Response:**

```json
{
  "customer_details": {...},
  "amount_total": 2000,
  "currency": "gbp",
  "payment_status": "paid",
  "business_name": "HSBC Business"
}
```

### Static Pages

#### `GET /success`

Serves payment success page with session details.

#### `GET /cancel`

Serves payment cancellation page.

## File Structure

```
DemoBackend/
├── src/
│   ├── app.js              # Express app configuration
│   ├── controllers/        # Route handlers
│   │   ├── accounts.js     # Connect account management
│   │   ├── customers.js    # Customer operations
│   │   ├── health.js       # Health checks
│   │   ├── payments.js     # Payment operations
│   │   └── webhooks.js     # Webhook handling
│   ├── routes/             # Route definitions
│   │   ├── accounts.js
│   │   ├── customers.js
│   │   ├── payments.js
│   │   └── webhooks.js
│   ├── services/           # Business logic
│   │   ├── accountService.js
│   │   ├── profileGenerator.js
│   │   └── testDataService.js
│   ├── config/             # Configuration
│   │   ├── constants.js    # App constants
│   │   └── stripe.js       # Stripe initialization
│   └── utils/              # Utilities
│       └── validation.js   # Input validation
├── public/                 # Static files
│   ├── checkout-success.html
├── server.js              # Server entry point
├── package.json
└── README.md
```

## Deployment

### Development

1. **Local Development**

   ```bash
   npm run dev  # Uses nodemon for auto-reload
   ```

2. **Environment Setup**

   - Copy `.env.example` to `.env`
   - Configure Stripe test keys
   - Set up ngrok for webhook testing

3. **Webhook Testing**

   ```bash
   # Terminal 1: Start server
   npm start

   # Terminal 2: Use Stripe CLI to forward events to the server

   stripe login
   stripe listen --forward-to http://localhost:4242/webhook
   ```

## Testing

### API Testing

```bash
# Test health endpoint
curl http://localhost:3001/api/app_info

# Test payment intent creation
curl -X POST http://localhost:3001/api/create_payment_intent \
  -H "Content-Type: application/json" \
  -d '{"amount": 2000, "currency": "gbp", "account_id": "acct_test"}'

# Test checkout session creation
curl -X POST http://localhost:3001/api/create_checkout_session \
  -H "Content-Type: application/json" \
  -d '{"amount": 2000, "currency": "gbp", "account_id": "acct_test"}'
```

### Integration Testing

1. **Terminal Integration**

   - Test connection token generation
   - Verify payment intent creation
   - Test location retrieval

2. **Connect Integration**

   - Test account session creation
   - Verify customer management
   - Test webhook processing

3. **Payment Recovery**
   - Test payment link creation
   - Verify checkout session flow
   - Test success/cancel pages

## Monitoring & Logging

### Health Monitoring

- `/api/app_info` endpoint for health checks
- Stripe API connectivity verification
- Environment configuration validation

## Troubleshooting

### Common Issues

1. **Stripe Key Configuration**

   ```
   Error: No API key provided
   ```

   **Solution**: Verify `.env` file has correct Stripe keys

2. **Connect Account Issues**

   ```
   Error: No such account: acct_...
   ```

   **Solution**: Ensure account ID exists and is accessible

3. **Webhook Verification Failed**

   ```
   Error: Invalid signature
   ```

   **Solution**: Check webhook secret configuration

4. **CORS Issues**

   ```
   Error: Access blocked by CORS policy
   ```

   **Solution**: Configure `ALLOWED_ORIGINS` environment variable

5. **Checkout Session Redirects to Localhost**

   ```
   Error: After payment, redirects to localhost:3001 instead of deployed URL
   ```

   **Solution**: Set `BASE_URL` environment variable to your deployed domain:

   ```bash
   BASE_URL=https://your-deployed-domain.com
   ```

6. **Environment Variable Missing**
   ```
   Error: Cannot read property of undefined
   ```
   **Solution**: Ensure all required environment variables are set:
   - `STRIPE_SECRET_KEY` (required)
   - `STRIPE_PUBLISHABLE_KEY` (required)
   - `BASE_URL` (required for redirects)

## Support

- reach out to @adityasingh

---

**Note**: This backend is for demonstration purposes. Implement proper authentication, rate limiting, and monitoring for production use.
