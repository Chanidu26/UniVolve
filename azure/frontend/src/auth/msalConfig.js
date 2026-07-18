// Azure AD B2C configuration
const tenant = import.meta.env.VITE_B2C_TENANT;         // e.g. vmsuniversity
const policy = import.meta.env.VITE_B2C_POLICY;         // e.g. B2C_1_signupsignin

export const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_B2C_CLIENT_ID,
    authority: `https://${tenant}.b2clogin.com/${tenant}.onmicrosoft.com/${policy}`,
    knownAuthorities: [`${tenant}.b2clogin.com`],
    redirectUri: window.location.origin,
  },
  cache: { cacheLocation: 'sessionStorage' },
};

export const loginRequest = {
  scopes: [import.meta.env.VITE_API_SCOPE], // e.g. https://<tenant>.onmicrosoft.com/vms-api/access
};
