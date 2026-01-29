import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import FriendsScreen from '../friends';
import api from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import { ThemeProvider } from '../../context/ThemeContext';
import { LanguageProvider } from '../../context/LanguageContext';
import { NotificationProvider } from '../../context/NotificationContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Alert } from 'react-native';

// Mocks
jest.mock('../../services/api');
jest.mock('expo-router', () => ({
    Stack: { Screen: ({ children }: { children: any }) => null },
    useRouter: () => ({ push: jest.fn() }),
}));

// Mock Alert
jest.spyOn(Alert, 'alert');

jest.mock('expo-notifications', () => ({
    setNotificationHandler: jest.fn(),
    addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
    addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
    getLastNotificationResponseAsync: jest.fn(() => Promise.resolve(null)),
    getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    getExpoPushTokenAsync: jest.fn(() => Promise.resolve({ data: 'mock-token' })),
    AndroidImportance: {
        MAX: 5,
    },
    setNotificationChannelAsync: jest.fn(),
}));

// Helper to wrap component with contexts
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
                    <NotificationProvider>
                        {children}
                    </NotificationProvider>
                </LanguageProvider>
            </ThemeProvider>
        </AuthContext.Provider>
    </SafeAreaProvider>
);

describe('FriendsScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Default mock for friends list
        (api.get as jest.Mock).mockImplementation((url) => {
            if (url === '/friends') {
                return Promise.resolve({
                    data: [
                        { id: 1, friend_id: 101, friend_username: 'test_friend', status: 'accepted' }
                    ]
                });
            }
            if (url === '/friends/requests') {
                return Promise.resolve({ data: [] });
            }
            return Promise.resolve({ data: [] });
        });

        // Mock successful deletes
        (api.delete as jest.Mock).mockResolvedValue({});
    });

    it('should delete conversation history before removing friend', async () => {
        const { findByText, getByTestId } = render(<FriendsScreen />, { wrapper });

        // Wait for friend to load
        await findByText('test_friend');

        // Spy on api.delete
        const deleteSpy = api.delete as jest.Mock;

        // Press delete button
        fireEvent.press(getByTestId('delete-friend-btn'));

        // Check if Alert is shown
        expect(Alert.alert).toHaveBeenCalled();

        // Extract the confirm button and press it
        const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
        const confirmButton = buttons.find((b: any) => b.style === 'destructive');

        await act(async () => {
            await confirmButton.onPress();
        });

        // Verify delete calls order
        // 1. Delete messages
        expect(deleteSpy).toHaveBeenNthCalledWith(1, '/messages/user/101');
        // 2. Delete friend
        expect(deleteSpy).toHaveBeenNthCalledWith(2, '/friends/101');
    });
});
