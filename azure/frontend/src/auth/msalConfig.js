// Azure AD B2C configuration
const tenant = import.meta.env.VITE_B2C_TENANT;         // e.g. vmsuniversity

// NEW (Entra External ID)
export const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_CLIENT_ID,
    authority: `https://${tenant}.ciamlogin.com/`,
    knownAuthorities: [`${tenant}.ciamlogin.com`],
    redirectUri: window.location.origin,
  },
};

export const loginRequest = {
  scopes: [import.meta.env.VITE_API_SCOPE],
};