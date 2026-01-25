import axios from 'axios';
import { Platform } from 'react-native';
import { useAuthStore } from '../store/authStore';
import Constants from 'expo-constants';

// Get backend URL - handle different environments
const getBackendUrl = (): string => {
  // For deployed app, use the environment variable or relative URL
  const envUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  
  if (envUrl) {
    return envUrl;
  }
  
  // For web, use relative path (same origin)
  if (Platform.OS === 'web') {
    return '';
  }
  
  // For native apps, try to get from expo config
  const expoUrl = Constants.expoConfig?.extra?.backendUrl;
  if (expoUrl) {
    return expoUrl;
  }
  
  return '';
};

const BACKEND_URL = getBackendUrl();

export const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout
});

// Add auth interceptor
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle network errors gracefully
    if (!error.response) {
      console.error('Network error:', error.message);
      return Promise.reject(new Error('Network error. Please check your connection.'));
    }
    
    if (error.response?.status === 401) {
      // Only logout if not on login page
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
      if (!currentPath.includes('login')) {
        useAuthStore.getState().logout();
      }
    }
    return Promise.reject(error);
  }
);

export default api;
