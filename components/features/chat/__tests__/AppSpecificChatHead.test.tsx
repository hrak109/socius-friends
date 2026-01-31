import React from 'react';
import { render } from '@testing-library/react-native';
import AppSpecificChatHead from '../AppSpecificChatHead';
import api from '@/services/api';

// Mock dependencies
jest.mock('@/context/ThemeContext', () => ({
    useTheme: () => ({
        colors: {
            background: '#fff',
            text: '#000',
            primary: 'blue',
            card: '#f8f8f8',
            inputBackground: '#eee',
            border: '#ddd',
            textSecondary: '#666',
            buttonText: '#fff'
        }
    }),
}));

jest.mock('@/context/LanguageContext', () => ({
    useLanguage: () => ({ t: (key: string) => key, language: 'en' }),
}));

jest.mock('@/context/NotificationContext', () => ({
    useNotifications: () => ({ lastNotificationTime: null }),
}));

jest.mock('expo-router', () => ({
    useRouter: () => ({ push: jest.fn() }),
    useFocusEffect: (cb: any) => cb(), // Execute immediately
}));

jest.mock('@/services/api', () => ({
    get: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
}));

describe('AppSpecificChatHead', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders and loads friend with unread count', async () => {
        (api.get as jest.Mock).mockResolvedValue({
            data: [{
                id: '123',
                name: 'Jesus',
                avatar: 'jesus.png',
                role: 'christian',
                unread_count: 5
            }]
        });

        const { findByText } = render(
            <AppSpecificChatHead roleType="christian" appContext="bible" />
        );

        const unreadBadge = await findByText('5');
        expect(unreadBadge).toBeTruthy();
    });
});
