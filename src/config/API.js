import { NativeModules, Platform } from 'react-native';

const BACKEND_PORT = 8000;
const API_PATH = '/api';

/** Set this for release/production builds. */
const PRODUCTION_BASE_URL = 'https://your-production-api.com/api';

/**
 * Derives the dev machine IP from the Metro bundler URL.
 * When the app loads JS from http://192.168.x.x:8081/..., the backend
 * runs on the same host at port 8000 — no manual ipconfig needed.
 */
function getDevServerHost() {
  const scriptURL = NativeModules.SourceCode?.scriptURL;
  if (!scriptURL) return null;

  const match = scriptURL.match(/^https?:\/\/([^/:]+)/);
  if (!match) return null;

  let host = match[1];

  if (Platform.OS === 'android' && (host === 'localhost' || host === '127.0.0.1')) {
    host = '10.0.2.2';
  }

  return host;
}

function resolveBaseURL() {
  if (!__DEV__) {
    return PRODUCTION_BASE_URL;
  }

  const host = getDevServerHost();
  if (host) {
    return `http://${host}:${BACKEND_PORT}${API_PATH}`;
  }

  return `http://localhost:${BACKEND_PORT}${API_PATH}`;
}

export const BaseURL = resolveBaseURL();

if (__DEV__) {
  console.log('[API] BaseURL:', BaseURL);
}
