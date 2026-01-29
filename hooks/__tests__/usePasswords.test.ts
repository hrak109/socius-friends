import { renderHook, act, waitFor } from '@testing-library/react-native';
import { usePasswords } from '../usePasswords';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/services/api';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
}));

jest.mock('@/services/api', () => ({
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
}));

describe('usePasswords hook', () => {
    const mockAccounts = [
        { id: '1', service: 'Test', username: 'user', password: 'pass', group: 'work', updated_at: Date.now(), synced: true }
    ];

    beforeEach(() => {
        jest.clearAllMocks();
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
        (api.get as jest.Mock).mockResolvedValue({ data: [] });
    });

    it('initializes with empty accounts and loading true', async () => {
        const { result } = renderHook(() => usePasswords());

        // Initial state before effects run
        expect(result.current.accounts).toEqual([]);
        expect(result.current.loading).toBe(true);
    });

    it('loads accounts from AsyncStorage on mount', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockAccounts));
        (api.get as jest.Mock).mockResolvedValue({
            data: mockAccounts.map(a => ({
                client_id: a.id,
                ...a
            }))
        });

        const { result } = renderHook(() => usePasswords());

        await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 2000 });

        expect(result.current.accounts).toEqual(mockAccounts);
    });

    it('syncs pending accounts on load', async () => {
        const unsyncedAccounts = [{ ...mockAccounts[0], synced: false }];
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(unsyncedAccounts));
        (api.post as jest.Mock).mockResolvedValue({ success: true });

        const { result } = renderHook(() => usePasswords());

        await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 2000 });

        expect(api.post).toHaveBeenCalledWith('/passwords', expect.objectContaining({
            client_id: '1',
            service: 'Test'
        }));
    });

    it('saves a new account locally and syncs to API', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([]));

        const { result } = renderHook(() => usePasswords());
        await waitFor(() => expect(result.current.loading).toBe(false));

        const newAccountData = {
            service: 'Google',
            username: 'user@gmail.com',
            password: 'secretpassword',
            group: 'personal'
        };

        await act(async () => {
            await result.current.saveAccount(newAccountData);
        });

        await waitFor(() => expect(result.current.accounts.length).toBe(1));
        expect(result.current.accounts[0].service).toBe('Google');
        expect(api.post).toHaveBeenCalledWith('/passwords', expect.objectContaining({
            service: 'Google'
        }));
    });

    it('deletes an account locally and from API', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockAccounts));

        const { result } = renderHook(() => usePasswords());
        await waitFor(() => expect(result.current.loading).toBe(false));

        await act(async () => {
            await result.current.deleteAccount('1');
        });

        expect(result.current.accounts).toEqual([]);
        expect(api.delete).toHaveBeenCalledWith('/passwords/1');
    });
});
