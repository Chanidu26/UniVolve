# VMS — Azure Deployment

## Architecture (matches CA01 deployment diagram)

Two separate SPAs per the CA01 Component/Deployment Diagrams — an **Admin Portal** and a
**Volunteer Portal** (Organizer is a per-event permission on a Volunteer, not a separate portal) —
each deployed to its own Azure Static Web App:

```
                    Admin Portal (azure/admin-frontend)  ──┐
Users ──HTTPS──►                                            ├──► Azure Static Web Apps
                    Volunteer Portal (azure/volunteer-frontend)┘
   │                       │  Sign in with Google (ID token)
   │                       ▼
   │              Google OAuth 2.0 / OIDC
   │                       │
   │              POST /auth/google ──► backend verifies ID token,
   │                       │            mints its own signed JWT
   └──HTTPS + JWT──► Azure API Management  ── rate-limit
                           │  (VNet)
                           ▼
                 Azure Container Apps (backend, internal-only)
                    │ Managed Identity     │ VNet injection
                    ▼                      ▼
              Azure Key Vault      Azure PostgreSQL Flexible Server (private, HA)
                    │
              Azure Communication Services ──► email to volunteers
```

**Auth note:** this variant uses plain **Google Sign-In**, not Entra External ID — there's a single
"Sign in with Google" button (no separate sign-up) on both portals. The backend verifies the Google
ID token once via `google-auth-library`, JIT-provisions/updates the local `users` row, and issues its
own session JWT (`JWT_SECRET`) for subsequent API calls — the same pattern the `local/` variant uses
for its username/password login, just with Google as the identity source instead of a password. Admin
status is a plain email allowlist (`SUPER_ADMIN_EMAILS`) since there's no external IdP role claim to
read anymore. Since APIM no longer validates a third-party-issued JWT (our own backend does), the
`validate-jwt` policy referenced in the infra guide is no longer applicable — the gateway now only
needs rate-limiting/CORS.

## Deploy steps
1. **Create a Google OAuth 2.0 Client ID** (Google Cloud Console → APIs & Services → Credentials →
   Create Credentials → OAuth client ID → Application type: Web application):
   - Add both Static Web App URLs (admin + volunteer) under **Authorized JavaScript origins**.
   - No redirect URI needed — Google Identity Services' one-tap/button flow used here returns the
     ID token directly to the page via a JS callback, not a redirect.
   - Both frontends share the **same** client ID.
2. **Provision infrastructure**:
   ```bash
   cd terraform
   cp terraform.tfvars.example terraform.tfvars   # fill values
   terraform init && terraform apply
   ```
3. **Apply DB schema** (from a VNet-connected machine or temporary jumpbox):
   ```bash
   psql "host=<postgres_fqdn> user=vmsadmin dbname=vmsdb sslmode=require" -f db/schema.sql
   ```
4. **Push backend image**:
   ```bash
   az acr login --name <acr_login_server>
   docker build -t <acr>.azurecr.io/vms-backend:latest ./backend
   docker push <acr>.azurecr.io/vms-backend:latest
   ```
5. **Deploy both frontends**: push to GitHub with the workflows in `.github/workflows/`
   (`deploy-admin-frontend.yml`, `deploy-volunteer-frontend.yml`), setting secrets:
   `SWA_ADMIN_DEPLOY_TOKEN` / `SWA_VOLUNTEER_DEPLOY_TOKEN` (terraform outputs), `AZURE_CREDENTIALS`,
   `ACR_NAME`, `VITE_API_URL` (APIM gateway url + /api), and `VITE_GOOGLE_CLIENT_ID` (same value in
   both workflows).
6. **Configure administrator access**: set the backend's `SUPER_ADMIN_EMAILS` environment variable
   (Container App → Environment variables) to a comma-separated list of the Google account emails
   that should be treated as `SUPER_ADMIN`. On every login, the backend checks the signed-in Google
   email against this list and syncs `users.system_role` accordingly.

   No manual SQL promotion is required. Existing users are synchronized on their next login, so
   removing an email from `SUPER_ADMIN_EMAILS` (and redeploying the backend) also removes
   administrator access on that user's next login.
