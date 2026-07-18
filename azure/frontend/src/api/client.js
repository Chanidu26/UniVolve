import axios from 'axios';
import { PublicClientApplication } from '@azure/msal-browser';
import { msalConfig, loginRequest } from '../auth/msalConfig.js';

export const msalInstance = new PublicClientApplication(msalConfig);
await msalInstance.initialize();

// All requests go through Azure API Management, which validates the B2C JWT
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL }); // https://<apim>.azure-api.net/api

api.interceptors.request.use(async (config) => {
  const account = msalInstance.getAllAccounts()[0];
  if (account) {
    const { accessToken } = await msalInstance.acquireTokenSilent({ ...loginRequest, account });
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

export default api;
