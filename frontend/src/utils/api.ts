import axios from 'axios';
import { Platform } from 'react-native';
import { useAuthStore } from '../store/authStore';
import Constants from 'expo-constants';

// Get backend URL - handle different environments with robust fallbacks
const getBackendUrl = (): string => {
  // Debug logging to help diagnose issues
  const logDebug = (source: string, url: string | undefined) => {
    if (__DEV__) {
      console.log(`[API] Backend URL from ${source}:`, url);
    }
  };

  // Priority 1: EXPO_PUBLIC_BACKEND_URL from environment
  const envUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (envUrl && envUrl.trim() !== '') {
    logDebug('EXPO_PUBLIC_BACKEND_URL', envUrl);
    return envUrl.trim();
  }

  // Priority 2: Expo Constants (works in built APK)
  const expoHostname = Constants.expoConfig?.extra?.expoHostname 
    || Constants.manifest?.extra?.expoHostname
    || Constants.manifest2?.extra?.expoClient?.extra?.expoHostname;
  if (expoHostname && expoHostname.trim() !== '') {
    logDebug('expoHostname', expoHostname);
    return expoHostname.trim();
  }

  // Priority 3: Check EXPO_PACKAGER_HOSTNAME for native builds
  const packagerHostname = process.env.EXPO_PACKAGER_HOSTNAME;
  if (packagerHostname && packagerHostname.trim() !== '') {
    logDebug('EXPO_PACKAGER_HOSTNAME', packagerHostname);
    return packagerHostname.trim();
  }

  // Priority 4: For web, use relative path (same origin)
  if (Platform.OS === 'web') {
    logDebug('web-relative', '(empty - same origin)');
    return '';
  }

  // Priority 5: Use linkingUri for development
  const linkingUri = Constants.linkingUri;
  if (linkingUri) {
    try {
      const url = new URL(linkingUri);
      const baseUrl = `${url.protocol}//${url.host}`;
      logDebug('linkingUri', baseUrl);
      return baseUrl;
    } catch (e) {
      // Ignore parsing errors
    }
  }

  // Fallback: Empty string (will fail gracefully)
  console.warn('[API] No backend URL configured - API calls may fail');
  return '';
};

const BACKEND_URL = getBackendUrl();

// Log the final URL on app start
console.log(`[API] Using backend URL: ${BACKEND_URL || '(relative)'}`);

export const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout
});

// Add auth interceptor with logging
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    
    // Debug logging for all requests
    if (__DEV__) {
      console.log(`[API] Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
      console.log(`[API] Token present: ${!!token}`);
    }
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('[API] Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling with logging
api.interceptors.response.use(
  (response) => {
    if (__DEV__) {
      console.log(`[API] Response: ${response.status} from ${response.config.url}`);
    }
    return response;
  },
  (error) => {
    // Handle network errors gracefully
    if (!error.response) {
      console.error('[API] Network error:', error.message);
      console.error('[API] Request URL:', error.config?.url);
      console.error('[API] Base URL:', error.config?.baseURL);
      return Promise.reject(new Error('Network error. Please check your connection.'));
    }
    
    console.error(`[API] Error ${error.response?.status} from ${error.config?.url}:`, error.response?.data);
    
    if (error.response?.status === 401) {
      // Only logout if not on login page
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
      if (!currentPath.includes('login') && !currentPath.includes('auth')) {
        console.log('[API] 401 received, logging out...');
        useAuthStore.getState().logout();
      }
    }
    return Promise.reject(error);
  }
);

export default api;
