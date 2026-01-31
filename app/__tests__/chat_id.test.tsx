import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import ChatScreen from '../chat/[id]';
import api from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import { ThemeProvider } from '../../context/ThemeContext';
import { LanguageProvider } from '../../context/LanguageContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NotificationContext } from '../../context/NotificationContext';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

// Mocks
jest.mock('../../services/api');
jest.mock('expo-router', () => ({
    useFocusEffect: jest.fn((cb) => cb()),
    useLocalSearchParams: jest.fn(),
    useRouter: jest.fn(() => ({ push: jest.fn(), replace: jest.fn() })),
    Stack: { Screen: () => null },
    useSegments: jest.fn(() => ['chat', '1']),
}));

jest.mock('react-native-gifted-chat', () => {
    const MockGiftedChat = (props: any) => <View testID="gifted-chat" />;
    MockGiftedChat.displayName = 'GiftedChat';

    const MockAvatar = (props: any) => <View testID="avatar" />;
    MockAvatar.displayName = 'Avatar';

    const MockBubble = (props: any) => <View testID="bubble" />;
    MockBubble.displayName = 'Bubble';

    return {
        GiftedChat: MockGiftedChat,
        Avatar: MockAvatar,
        Bubble: MockBubble,
    };
});

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
            user: { id: '1', name: 'Test User' } as any,
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

describe('ChatScreen Metadata Fetching', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should fetch companion metadata if missing from params', async () => {
        (useLocalSearchParams as jest.Mock).mockReturnValue({
            id: 'socius-1',
            type: 'socius',
            name: '',
            avatar: '',
            sociusRole: ''
        });

        (api.get as jest.Mock).mockImplementation((url) => {
            if (url === '/friends/socius') {
                return Promise.resolve({ data: [{ id: 1, name: 'AI Companion', avatar: 'avatar-1', role: 'friend' }] });
            }
            return Promise.resolve({ data: [] });
        });

        render(<ChatScreen />, { wrapper });

        await waitFor(() => {
            expect(api.get).toHaveBeenCalledWith('/friends/socius');
        });
    });

    it('should fetch user metadata if missing from params', async () => {
        (useLocalSearchParams as jest.Mock).mockReturnValue({
            id: 'user-2',
            type: 'user',
            name: '',
            avatar: ''
        });

        (api.get as jest.Mock).mockImplementation((url) => {
            if (url === '/friends') {
                return Promise.resolve({ data: [{ friend_id: 2, friend_username: 'Test User', friend_avatar: 'user-avatar' }] });
            }
            return Promise.resolve({ data: [] });
        });

        render(<ChatScreen />, { wrapper });

        await waitFor(() => {
            expect(api.get).toHaveBeenCalledWith('/friends');
        });
    });
});
