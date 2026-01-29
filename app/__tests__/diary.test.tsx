import React from 'react';
import { render } from '@testing-library/react-native';
import DiaryScreen from '../diary';
import api from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import { ThemeProvider } from '../../context/ThemeContext';
import { LanguageProvider } from '../../context/LanguageContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Mocks
jest.mock('../../services/api');
jest.mock('expo-router', () => ({
    Stack: { Screen: ({ children }: { children: any }) => null },
    useRouter: () => ({ push: jest.fn() }),
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
                    {children}
                </LanguageProvider>
            </ThemeProvider>
        </AuthContext.Provider>
    </SafeAreaProvider>
);

describe('DiaryScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should render entries fetched from api', async () => {
        const mockEntries = [
            { id: '1', date: '2024-01-01', content: 'Dear Diary...', title: 'My First Entry', created_at: '2024-01-01' }
        ];
        (api.get as jest.Mock).mockResolvedValue({ data: mockEntries });

        const { getByText, findByText } = render(<DiaryScreen />, { wrapper });

        // Checks title from mock
        await findByText('My First Entry');
        expect(getByText('Dear Diary...')).toBeTruthy();
    });

    it('should show filtered empty state', async () => {
        (api.get as jest.Mock).mockResolvedValue({ data: [] });
        const { findByText } = render(<DiaryScreen />, { wrapper });
        await findByText('No entries yet. Start writing!');
    });
});
