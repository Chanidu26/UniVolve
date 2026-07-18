# VMS — Azure Deployment

## Architecture (matches CA01 deployment diagram)
```
Users ──HTTPS──► Azure Static Web Apps (React SPA)
   │                       │  MSAL login
   │                       ▼
   │              Azure AD B2C  (JWT with role claims)
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
1. **Create the AD B2C tenant manually** (Terraform can't create B2C tenants):
   - Create tenant, add `B2C_1_signupsignin` sign-up/sign-in user flow.
   - Register a SPA app (redirect URI = your SWA URL), expose an API scope `access`.
   - Note tenant name, tenant GUID, client id.
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
5. **Deploy frontend**: push to GitHub with the workflows in `.github/workflows/`,
   setting secrets: `SWA_DEPLOY_TOKEN` (terraform output), `AZURE_CREDENTIALS`, `ACR_NAME`,
   `VITE_API_URL` (APIM gateway url + /api), B2C values.
6. **Promote first admin** after logging in once:
   ```sql
   UPDATE users SET system_role='SUPER_ADMIN' WHERE email='admin@university.lk';
   ```
