import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import GlobalAppShortcut from '../GlobalAppShortcut';
import { useSegments } from 'expo-router';

// Mock dependencies
jest.mock('@/context/ThemeContext', () => ({
    useTheme: () => ({
        colors: {
            background: '#fff',
            text: '#000',
            primary: '#007AFF',
            card: '#fff',
            border: '#ddd',
        },
        isDark: false
    }),
}));

jest.mock('@/context/LanguageContext', () => ({
    useLanguage: () => ({ t: (key: string) => key, language: 'en' }),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
    useRouter: () => ({ push: mockPush }),
    useSegments: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-blur', () => ({
    BlurView: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('GlobalAppShortcut', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('hides on onboarding screen', async () => {
        (useSegments as jest.Mock).mockReturnValue(['onboarding']);
        const { queryByTestId } = render(<GlobalAppShortcut />);
        // Wait a bit to ensure useEffect runs
        await waitFor(() => {
            expect(queryByTestId('shortcut-bubble')).toBeNull();
        });
    });

    it('shows on chat screen', async () => {
        (useSegments as jest.Mock).mockReturnValue(['chat', '123']);
        const { getByTestId } = render(<GlobalAppShortcut />);
        await waitFor(() => {
            expect(getByTestId('shortcut-bubble')).toBeTruthy();
        });
    });

    it('shows on messages screen', async () => {
        (useSegments as jest.Mock).mockReturnValue(['messages']);
        const { getByTestId } = render(<GlobalAppShortcut />);
        await waitFor(() => {
            expect(getByTestId('shortcut-bubble')).toBeTruthy();
        });
    });
});
