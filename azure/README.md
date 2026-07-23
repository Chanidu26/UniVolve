# VMS — Azure Deployment

## Architecture (matches CA01 deployment diagram)

Two separate SPAs per the CA01 Component/Deployment Diagrams — an **Admin Portal** and a
**Volunteer Portal** (Organizer is a per-event permission on a Volunteer, not a separate portal) —
each deployed to its own Azure Static Web App:

```
                    Admin Portal (azure/admin-frontend)  ──┐
Users ──HTTPS──►                                            ├──► Azure Static Web Apps
                    Volunteer Portal (azure/volunteer-frontend)┘
   │                       │  MSAL login
   │                       ▼
   │           Entra External ID  (JWT with role claims)
   │                       │
   └──HTTPS + JWT──► Azure API Management  ── validate-jwt, rate-limit
                           │  (VNet)
                           ▼
                 Azure Container Apps (backend, internal-only)
                    │ Managed Identity     │ VNet injection
                    ▼                      ▼
              Azure Key Vault      Azure PostgreSQL Flexible Server (private, HA)
                    │
              Azure Communication Services ──► email to volunteers
```

## Deploy steps
1. **Create the Entra External ID tenant manually** (Terraform can't create it):
   - Register two SPA app registrations — one for `admin-frontend`, one for `volunteer-frontend`
     (redirect URI = each app's Static Web App URL) — and expose an API scope `access`.
   - Note tenant name, tenant GUID, and both client ids.
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
   `ACR_NAME`, `VITE_API_URL` (APIM gateway url + /api), `VITE_B2C_TENANT`, `VITE_API_SCOPE`, and
   the two app-specific `VITE_ADMIN_CLIENT_ID` / `VITE_VOLUNTEER_CLIENT_ID` values.
6. **Promote first admin** after logging in once:
   ```sql
   UPDATE users SET system_role='SUPER_ADMIN' WHERE email='admin@university.lk';
   ```
