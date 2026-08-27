# UniVolve — Manual Azure Infrastructure Guide

This is the full end-to-end guide for provisioning the UniVolve Azure infrastructure **manually via
the Azure Portal** (no Terraform). It mirrors exactly what the `UniVolve-Infra` Terraform config
builds, so if you ever want to cross-check a setting, that repo is the reference — but you don't need
to know Terraform to follow this.

Whoever is doing this: work through the sections **in order** — later resources reference earlier
ones (subnets before things that live in them, Key Vault before secrets, etc.).

## 0. Naming & conventions used below

Replace `univolve-prod` anywhere you see it with your own naming if you like, but stay consistent —
every resource name below reuses this prefix so they're easy to find together in the Portal.

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

## 8. Storage Account (avatar uploads)

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

Before creating the Container App (it references these), add 4 secrets in `kv-univolve-prod` →
**Secrets → + Generate/Import**:

| Secret name | Value |
|---|---|
| `db-password` | the Postgres admin password from step 10 |
| `acs-connection-string` | ACS resource (`acs-univolve-prod`) → Keys → **Connection string** |
| `storage-connection-string` | Storage account (`stunivolveprodassets`) → Access keys → **Connection string** |
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
| `TENANT_NAME` | Entra External ID tenant short name (step 16) |
| `TENANT_ID` | Entra External ID tenant GUID (step 16) |
| `API_CLIENT_ID` | the **API app registration's** client ID (step 16) — not either SPA's |

**Health probe**: liveness probe, HTTP, path `/health`, port `4000`.
**Scaling**: min 1 / max 5 replicas, HTTP scale rule at 50 concurrent requests.

## 16. Entra External ID (auth)

Entra External ID (CIAM) runs in its **own separate tenant** — a distinct identity directory from the
Azure AD tenant that owns your subscription/billing. You have to create that tenant first, switch into
it, and only then create the user flow and app registrations inside it. This is a one-time step per
project, not per-environment.

### 16.0 Create the External ID tenant

1. Azure Portal → search **"Microsoft Entra ID"** → **Overview** → **Manage tenants**.
2. **+ Create**. When asked for the tenant's **configuration**, choose **External configuration** (not
   *Workforce configuration* — that's for internal/employee identities). This is the CIAM/customer-
   facing option; depending on your Portal version it may instead be labeled tenant type **"Azure
   Active Directory (External)"** — same underlying thing, Microsoft has renamed this UI a few times.
3. Configuration: organization name (e.g. "UniVolve"), initial domain name (e.g. `univolve` → becomes
   `univolve.onmicrosoft.com` — this is your `TENANT_NAME`), country/region.
4. On the "Subscription" step, associate an Azure **subscription** and **resource group** for billing —
   you can point this at `rg-univolve-prod` or any resource group you like; this is just for the
   tenant resource's own billing record and has nothing to do with where your app resources actually
   live.
5. **Review + create**. Tenant provisioning can take a few minutes.
6. **Switch into the new tenant**: click the account/directory icon (top-right of the Portal) →
   **Switch directory** → select the tenant you just created (e.g. "univolve"). Everything from here
   on (user flow, app registrations) must be done **while switched into this tenant** — not the one
   your subscription normally lives in.
7. Note the tenant's **Tenant ID** (Entra ID → Overview → Tenant ID, while switched into it) — this is
   your `TENANT_ID`.

You'll switch back and forth between this identity tenant and your main subscription's tenant
throughout the rest of setup — Azure resources (Postgres, Key Vault, etc.) stay in your normal
subscription; only identity/auth objects (user flow, the 3 app registrations below) live in this new
one.

You need a **User Flow** plus **three** app registrations, all inside this tenant:

1. **User flow**: External Identities → User flows → new "Sign up and sign in" flow (e.g.
   `SignUpSignIn`), email + password identity provider.
2. **API app registration** (`univolve-api`): no redirect URI. Expose an API → Application ID URI
   `api://<its-client-id>` → add scope `access` (Admins and users, enabled). This app's **client ID**
   is `API_CLIENT_ID` above.
3. **Admin SPA app registration** (`univolve-admin-frontend`): redirect URI = Admin Static Web App's
   URL (platform: Single-page application). API permissions → add `univolve-api`'s `access` scope →
   grant admin consent. Add this app to the user flow's Applications list.
4. **Volunteer SPA app registration** (`univolve-volunteer-frontend`): same as above, redirect URI =
   Volunteer Static Web App's URL. Add to the user flow too.

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
2. **All operations → Inbound processing → </> (code view)** — paste this policy (fill in your own
   tenant name / API client ID):
   ```xml
   <policies>
     <inbound>
       <base />
       <cors allow-credentials="false">
         <allowed-origins><origin>*</origin></allowed-origins>
         <allowed-methods><method>*</method></allowed-methods>
         <allowed-headers><header>*</header></allowed-headers>
       </cors>
       <validate-jwt header-name="Authorization" failed-validation-httpcode="401">
         <openid-config url="https://<TENANT_NAME>.ciamlogin.com/<TENANT_NAME>.onmicrosoft.com/v2.0/.well-known/openid-configuration" />
         <audiences><audience>api://<API_CLIENT_ID></audience></audiences>
       </validate-jwt>
       <rate-limit calls="100" renewal-period="60" />
     </inbound>
     <backend><base /></backend>
     <outbound><base /></outbound>
     <on-error><base /></on-error>
   </policies>
   ```
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
| `VITE_B2C_TENANT` | Entra External ID tenant short name (step 16) |
| `VITE_API_SCOPE` | `api://<API_CLIENT_ID>/access` (step 16.2) — same value in both frontend workflows |
| `VITE_ADMIN_CLIENT_ID` | Step 16.3 — admin SPA's own client ID |
| `VITE_VOLUNTEER_CLIENT_ID` | Step 16.4 — volunteer SPA's own client ID |

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
3. Log in once through the Volunteer Portal with `admin@university.lk` (or whatever External ID
   account you intend as the admin), then promote it manually:
   ```sql
   UPDATE users SET system_role='SUPER_ADMIN' WHERE email='admin@university.lk';
   ```
   (run against the Postgres server the same way as step 19).
