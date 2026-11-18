# Campus Stay Backend

A separate Node.js, Express, MongoDB (Mongoose) backend foundation for the existing Campus Stay application.

## Prerequisites

- Node.js 18.x or newer (LTS)
- MongoDB Atlas account (for production migrations in later phases)

## Installation

```bash
cd backend
npm install
```

## Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Required fields: `PORT`, `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`.
All optional fields use placeholder defaults that are validated at startup.

## Local Development

Start the API server:

```bash
npm start
```

Health check endpoint:

```bash
curl http://localhost:5000/api/v1/health
```

## Tests

Run the API health tests:

```bash
npm test
```

Note: live MongoDB connectivity tests require valid `MONGODB_URI` configuration.
Without it, the API starts and correctly reports `database: disconnected`.

## Security Notes

- Helmet provides security headers
- CORS is restricted to the configured client URL
- Rate limiting defaults to 100 requests per 15 minutes
- Centralized error handling hides internal details in production
- JWT secrets are required in production; development allows placeholders
- No frontend credentials exposed
- Admin role provisioning is not exposed via self-service endpoints in this phase

## Future Phases

Phase 2 will implement authentication, role-based authorization, and data migration from Supabase to MongoDB.
