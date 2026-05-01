# tmw-redemption-worker

TrueMoney Wallet voucher redemption API — Cloudflare Worker powered by ElysiaJS.

## Setup

```bash
bun install
cp .dev.vars.example .dev.vars
```

## Development

```bash
bun run dev
```

## Deploy

```bash
npx wrangler secret put API_KEY

bun run deploy
```

## Security

This worker implements OWASP Top 10 protections:

- **Authentication** — Bearer token via `API_KEY` secret
- **Input validation** — Strict regex for Thai mobile numbers & voucher codes
- **SSRF prevention** — URL-encoded code interpolation + alphanumeric-only validation
- **Rate limiting** — 10 req/min per IP (configurable via `RATE_LIMIT_PER_MINUTE`)
- **Security headers** — HSTS, CSP, X-Frame-Options, nosniff, Permissions-Policy
- **CORS** — Restrictive origin allowlist via `ALLOWED_ORIGINS` env var
- **Response sanitization** — Only safe fields returned, no raw upstream data leaked
- **Structured logging** — JSON logs with masked PII for observability

## API

### `GET /`

Health check (no auth required).

### `POST /redeem`

Redeem a TrueMoney voucher. **Requires** `Authorization: Bearer <API_KEY>` header.

**Body (JSON):**

| Field    | Type   | Validation                                   |
| -------- | ------ | -------------------------------------------- |
| `mobile` | string | Exactly 10 digits, starts with `0`           |
| `code`   | string | 18–50 alphanumeric characters                |

**Example:**

```bash
curl -X POST http://localhost:8789/redeem \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-test-key-change-me" \
  -d '{"mobile":"09xxxxxxxx","code":"019AB..."}'
```

## Environment Variables

| Variable               | Required | Description                          |
| ---------------------- | -------- | ------------------------------------ |
| `API_KEY`              | Yes      | Bearer token for authentication      |
| `ALLOWED_ORIGINS`      | No       | Comma-separated CORS origins         |
| `RATE_LIMIT_PER_MINUTE`| No      | Max requests per IP per minute (default: 10) |
