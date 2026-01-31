import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import MessagesScreen from '../messages';
import api from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import { ThemeProvider } from '../../context/ThemeContext';
import { LanguageProvider } from '../../context/LanguageContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NotificationContext } from '../../context/NotificationContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mocks
jest.mock('../../services/api');
jest.mock('expo-router', () => ({
    useFocusEffect: jest.fn((cb) => cb()),
    useRouter: () => ({ push: jest.fn() }),
    useSegments: () => ['messages'],
    Stack: { Screen: () => null },
}));

const mockNotificationValue = {
    unreadCount: 0,
    sociusUnreadCount: 0,
    unreadDirectMessages: 0,
    friendRequests: 0,
    lastNotificationTime: null,
    lastMessage: null,
    lastDM: null,
    refreshNotifications: jest.fn(),
    setRouteSegments: jest.fn(),
    typingThreads: new Set(),
    setTyping: jest.fn(),
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <SafeAreaProvider initialMetrics={{
        frame: { x: 0, y: 0, width: 0, height: 0 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
    }}>
        <AuthContext.Provider value={{
            session: 'token',
            isLoading: false,
            user: null,
            signIn: jest.fn(),
            signOut: jest.fn()
        }}>
            <ThemeProvider>
                <LanguageProvider>
                    <NotificationContext.Provider value={mockNotificationValue as any}>
                        {children}
                    </NotificationContext.Provider>
                </LanguageProvider>
            </ThemeProvider>
        </AuthContext.Provider>
    </SafeAreaProvider>
);

describe('MessagesScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    });

    it('renders message list', async () => {
        (api.get as jest.Mock).mockImplementation((url) => {
            if (url === '/messages/recent') {
                return Promise.resolve({ data: [{ id: 1, friend_id: 2, friend_username: 'Thread 1', content: 'Hello', timestamp: Date.now() / 1000 }] });
            }
            if (url === '/friends/socius') {
                return Promise.resolve({ data: [] });
            }
            return Promise.resolve({ data: [] });
        });

        const { findByText } = render(<MessagesScreen />, { wrapper });

        await waitFor(() => {
            return findByText('Thread 1');
        }, { timeout: 3000 });
    });

    it('shows empty state', async () => {
        (api.get as jest.Mock).mockResolvedValue({ data: [] });
        const { findByText } = render(<MessagesScreen />, { wrapper });
        await findByText(/No messages yet/i);
    });
});
