# Non-Functional Requirements (NFR) Verification Report

**Project:** UniVolve — University Volunteer Management System
**Author:** EG/2021/4524 — Gunarathna B.V.I.D.W (Member 6 — QA Lead)
**Date:** September 2026

---

## Summary

This document provides evidence that each non-functional requirement claimed in
the CA01 report has been verified through automated testing, code inspection,
and/or measurement.

---

## NFR Verification Matrix

| NFR | Requirement | Target | Verification Method | Result | Status |
|---------|-------------------------------------|---------------------|---------------------------------------------|------------------------------|--------|
| NFR-01 | API response time | < 500 ms | Supertest timing on key endpoints | All endpoints < 200 ms (local) | ✅ Pass |
| NFR-01 | Search performance | < 500 ms | `test/search.test.js` with parameterised queries | Responses < 100 ms (local) | ✅ Pass |
| NFR-02 | Scalability under load | Concurrent requests | `test/applications.test.js` concurrent slot test | Atomic slot allocation confirmed | ✅ Pass |
| NFR-03 | Authentication & Authorisation | JWT + RBAC | `test/auth.test.js` — 401/403 on invalid/missing tokens | All cases pass | ✅ Pass |
| NFR-03 | SQL Injection prevention | Parameterised queries | `test/search.test.js` — injection attempt returns empty, not error | Confirmed safe | ✅ Pass |
| NFR-03 | Security headers | OWASP best practice | `test/security.test.js` — Helmet headers verified | X-Content-Type-Options, X-Frame-Options present; X-Powered-By removed | ✅ Pass |
| NFR-03 | Rate limiting | Defence-in-depth | `middleware/rateLimiter.js` — 15 req/15min on auth, 100 req/15min on API | Configured and tested | ✅ Pass |
| NFR-03 | Input validation | Reject malformed input | `test/security.test.js` — invalid emails, short passwords, bad UUIDs all return 400 | Confirmed | ✅ Pass |
| NFR-03 | CORS configuration | Restrict origins | Azure `server.js` reads `ALLOWED_ORIGINS` env var; local uses open CORS for dev | Verified in code | ✅ Pass |
| NFR-04 | Responsive UI (mobile) | Usable at 768px, 480px | Media queries added to all 4 `styles.css`; manual screenshot evidence | Nav wraps, tables scroll, cards stack | ✅ Pass |
| NFR-06 | Automated test coverage | Core flows covered | 6 test suites, 30+ test cases via Jest + Supertest | All passing | ✅ Pass |
| NFR-06 | CI/CD pipeline | Tests gate PRs | `.github/workflows/ci-test.yml` runs on `pull_request` | Pipeline verified | ✅ Pass |
| NFR-06 | Structured error handling | No unhandled rejections | `middleware/errorHandler.js` + `asyncWrap` on all async controllers | Errors return structured JSON | ✅ Pass |

---

## Detailed Evidence

### NFR-01: Performance

- **Method:** Supertest measures response time for each API call.
- **Endpoints tested:** `/api/auth/login`, `/api/events`, `/api/events?search=...`,
  `/api/applications/mine`, `/api/users/me/hours`
- **Result:** All responses complete in under 200ms on local Docker (Postgres 16).
  The 500ms target is met with wide margin.

### NFR-02: Scalability

- **Concurrent slot test:** Three volunteers apply simultaneously to a role with
  1 slot. The `FOR UPDATE` lock in `applicationController.apply` ensures atomic
  slot checking — only one approval can succeed.
- **Connection pooling:** `pg.Pool` with default `max: 10` connections prevents
  connection exhaustion under load.
- **Indexed queries:** All frequently-filtered columns have database indexes
  (events.status, events.event_date, events.category, applications.volunteer_id,
  attendance.volunteer_id).

### NFR-03: Security

#### Authentication & Authorisation
- JWT tokens issued on login/register with 8-hour expiry.
- `authenticate` middleware verifies tokens on every protected route.
- `requireRole('SUPER_ADMIN')` guards admin-only endpoints.
- Tests: `test/auth.test.js` verifies 401 on missing/invalid tokens, 403 on
  insufficient role.

#### SQL Injection Prevention
- All queries use parameterised placeholders (`$1`, `$2`, ...).
- `test/search.test.js` sends `?search='; DROP TABLE events; --` and verifies
  the request returns an empty array (not an error).
- Code review confirms no string concatenation of user input in SQL.

#### Security Headers
- `helmet` middleware adds:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN`
  - `Strict-Transport-Security` (on HTTPS)
  - Removes `X-Powered-By`
- Verified in `test/security.test.js`.

#### Rate Limiting
- **Auth endpoints:** 15 requests per 15-minute window per IP.
- **General API:** 100 requests per 15-minute window per IP.
- On Azure, this is a second layer behind APIM's rate-limit-by-key policy.

#### Input Validation
- `joi` schemas validate all POST/PUT request bodies.
- Invalid emails, short passwords, non-UUID IDs, and missing required fields
  all return 400 with field-level error details.
- Verified in `test/security.test.js`.

#### CORS
- **Local:** Open CORS (`cors()`) for development convenience.
- **Azure:** `ALLOWED_ORIGINS` environment variable restricts origins;
  falls back to `*` only if the variable is unset (flagged for tightening).

### NFR-04: Usability — Responsive Design

Responsive CSS breakpoints added at **768px** (tablet) and **480px** (phone):

| Component | Desktop | Mobile (≤ 768px) |
|-----------|---------|------------------|
| Nav bar | Single row, links inline | Wraps, user section full-width |
| Cards | Full padding | Reduced padding |
| Tables | Full-width | Horizontally scrollable |
| Filter bar | Inline flex | Stacked vertically |
| Profile header | Side-by-side | Stacked, centered |
| Modals | 480px fixed | 95vw responsive |
| Tabs | Inline | Horizontally scrollable |

### NFR-06: Maintainability

#### Test Coverage
- **6 test suites**, **30+ test cases** covering:
  - Auth (register, login, JWT, RBAC)
  - Events (CRUD, search/filter, status visibility)
  - Applications (apply, duplicate prevention, slot capacity, approve/reject)
  - Attendance (mark, verify hours, my hours dashboard)
  - Search security (SQL injection attempts)
  - Security (headers, validation, error handling)

#### CI Pipeline
- `.github/workflows/ci-test.yml` runs on every pull request to `main`.
- Uses Postgres 16 service container for isolated test database.
- Runs `npm test` with `--ci --forceExit` flags.

#### Structured Error Handling
- `asyncWrap()` catches rejected promises from Express 4 async handlers.
- Central `errorHandler` returns structured JSON with appropriate status codes.
- Postgres constraint violations mapped to 400/409 instead of bare 500.

---

## Test Execution

```bash
# Local (requires Docker)
cd local
docker compose -f docker-compose.test.yml up -d
cd backend
npm install
npm test

# CI (GitHub Actions)
# Automatically triggered on pull_request to main
```

---

## Known Limitations

1. **Azure auth testing:** The Azure variant uses Entra External ID (Azure AD B2C)
   which cannot be unit-tested without a real Entra tenant. This is documented
   rather than faked.
2. **Rate limit testing:** Full rate-limit exhaustion testing is not included in
   CI (it would slow down the pipeline). The middleware is tested by code
   inspection and manual verification.
3. **Performance under production load:** Local Docker measurements provide a
   baseline. True production performance depends on Azure Container Apps
   resource allocation.
