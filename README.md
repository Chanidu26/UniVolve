# University Volunteering & Event Management System (VMS)

Full-stack implementation of the CA01 architecture report (EC8208).
3-Tier: React → Node.js/Express REST API → PostgreSQL.

- `local/`  — Dockerized local dev: React + Express + Postgres + MailHog. `docker compose up --build`.
- `azure/`  — Production variant: Azure AD B2C (MSAL), API Management, Container Apps,
  PostgreSQL Flexible Server (private VNet), Key Vault + Managed Identity,
  Azure Communication Services email, Static Web Apps, plus full Terraform IaC and GitHub Actions CI/CD.
