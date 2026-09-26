# UniVolve — Azure Infrastructure Guide

There are now two ways to provision this: **Terraform** (`azure/terraform/` in this repo — recommended,
does everything below in one `terraform apply`) or **manually via the Azure Portal** (this document's
walkthrough, section by section, for anyone who wants to see/build each piece by hand or cross-check a
setting). Both build the exact same set of resources; the manual steps below mirror `azure/terraform/`
resource-for-resource, so either document can be used to sanity-check the other.

**Auth note:** this stack uses plain **Google Sign-In** (a single "Sign in with Google" button, no
separate sign-up) — not Entra External ID. There's no Azure-side identity tenant to provision; the only
external-to-Azure step is creating a Google OAuth Client ID (section 16 below), and admin access is a
plain email allowlist read by the backend, not a role claim from an identity provider.

## Fast path: Terraform

```bash
cd azure/terraform
cp terraform.tfvars.example terraform.tfvars   # fill in db_admin_password, google_client_id, jwt_secret,
                                                 # super_admin_emails, apim_publisher_email
terraform init
terraform apply
```

This provisions everything in sections 1–15 and 17–18 below. Still manual, either way:
- **Section 16** (Google OAuth Client ID) — a Google Cloud Console step, outside Azure/Terraform's reach.
- **Section 19** (apply the DB schema) — Terraform pushes the schema into a Key Vault secret
  (`db-schema`) for reference, but doesn't run it against Postgres itself; you still need network access
  to the private server to actually apply it.
- The **Handoff** section at the bottom (GitHub Actions secrets, first deploy order) — same either way.

Everything past this point describes the **manual Portal walkthrough** — skip to section 16 if you used
Terraform for 1–15/17–18 already.

## 0. Naming & conventions used below

Replace `univolve-prod` anywhere you see it with your own naming if you like, but stay consistent —
every resource name below reuses this prefix so they're easy to find together in the Portal. (Terraform
calls this the `prefix` variable, default `univolve-prod`.)

Note: the resource group name, the backend Container App's name, and the backend image name are also
hardcoded as literal strings inside `.github/workflows/deploy-backend.yml` in the `UniVolve` repo (not
read from a secret/variable like everything else) — that workflow now uses the same `univolve` names
as this guide, so just follow the names below as given and everything will line up.

- Resource group: `rg-univolve-prod`
- Region: **Southeast Asia** (used for everything — keeping one region simplifies VNet peering/private
  endpoints; Postgres zone-redundant HA is *not* available in this region on most subscriptions, which
  is why the HA step below says to leave it off)

## 1. Resource Group

**Resource Groups → + Create**
- Name: `rg-univolve-prod`
- Region: Southeast Asia

Everything else in this guide goes inside this resource group unless stated otherwise.

## 2. Register resource providers

Fresh subscriptions sometimes aren't registered for these namespaces, which blocks creating Container
Apps / Communication Services later. Do this now so it's out of the way.

**Subscriptions → (your subscription) → Resource providers**
- Search `Microsoft.App` → **Register** (wait until status = Registered)
- Search `Microsoft.Communication` → **Register** (wait until status = Registered)

## 3. Virtual Network + subnets

**Virtual networks → + Create**
- Name: `vnet-univolve-prod`, Region: Southeast Asia
- Address space: `10.10.0.0/16`

After creation, add these 4 subnets (**Subnets → + Subnet**):

| Name | Address range | Delegation | Notes |
|---|---|---|---|
| `snet-aca` | `10.10.0.0/23` | `Microsoft.App/environments` | Container Apps Environment lives here |
| `snet-db` | `10.10.2.0/24` | `Microsoft.DBforPostgreSQL/flexibleServers` | Postgres Flexible Server |
| `snet-private-endpoints` | `10.10.3.0/24` | none | Private endpoints for Key Vault, ACR, Blob |
| `snet-apim` | `10.10.4.0/24` | none | API Management (VNet-injected) |

## 4. Network Security Group for the APIM subnet

API Management **requires** an NSG on its subnet before it'll deploy into it — this is a mandatory
Azure requirement, not optional hardening.

**Network security groups → + Create**
- Name: `nsg-apim-univolve-prod`, Region: Southeast Asia

Add these inbound rules:

| Priority | Name | Port | Protocol | Source | Action |
|---|---|---|---|---|---|
| 100 | allow-https-inbound | 443 | TCP | Internet | Allow |
| 110 | allow-http-inbound | 80 | TCP | Internet | Allow |
| 120 | allow-apim-management-inbound | 3443 | TCP | ApiManagement (service tag) | Allow |

Then: **NSG → Subnets → Associate** → pick `vnet-univolve-prod` / `snet-apim`.

## 5. NAT Gateway (outbound internet for the Container Apps subnet)

The backend needs outbound internet to reach Communication Services and Blob Storage endpoints, but
`snet-aca` has no public IP of its own.

**NAT gateways → + Create**
- Name: `nat-univolve-prod`, Region: Southeast Asia
- Create a new Standard SKU public IP: `pip-nat-univolve-prod`
- Under **Subnet**, associate it with `vnet-univolve-prod` / `snet-aca`

## 6. Private DNS Zones

Create these 4 **Private DNS zones**, then link each one to `vnet-univolve-prod` (**Virtual network
links → + Add** on each zone):

| Zone name |
|---|
| `univolve-prod.private.postgres.database.azure.com` |
| `privatelink.vaultcore.azure.net` |
| `privatelink.azurecr.io` |
| `privatelink.blob.core.windows.net` |

## 7. Azure Container Registry

**Container registries → + Create**
- Name: `acrunivolveprod` (must be globally unique — append digits if taken; ACR names can't contain
  hyphens, hence no dashes here)
- SKU: **Premium** (required — private endpoints need Premium tier)
- Admin user: **disabled** (the backend authenticates via managed identity, not admin credentials)

**Private endpoint**: ACR → Networking → Private access → **+ Private endpoint**
- Subnet: `snet-private-endpoints`
- Private DNS zone: `privatelink.azurecr.io` (the one from step 6)

## 8. Storage Account (avatar + event photo uploads)

**Storage accounts → + Create**
- Name: `stunivolveprodassets` (globally unique, alphanumeric only, ≤24 characters)
- Region: Southeast Asia, Performance: Standard, Redundancy: LRS
- After creation: **Containers → + Container** → name `avatars`, public access level **Private**

**Private endpoint**: Storage account → Networking → Private endpoint connections → **+ Private
endpoint**
- Target sub-resource: **blob**
- Subnet: `snet-private-endpoints`
- Private DNS zone: `privatelink.blob.core.windows.net`

⚠️ Create this private endpoint **before** the Key Vault one in step 9 — Azure serializes network
operations on a shared subnet, so doing two at once on `snet-private-endpoints` can transiently fail
with "subnet is in Updating state." Just do them one at a time, waiting for each to finish.

## 9. Key Vault

**Key vaults → + Create**
- Name: `kv-univolve-prod`
- Permission model: **Azure role-based access control (RBAC)** — not vault access policies
- Networking: leave **public access enabled** for now (simpler for manually adding secrets below from
  your own machine; the private endpoint still restricts the backend's actual runtime path)

**Private endpoint**: Key Vault → Networking → Private endpoint connections → **+ Private endpoint**
(create this *after* the storage one above, same reasoning)
- Target sub-resource: **vault**
- Subnet: `snet-private-endpoints`
- Private DNS zone: `privatelink.vaultcore.azure.net`

**Grant yourself access** so you can add secrets: Key Vault → Access control (IAM) → Add role
assignment → **Key Vault Administrator** → assign to yourself.

## 10. PostgreSQL Flexible Server

**Azure Database for PostgreSQL flexible servers → + Create**
- Name: `pg-univolve-prod`
- Region: Southeast Asia, Version: **16**
- Compute + storage: General Purpose, `D2s_v3`, 32 GiB storage
- Authentication: PostgreSQL authentication, admin username `univolveadmin`, set a strong password
  (you'll need this for step 14)
- **Networking**: Private access (VNet integration) → select `vnet-univolve-prod` / `snet-db` → link to
  the postgres private DNS zone from step 6
- **High availability**: leave **disabled**. Zone-redundant HA is commonly unavailable for this
  region/subscription combination and will fail server creation if you try to enable it — this is a
  known limitation, not a mistake if it happens to you.
- Backup retention: 7 days

After creation: **Databases → + Add** → name `univolvedb`.

## 11. Azure Communication Services + Email

**Communication Services → + Create**
- Name: `acs-univolve-prod`, Data location: Asia Pacific

**Email Communication Services → + Create**
- Name: `email-univolve-prod`, Data location: Asia Pacific
- After creation: **Provision domains → + Add domain** → **Azure Managed Domain** (Azure auto-provisions
  a subdomain you can send from immediately, no custom domain/DNS verification needed)
- Then, on the **Communication Service** (`acs-univolve-prod`) → **Domains** → **Connect domain** → link
  the email service's managed domain to this ACS resource (the backend sends mail through the ACS
  resource, using the domain connected here)

## 12. Log Analytics Workspace + Container Apps Environment

**Log Analytics workspaces → + Create**
- Name: `law-univolve-prod`, Pricing tier: Pay-as-you-go (PerGB2018), Retention: 30 days

**Container Apps Environments → + Create**
- Name: `cae-univolve-prod`
- Logs destination: use the Log Analytics workspace above
- **Networking**: use your own virtual network → `vnet-univolve-prod` / `snet-aca`
- **VNet configuration**: Internal (no public inbound — APIM is the public front door, not this)

## 13. Managed Identity + role assignments

**Managed Identities → + Create**
- Name: `id-backend-univolve-prod`, Region: Southeast Asia

Grant it access to the two things the backend needs to read/pull from at runtime:

- **ACR** (`acrunivolveprod`) → Access control (IAM) → Add role assignment → **AcrPull** → assign to
  `id-backend-univolve-prod`
- **Key Vault** (`kv-univolve-prod`) → Access control (IAM) → Add role assignment → **Key Vault
  Secrets User** → assign to `id-backend-univolve-prod`

⚠️ **Wait 2-5 minutes after creating these role assignments** before creating the Container App in the
next step. Azure's authorization grant takes a little time to actually propagate after the role
assignment shows as created — if the Container App tries to pull the image or resolve a Key Vault
secret reference too soon, you'll see errors like "Unable to get value using Managed identity." If you
hit that anyway, just retry the Container App creation a few minutes later — nothing is actually
broken, it just needs time.

## 14. Key Vault secrets

Before creating the Container App (it references these), add 5 secrets in `kv-univolve-prod` →
**Secrets → + Generate/Import**:

| Secret name | Value |
|---|---|
| `db-password` | the Postgres admin password from step 10 |
| `acs-connection-string` | ACS resource (`acs-univolve-prod`) → Keys → **Connection string** |
| `storage-connection-string` | Storage account (`stunivolveprodassets`) → Access keys → **Connection string** |
| `jwt-secret` | a long random value (e.g. `openssl rand -base64 48`) — signs the backend's own session JWTs |
| `db-schema` | paste the full contents of `azure/db/schema.sql` from the `UniVolve` repo |

## 15. Container App (backend)

**Container Apps → + Create**
- Name: `ca-backend-univolve-prod`
- Container Apps Environment: `cae-univolve-prod`
- **Identity**: Container App → Identity → User Assigned → add `id-backend-univolve-prod`
- **Registry**: Container App → Registry → server `acrunivolveprod.azurecr.io`, identity =
  `id-backend-univolve-prod` (not admin credentials)
- Image: `acrunivolveprod.azurecr.io/univolve-backend:latest` (this image doesn't exist until the app's
  own CI pipeline pushes it the first time — see the handoff section below; the Container App create
  step may need to be revisited once that image exists)
- **Ingress**: enabled, **internal only** (do not expose externally — APIM is the only public entry
  point), target port `4000`

**Secrets** (Container App → Secrets → + Add, reference each from the Key Vault secret + the managed
identity):

| Secret name | Key Vault reference |
|---|---|
| `db-password` | `db-password` |
| `acs-connection` | `acs-connection-string` |
| `storage-connection` | `storage-connection-string` |
| `jwt-secret` | `jwt-secret` |

**Environment variables** (Container App → Containers → Edit and deploy → Environment variables):

| Name | Value |
|---|---|
| `DB_HOST` | Postgres server's FQDN (`pg-univolve-prod....postgres.database.azure.com`) |
| `DB_USER` | `univolveadmin` |
| `DB_NAME` | `univolvedb` |
| `DB_PASSWORD` | secret ref → `db-password` |
| `ACS_CONNECTION_STRING` | secret ref → `acs-connection` |
| `ACS_SENDER` | `DoNotReply@<the managed domain from step 11>` |
| `STORAGE_CONNECTION_STRING` | secret ref → `storage-connection` |
| `STORAGE_CONTAINER` | `avatars` |
| `KEY_VAULT_URI` | `https://kv-univolve-prod.vault.azure.net/` |
| `JWT_SECRET` | secret ref → `jwt-secret` |
| `GOOGLE_CLIENT_ID` | the OAuth Client ID from step 16 — same value both frontends use |
| `SUPER_ADMIN_EMAILS` | comma-separated Google account emails to treat as `SUPER_ADMIN` |

**Health probe**: liveness probe, HTTP, path `/health`, port `4000`.
**Scaling**: min 1 / max 5 replicas, HTTP scale rule at 50 concurrent requests.

## 16. Google Sign-In (auth)

No Azure resource here — this is a Google Cloud Console step, done once.

1. [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**
   (create/select a project first if you don't have one for this).
2. **+ Create Credentials → OAuth client ID**.
3. If prompted, configure the **OAuth consent screen** first — External user type, app name
   "UniVolve," your support email; scopes can stay at the default (`email`, `profile`, `openid`).
4. Application type: **Web application**. Name: `univolve`.
5. **Authorized JavaScript origins** — add both Static Web App URLs (from step 17, once you have them;
   you can come back and add these after creating the Static Web Apps):
   - `https://<admin-swa-hostname>`
   - `https://<volunteer-swa-hostname>`
6. No **Authorized redirect URIs** needed — the Google Identity Services button used by both frontends
   returns the ID token directly to the page via a JS callback, not a redirect.
7. **Create**. Copy the **Client ID** (looks like `xxxx.apps.googleusercontent.com`) — this is the same
   value used everywhere: `GOOGLE_CLIENT_ID` on the backend (step 15) and `VITE_GOOGLE_CLIENT_ID` in
   both frontend deploy workflows (handoff section below).

**Administrator access** is a plain email allowlist, not a role assigned anywhere in Google or Azure:
set `SUPER_ADMIN_EMAILS` (step 15) to the Google account email(s) that should be treated as
`SUPER_ADMIN`. The backend checks the signed-in email against this list on every `/auth/google` call and
syncs `users.system_role` accordingly — no manual database promotion needed, and removing an email (then
redeploying the backend, and having that user re-login) removes admin access.

## 17. Static Web Apps (two portals)

**Static Web Apps → + Create** — create **two**, one for each frontend:

| Name | Notes |
|---|---|
| `swa-admin-univolve-prod` | Plan: Standard. Deployment source: GitHub Actions is fine to skip during creation — the `UniVolve` repo's own workflow handles deploys; you just need the resource + its deploy token. |
| `swa-volunteer-univolve-prod` | Same. |

Region for Static Web Apps is limited — **East Asia** is the nearest supported region if Southeast
Asia isn't offered for this resource type.

Each Static Web App has its own **deployment token**: Static Web App → Overview → **Manage deployment
token**. You'll need both for the handoff below.

Once you have both hostnames, go back to step 16 and add them as Authorized JavaScript origins on the
Google OAuth client if you skipped that earlier.

## 18. API Management

**API Management services → + Create**
- Name: `apim-univolve-prod` (must be globally unique — append a random suffix if taken, e.g.
  `apim-univolve-prod-9a5702`)
- Pricing tier: **Developer**
- **Virtual network**: External, subnet = `vnet-univolve-prod` / `snet-apim`

⚠️ This resource alone commonly takes **20-45 minutes** to provision — that's normal, not stuck.

Once created:
1. **APIs → + Add API → HTTP API** (or "Blank API"): name `univolve-api`, path `api`, backend URL =
   the Container App's internal FQDN (Container App → Overview → Application URL — starts with
   `https://ca-backend-univolve-prod...`).
2. **All operations → Inbound processing → </> (code view)** — paste this policy:
   ```xml
   <policies>
     <inbound>
       <base />
       <cors allow-credentials="false">
         <allowed-origins><origin>*</origin></allowed-origins>
         <allowed-methods><method>*</method></allowed-methods>
         <allowed-headers><header>*</header></allowed-headers>
       </cors>
       <rate-limit calls="100" renewal-period="60" />
     </inbound>
     <backend><base /></backend>
     <outbound><base /></outbound>
     <on-error><base /></on-error>
   </policies>
   ```
   No `validate-jwt` here — the backend verifies its own session JWT itself (issued after checking the
   Google ID token), so APIM doesn't need to know about any external identity provider.
3. Add a wildcard operation so all routes/methods pass through: **+ Add operation** → method `GET`
   (any), URL template `/*`, display name "All operations."

## 19. Apply the DB schema

From a machine that can reach the private Postgres server (a VM/jumpbox on `vnet-univolve-prod`, or
Azure Cloud Shell with VNet integration — a plain laptop won't reach it since it's private-only):
```bash
psql "host=<postgres FQDN from step 10> user=univolveadmin dbname=univolvedb sslmode=require" -f azure/db/schema.sql
```

---

# Handoff: what goes into the `UniVolve` repo's pipeline secrets/variables

Once everything above exists, add these to **`UniVolve` repo → Settings → Secrets and variables →
Actions**. All of the following are **Secrets** (none need to be plain Variables in this repo).

| Secret name | Where it comes from |
|---|---|
| `AZURE_CREDENTIALS` | A service principal JSON — see below, not from anything created above |
| `ACR_NAME` | `acrunivolveprod` (the registry name, without `.azurecr.io`) |
| `SWA_ADMIN_DEPLOY_TOKEN` | Step 17 — `swa-admin-univolve-prod`'s deployment token |
| `SWA_VOLUNTEER_DEPLOY_TOKEN` | Step 17 — `swa-volunteer-univolve-prod`'s deployment token |
| `VITE_API_URL` | APIM → Overview → **Gateway URL**, with `/api` appended |
| `VITE_GOOGLE_CLIENT_ID` | Step 16 — the Google OAuth Client ID (same value in both frontend workflows) |

**Getting `AZURE_CREDENTIALS`**: this needs a service principal with rights to push images to ACR and
update the Container App, created via Cloud Shell:
```bash
az ad sp create-for-rbac --name "univolve-github-actions" \
  --role contributor \
  --scopes /subscriptions/<subscription-id>/resourceGroups/rg-univolve-prod \
  --sdk-auth
```
Copy the entire JSON it prints into the `AZURE_CREDENTIALS` secret.

## First deploy order

1. Push to `azure/backend/**` once `AZURE_CREDENTIALS` and `ACR_NAME` are set — this builds and pushes
   the first backend image and updates the Container App. (The Container App in step 15 can be created
   with a placeholder image beforehand; this pipeline run is what actually gets a real image running.)
2. Push to `azure/admin-frontend/**` and `azure/volunteer-frontend/**` once the rest of the secrets
   above are set — deploys both Static Web Apps.
3. Set `SUPER_ADMIN_EMAILS` on the backend Container App (step 15/16) to the administrator's Google
   account email, then have them sign in (or re-sign-in if already signed in) via **Sign in with
   Google**. The backend checks the signed-in email against this list on every login and syncs
   `users.system_role` accordingly. No manual database promotion is required — removing an email from
   the list (and redeploying the backend) removes administrator access on that user's next login.
