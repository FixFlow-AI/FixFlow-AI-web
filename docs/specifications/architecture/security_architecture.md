# FixFlow AI - Enterprise Security & Authentication Architecture

This document outlines the Zero-Trust, Defense-in-Depth security architecture for **FixFlow AI**. It serves as the master specification for authentication, authorization, token lifecycle, session tracking, and API hardening.

---

## 🔐 1. Authentication Architecture

FixFlow AI employs a multi-tenant authentication engine designed to support Web2, Web3, and enterprise identity standards.

```
                           +------------------------+
                           |   Auth Entry Points    |
                           +-----------+------------+
                                       |
        +------------------+-----------+-----------+-------------------+
        |                  |                       |                   |
+-------v-------+  +-------v-------+       +-------v-------+   +-------v-------+
| Email/Pass    |  | OAuth 2.0/OIDC|       | Passwordless  |   | Enterprise    |
| (Argon2id)    |  | (Google, GH)  |       | Magic Links   |   | SAML/OIDC SSO |
+-------+-------+  +-------+-------+       +-------+-------+   +-------+-------+
        |                  |                       |                   |
        +------------------+-----------+-----------+-------------------+
                                       |
                                       v
                           +-----------+------------+
                           |  Verification Pipeline |
                           |  - Disposable Email Check
                           |  - Brute Force Guard   |
                           |  - MFA Evaluation      |
                           +-----------+------------+
                                       |
                                       v
                           +-----------+------------+
                           |  Session Provisioning  |
                           |  (Redis + JWT Issuer)  |
                           +------------------------+
```

### A. Authentication Providers
1. **Traditional Email + Password**:
   - **Password Hashing**: Mandatory use of **Argon2id** (configured parameters: `m=65536` (64MB memory), `t=3` iterations, `p=4` parallelism).
   - **Password Complexity Policy**: Minimum 12 characters, at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character. Enforced on the backend via Zod schema checks.
   - **Validation Checks**:
     - *Disposable Email Detection*: API checks domain MX records and cross-references against a dynamic blocklist (e.g., mailinator.com, tempmail.com) to prevent bot accounts.
     - *Brute-Force Guard*: Sliding-window rate limiter tracking login attempts (detailed in API Security).
2. **Social OAuth 2.0 / OpenID Connect**:
   - **Providers**: Google (OIDC `openid email profile`) and GitHub OAuth (`read:user user:email`).
   - **Security Controls**:
     - State parameters signed using HMAC-SHA256 to prevent Cross-Site Request Forgery (CSRF).
     - Authorization codes exchanged server-side only; access tokens are never exposed to the client browser.
3. **Passwordless Magic Links**:
   - Short-lived token (15-minute expiry) signed with `JWT_SECRET` containing an audit-trackable `nonce` and `jti` (JWT ID).
   - Link is single-use only. Verified by recording the used `jti` in a Redis key with a 15-minute TTL to prevent replay attacks.
4. **Enterprise SSO**:
   - SAML 2.0 and OpenID Connect (OIDC) federation bindings designed for corporate tenants (e.g., Okta, Azure AD).

---

## 🎟️ 2. JWT & Token Lifecycle Architecture

FixFlow AI relies on a **Dual-Cookie Token Rotation Pattern** to implement stateless request authentication combined with stateful session control.

### A. Token Specifications
All tokens are issued as HttpOnly, Secure, and SameSite=Strict cookies.

| Token Type | Lifespan | Cookie Configuration | Payload Claims |
| :--- | :--- | :--- | :--- |
| **Access Token** | 15 Minutes | `httpOnly: true`, `secure: true`, `sameSite: 'Strict'`, `path: '/'` | `userId`, `role`, `permissions[]`, `tokenVersion`, `sessionId`, `iat`, `exp` |
| **Refresh Token**| 7 - 30 Days | `httpOnly: true`, `secure: true`, `sameSite: 'Strict'`, `path: '/api/auth/refresh'` | `userId`, `sessionId`, `tokenVersion`, `iat`, `exp` |

### B. JWT Payload Schema (Example JSON)
```json
{
  "userId": "usr_9f83a4b2-c0e8-4682-8419-3f7c001859ae",
  "role": "manager",
  "permissions": [
    "can_create_project",
    "can_view_billing",
    "can_manage_leads"
  ],
  "tokenVersion": 2,
  "sessionId": "ses_4a8b2c9d-1e0f-3a2b-4c5d-6e7f8a9b0c1d",
  "iat": 1776870000,
  "exp": 1776870900
}
```

### C. Token Rotation & Replay Protection (RTR)
To prevent unauthorized session hijacking:
1. **Rotation**: When a client requests a new Access Token using their Refresh Token, the API rotates **both** the Access Token and the Refresh Token.
2. **Replay Detection**:
   - Every active Refresh Token ID is stored in Redis.
   - If a client attempts to refresh using a **previously used/rotated Refresh Token**, the backend flags it as a replay attack.
   - **Action on Replay**: The backend immediately invalidates the entire session chain (`sessionId` is revoked in Redis and DB), logs out all active devices associated with that session, and writes a High-Risk audit log entry.

---

## 🗃️ 3. Redis-Based Session Management

All active user sessions are tracked in a stateful, globally distributed **Redis cluster** to enable instant revocation and concurrent session limits.

```
       +--------------------------------------------+
       |             Redis Cache Layer              |
       |  Key: "session:ses_4a8b2c9d..."            |
       +---------------------+----------------------+
                             |
       +---------------------+----------------------+
       |                JSON Value                  |
       |  - userId: "usr_9f83a4b2..."               |
       |  - device: "MacBook Pro / Chrome"          |
       |  - ip: "198.51.100.42"                     |
       |  - country: "US"                           |
       |  - lastActivity: "2026-06-18T21:21:53Z"    |
       |  - fingerprint: "a8f3b20e..."             |
       +--------------------------------------------+
```

### A. Session Tracking Metrics
Each session record contains:
* `userId`: ID of the logged-in user.
* `device`: Combination of Client OS and device hardware type parsed from user agent.
* `browser`: Name and version of browser.
* `ipAddress`: Client IP.
* `country`: Country resolved via GeoIP lookup.
* `lastActivity`: ISO timestamp updated on every API request.
* `fingerprint`: A hash of browser user-agent, language headers, and IP address to detect hijacked cookies.

### B. Session Control Policies
1. **Concurrent Session Limits**: Maximum 5 concurrent sessions per user. If a 6th session is initiated, the oldest active session is automatically revoked in Redis and the user is logged out on that device.
2. **Session Invalidation Mechanics**:
   - **Single Logout**: Deletes the specific `session:sessionId` key in Redis, invalidating the Access/Refresh token pair immediately.
   - **Logout All Devices**: Scans Redis keys matching `session:*` for the user's ID and deletes them all. Increments the `tokenVersion` on the User's database record to reject any legacy tokens.

---

## 🔑 4. Multi-Factor Authentication (MFA)

FixFlow AI enforces MFA to establish high-confidence identity validation for sensitive actions.

### A. MFA Methods
* **Primary (TOTP)**: RFC 6238 Time-Based One-Time Passwords (configured via Google Authenticator, Authy, etc. using SHA-1, 6-digit codes, 30-second steps).
* **Secondary (Email OTP)**: Hashed 6-digit OTP code sent via SMTP, expiring strictly in 10 minutes.
* **Future-Proof (WebAuthn/FIDO2)**: Infrastructure prepared to support hardware security keys (YubiKey, Touch ID, Windows Hello) via standard challenge-response exchange APIs.

### B. MFA Step-Up Triggers
Users must complete an MFA challenge for the following events:
1. Logging in from a **new device** or an unrecognized IP address.
2. Changing account passwords or security settings.
3. Executing payments or editing Razorpay / Web3 wallet routing details.
4. Performing admin actions (e.g. deleting workspaces, updating user roles).
5. Approving or releasing milestones inside the Escrow FSM. The transition enforces checking of an `MFAVerifier` callback signature, throwing an `MFARequiredError` if omitted or unsuccessful, and embeds a `[MFA Verified]` verification stamp in the block's cryptographic metadata.

---

## 🛡️ 5. Authorization & RBAC Permissions Matrix

Access control is strictly enforced on the backend via Role-Based Access Control (RBAC).

### A. Role Hierarchy
```
[Super Admin] ──> [Admin] ──> [Manager] ──> [User] ──> [Guest]
```

### B. Role-Permission Mapping Matrix

| Permission | Guest | User | Manager | Admin | Super Admin |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `can_view_public_portal` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `can_create_proposal` | ❌ | ✅ | ✅ | ✅ | ✅ |
| `can_edit_proposal` | ❌ | ✅ | ✅ | ✅ | ✅ |
| `can_delete_proposal` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `can_manage_leads` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `can_manage_workspaces` | ❌ | ❌ | ❌ | ✅ | ✅ |
| `can_manage_billing` | ❌ | ❌ | ❌ | ✅ | ✅ |
| `can_manage_users` | ❌ | ❌ | ❌ | ❌ | ✅ |
| `can_audit_system` | ❌ | ❌ | ❌ | ❌ | ✅ |

### C. Backend Enforcement Example (NestJS/Express Middleware Pattern)
Every controller must use authorization guards verifying the decoded JWT claims:
```javascript
function authorize(requiredPermission) {
  return (req, res, next) => {
    const userPermissions = req.user.permissions || [];
    if (!userPermissions.includes(requiredPermission)) {
      return next(new ForbiddenError('Insufficient permissions to perform this action'));
    }
    next();
  };
}
```

---

## 🚀 6. API Security & Hardening

All API endpoints validate schemas, sanitize request payloads, and apply strict rate limits using Redis window counters.

### A. Rate Limiting Profiles
Configured via Redis sliding-window limiters to block Denial of Service (DoS) and brute-force attacks:

| Endpoint Pattern | Rate Limit Threshold | Cooldown Time | Action on Violation |
| :--- | :--- | :--- | :--- |
| `POST /api/auth/login` | 5 Requests | 1 Minute | Block IP + Temporary Account Lock |
| `POST /api/auth/forgot-password` | 3 Requests | 10 Minutes | Block IP |
| `POST /api/auth/mfa/verify` | 5 Requests | 10 Minutes | Invalidate OTP + Temporary Account Lock |
| `GET /api/public/*` | 100 Requests | 1 Minute | Rate limit warning header |
| `*` (General Authenticated) | 500 Requests | 1 Minute | 429 Too Many Requests response |

### B. Input Validation & Sanitization
- **Schema Validation**: Every endpoint must bind a **Zod** schema that strips unknown properties and strictly checks data types, formats, and lengths.
- **Payload Sanitization**: Cross-Site Scripting (XSS) filters sanitize all incoming string fields. Any string containing potential HTML or script blocks is stripped or escaped before being evaluated or written to storage.

---

## 🔒 7. OWASP Security Measures

Defense-in-depth protections are integrated at the application layer.

### A. Security Headers
The application API serves all responses with the following security-hardening headers:
* **Strict-Transport-Security**: `max-age=63072000; includeSubDomains; preload` (Enforces HTTPS).
* **Content-Security-Policy**: Restricts script, style, and object resource loads to explicit trusted origins only:
  ```
  default-src 'self'; script-src 'self' 'nonce-randomNonce'; object-src 'none'; frame-ancestors 'none';
  ```
* **X-Frame-Options**: `DENY` (Prevents clickjacking).
* **X-Content-Type-Options**: `nosniff` (Prevents MIME sniffing).
* **Referrer-Policy**: `strict-origin-when-cross-origin` (Protects origin information).
* **Permissions-Policy**: Restricts access to device features:
  ```
  geolocation=(), camera=(), microphone=()
  ```
* **Information Disclosure Prevention**: Express removes the `X-Powered-By` header automatically to avoid leaks.

### B. CSRF and XSS Defense
* **CSRF Protection**: Access and Refresh tokens are secured in SameSite=Strict cookies. Non-safe HTTP methods (POST, PUT, DELETE) require a double-submit CSRF token verify check in the headers (`X-CSRF-Token`) mapped against the session ID signature.
* **XSS Defense**: No client inputs are evaluated as raw HTML. Custom output rendering modules escape characters (`&`, `<`, `>`, `"`, `'`, `/`) using contextual encoding libraries.

### C. SQL Injection (SQLi) Defense
* FixFlow AI utilizes the **Prisma ORM** for PostgreSQL.
* All queries are compiled as parameterized statements. Raw SQL queries (`$queryRaw`) are restricted and must only accept pre-sanitized typed variables to prevent query manipulation.

---

## 🚨 8. Logging, Monitoring & Audit Auditing

The system monitors application health and records security operations in real-time.

### A. Auditable Security Events
The system writes structured JSON logs to CloudWatch/DataDog for:
* Successful/Failed login attempts (tracking username, IP, and location).
* Session revocations and multi-device logouts.
* MFA enrollment, challenges, and failures.
* Password change requests and verification completions.
* Workspace membership edits and role updates.
* High-risk operations (e.g. payout releases, API key generations).

### B. Privacy & Masking Rules
Log sanitizers inspect all telemetry payloads and **mask** the following attributes using regex filters before outputting:
- Hashed or plain passwords.
- JWT Access and Refresh Tokens.
- MFA secret tokens and OTP values.
- Financial data (credit cards, Razorpay routing keys).
- Personal Identifying Information (PII) like phone numbers or home addresses.

---

## 🏗️ 9. Infrastructure Security Topology

The network layout enforces isolation between compute, caching, and persistent layers.

```
+-------------------------------------------------------------+
|                       Public Internet                       |
+------------------------------+------------------------------+
                               |
                               v (DDoS Protection & TLS 1.3)
+-------------------------------------------------------------+
|                  CDN & WAF (AWS CloudFront)                 |
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|                Application Load Balancer (ALB)              |
+------------------------------+------------------------------+
                               |
                               v (Private VPC Subnet)
+-------------------------------------------------------------+
|         Backend Cluster (Node.js / Express EC2 / ECS)       |
+------------------+-----------------------+------------------+
                   |                       |
                   | (Private Subnet)      | (Private Subnet)
                   v                       v
+----------------------+               +----------------------+
|  Redis Session Store |               | PostgreSQL Database  |
|  (Upstash/ElastiCache)               | (AWS Aurora / RDS)   |
+----------------------+               +----------------------+
```

### A. Infrastructure Protections
* **WAF Layer**: AWS WAF inspects incoming packets, blocking malicious request strings, SQL injection attempts, and suspicious user-agent fingerprints.
* **Secure Transit**: TLS 1.3 is enforced globally. Any HTTP requests are permanently redirected to HTTPS at the WAF/CDN layer.
* **Secrets Management**: Configuration properties (database connection strings, API secrets) are fetched dynamically at runtime from AWS Secrets Manager and never committed to version control.
