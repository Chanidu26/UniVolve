import { PublicClientApplication } from '@azure/msal-browser';

// Entra External ID configuration
const tenant = import.meta.env.VITE_B2C_TENANT;         // e.g. vmsuniversity

export const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_CLIENT_ID,
    authority: `https://${tenant}.ciamlogin.com/`,
    knownAuthorities: [`${tenant}.ciamlogin.com`],
    redirectUri: window.location.origin,
  },
  cache: { cacheLocation: 'sessionStorage' },
  
};

export const loginRequest = {
  scopes: [import.meta.env.VITE_API_SCOPE],
};

export const msalInstance = new PublicClientApplication(msalConfig);

msalInstance.addEventCallback((event) => {
  if ((event.eventType === 'msal:loginSuccess' || event.eventType === 'msal:acquireTokenSuccess') && event.payload.account) {
    msalInstance.setActiveAccount(event.payload.account);
  }
});
