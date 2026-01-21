import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../constants/env';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 300000, // 5 minutes
});

api.interceptors.request.use(
    async (config) => {
        const token = await SecureStore.getItemAsync('session_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Prevent infinite loops
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const refreshToken = await SecureStore.getItemAsync('refresh_token');
                if (refreshToken) {
                    // Use a fresh axios instance to avoid interceptors
                    const response = await axios.post(`${API_URL}/auth/refresh`, { refresh_token: refreshToken });

                    const { access_token, refresh_token: newRefreshToken } = response.data;

                    await SecureStore.setItemAsync('session_token', access_token);
                    if (newRefreshToken) {
                        await SecureStore.setItemAsync('refresh_token', newRefreshToken);
                    }

                    api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
                    originalRequest.headers['Authorization'] = `Bearer ${access_token}`;

                    return api(originalRequest);
                }
            } catch (refreshError) {

                // Fall through to return original error (which triggers logout)
            }
        }
        return Promise.reject(error);
    }
);


export const uploadAvatar = async (uri: string) => {
    const formData = new FormData();
    const filename = uri.split('/').pop();
    const match = /\.(\w+)$/.exec(filename || '');
    const type = match ? `image/${match[1]}` : 'image/jpeg';

    formData.append('file', { uri, name: filename, type } as any);

    const response = await api.post('/users/me/avatar', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
};

export const deleteAvatar = async () => {
    const response = await api.delete('/users/me/avatar');
    return response.data;
};

export default api;
