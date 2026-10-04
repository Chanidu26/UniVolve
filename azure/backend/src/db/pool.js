const { Pool } = require('pg');
const { DefaultAzureCredential } = require('@azure/identity');
const { SecretClient } = require('@azure/keyvault-secrets');

let pool;


async function getDbPassword() {
  if (process.env.DB_PASSWORD) return process.env.DB_PASSWORD;
  const credential = new DefaultAzureCredential();
  const client = new SecretClient(process.env.KEY_VAULT_URI, credential);
  const secret = await client.getSecret('db-password');
  return secret.value;
}

async function initializeSchema() {
  try {
    const credential = new DefaultAzureCredential();
    const client = new SecretClient(process.env.KEY_VAULT_URI, credential);
    
    const schemaSecret = await client.getSecret('db-schema');
    const schema = schemaSecret.value;
    
    // The schema is idempotent and also contains additive migrations for existing databases.
    console.log('📊 Applying database schema and migrations...');
    await pool.query(schema);
    console.log('✅ Schema and migrations applied successfully');
  } catch (e) {
    console.error('❌ Schema initialization failed:', e.message);
    throw e;
  }
}

const poolPromise = (async () => {
  const password = await getDbPassword();
  pool = new Pool({
    host: process.env.DB_HOST,
    port: 5432,
    user: process.env.DB_USER,
    password,
    database: process.env.DB_NAME || 'vmsdb',
    ssl: { rejectUnauthorized: false },
    max: 10,
  });
  return pool;
})();

module.exports = {
  query: async (...args) => (await poolPromise).query(...args),
  connect: async () => (await poolPromise).connect(),
  initializeSchema,  // Export for server.js
};