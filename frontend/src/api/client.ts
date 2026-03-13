// frontend/src/api/client.ts

import axios from 'axios';

const getBaseUrl = () => {
  if (window.location.port === '5173') {
    return '/api/v2';
  }
  
  let path = window.location.pathname.replace(/[^/]*$/, '');
  
  if (!path.endsWith('/')) {
    path += '/';
  }
  
  return path + 'api/v2';
};

export const apiClient = axios.create({
  baseURL: getBaseUrl(),
});