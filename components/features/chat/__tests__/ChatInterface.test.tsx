import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import ChatInterface from '../ChatInterface';

// Mock dependencies
import { useChat } from '@/hooks/useChat';

// Mock dependencies
jest.mock('@/hooks/useChat', () => ({
    useChat: jest.fn(),
}));

const mockUseChat = useChat as jest.Mock;
mockUseChat.mockReturnValue({
    messages: [],
    text: '',
    setText: jest.fn(),
    onSend: jest.fn(),
    isTyping: false,
    isWaitingForResponse: false,
    currentUser: { _id: 1, name: 'User' },
    botUser: { _id: 2, name: 'Socius' },
});

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

jest.mock('react-native-gifted-chat', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { View } = require('react-native');
    return {
        GiftedChat: (props: any) => (
            <View testID="gifted-chat">
                {props.renderInputToolbar && props.renderInputToolbar(props)}
                {props.renderFooter && props.renderFooter()}
            </View>
        ),
        Avatar: (props: any) => <View testID="avatar" {...props} />,
        Bubble: (props: any) => <View testID="bubble" {...props} />,
    };
});

jest.mock('expo-router', () => ({
    useRouter: () => ({ back: jest.fn() }),
    useFocusEffect: jest.fn(),
    Stack: { Screen: () => null },
}));

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => ({
    SafeAreaView: ({ children }: any) => <>{children}</>,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('ChatInterface', () => {
    it('renders correctly', () => {
        const { toJSON } = render(<ChatInterface />);
        expect(toJSON()).toMatchSnapshot();
    });

    it('allows typing and triggers onSend when send button is pressed', async () => {
        const mockOnSend = jest.fn();
        const mockSetText = jest.fn();

        // Update the mock implementation for this specific test
        mockUseChat.mockReturnValue({
            messages: [],
            text: 'Hello world',
            setText: mockSetText,
            onSend: mockOnSend,
            isTyping: false,
            isWaitingForResponse: false,
            currentUser: { _id: 1, name: 'User' },
            botUser: { _id: 2, name: 'Socius' },
        });

        const { getByPlaceholderText, getByTestId } = render(<ChatInterface />);

        // Verify initial text from mock
        const input = getByPlaceholderText('chat.placeholder');
        expect(input.props.value).toBe('Hello world');

        // Use fireEvent to press the send button
        const sendButton = getByTestId('send-button');

        await act(async () => {
            fireEvent.press(sendButton);
        });

        expect(mockOnSend).toHaveBeenCalledWith(expect.arrayContaining([
            expect.objectContaining({
                text: 'Hello world',
            })
        ]));
    });
});
