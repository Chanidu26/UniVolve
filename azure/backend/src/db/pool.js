const { Pool } = require('pg');
const { DefaultAzureCredential } = require('@azure/identity');
const { SecretClient } = require('@azure/keyvault-secrets');

let pool;

async function getDbPassword() {
  if (process.env.DB_PASSWORD) return process.env.DB_PASSWORD; // Container Apps secretRef path
  // Fallback: read directly from Key Vault using Managed Identity
  const credential = new DefaultAzureCredential();
  const client = new SecretClient(process.env.KEY_VAULT_URI, credential);
  const secret = await client.getSecret('db-password');
  return secret.value;
}

const poolPromise = (async () => {
  const password = await getDbPassword();
  pool = new Pool({
    host: process.env.DB_HOST,                 // <name>.postgres.database.azure.com (private)
    port: 5432,
    user: process.env.DB_USER,
    password,
    database: process.env.DB_NAME || 'vmsdb',
    ssl: { rejectUnauthorized: false },        // Azure PG Flexible Server requires SSL
    max: 10,
  });
  return pool;
})();

module.exports = {
  query: async (...args) => (await poolPromise).query(...args),
  connect: async () => (await poolPromise).connect(),
};
