import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

export type PasswordAccount = {
    id: string;
    service: string;
    username: string;
    password: string;
    group: string;
    updated_at: number;
    synced?: boolean;
};

const STORAGE_KEY = 'user_passwords';

export function usePasswords() {
    const [accounts, setAccounts] = useState<PasswordAccount[]>([]);
    const [loading, setLoading] = useState(true);

    const syncPending = useCallback(async (localAccounts: PasswordAccount[]) => {
        const pending = localAccounts.filter(a => !a.synced);
        if (pending.length === 0) return localAccounts;

        let updated = [...localAccounts];
        let changed = false;

        for (const acc of pending) {
            try {
                await api.post('/passwords', {
                    client_id: acc.id,
                    service: acc.service,
                    username: acc.username,
                    password: acc.password,
                    group: acc.group,
                    updated_at: acc.updated_at
                });
                updated = updated.map(a => a.id === acc.id ? { ...a, synced: true } : a);
                changed = true;
            } catch (e) {

            }
        }

        if (changed) {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            setAccounts(updated);
        }
        return updated;
    }, []);

    const fetchRemote = useCallback(async (currentLocal: PasswordAccount[]) => {
        try {
            const res = await api.get('/passwords');
            if (Array.isArray(res.data)) {
                const remoteMap = new Map();
                res.data.forEach((a: any) => {
                    remoteMap.set(a.client_id, {
                        id: a.client_id,
                        service: a.service,
                        username: a.username,
                        password: a.password,
                        group: a.group,
                        updated_at: a.updated_at,
                        synced: true
                    });
                });

                const unsyncedLocal = currentLocal.filter(a => !a.synced);
                const remoteAccounts = Array.from(remoteMap.values());
                const finalAccounts = [...remoteAccounts, ...unsyncedLocal.filter(a => !remoteMap.has(a.id))];

                setAccounts(finalAccounts);
                await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(finalAccounts));
            }
        } catch (error) {
            console.error('Failed to load passwords remote', error);
        }
    }, []);

    const loadAccounts = useCallback(async () => {
        try {
            const saved = await AsyncStorage.getItem(STORAGE_KEY);
            let localData: PasswordAccount[] = [];
            if (saved) {
                localData = JSON.parse(saved);
                setAccounts(localData);
            }

            // Sync Pending
            const syncedData = await syncPending(localData);

            // Fetch Remote
            await fetchRemote(syncedData);

        } catch (error) {
            console.error('Failed to load passwords', error);
        } finally {
            setLoading(false);
        }
    }, [syncPending, fetchRemote]);

    useEffect(() => {
        loadAccounts();
    }, [loadAccounts]);

    const saveAccount = useCallback(async (accountData: Omit<PasswordAccount, 'id' | 'synced' | 'updated_at'>, id?: string) => {
        const now = Date.now();

        let newOrUpdatedAccount: PasswordAccount;

        setAccounts(prev => {
            let updatedAccounts = [...prev];

            if (id) {
                // Update
                updatedAccounts = updatedAccounts.map(acc =>
                    acc.id === id
                        ? { ...acc, ...accountData, updated_at: now, synced: false }
                        : acc
                );
                newOrUpdatedAccount = updatedAccounts.find(a => a.id === id)!;
            } else {
                // Create
                const clientId = `${now}-${Math.floor(Math.random() * 10000)}`;
                const newAccount: PasswordAccount = {
                    id: clientId,
                    ...accountData,
                    updated_at: now,
                    synced: false
                };
                updatedAccounts.push(newAccount);
                newOrUpdatedAccount = newAccount;
            }

            AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedAccounts));
            return updatedAccounts;
        });

        // Background Sync
        try {
            // Wait a tick or just use the obj we constructed
            // Since we don't have newOrUpdatedAccount in scope if we relied on setAccounts callback for creation
            // We reconstructed logic above to capture it.

            // Re-find from closure isn't quite right because of setAccounts async nature? 
            // Actually standard React batching. But we can just use the object we created.

            // Let's rely on constructing it outside setAccounts to be safe or capturing it.
            // I did capture it in newOrUpdatedAccount variable above (simplified logic).

            // Wait, I can't assign to outer variable from inside setState updater synchronously and expect it to be available outside immediately if I wrap it all.
            // But here I'm setting state AND finding/creating.
            // Let's do it cleaner.
            return; // Placeholder for logic below
        } catch (e) { }
    }, []);

    // Proper implementation of saveAccount to handle async state safely
    const saveAccountItem = useCallback(async (accountData: Omit<PasswordAccount, 'id' | 'synced' | 'updated_at'>, id?: string) => {
        const now = Date.now();
        let targetAccount: PasswordAccount;

        // 1. Determine the new state object
        if (id) {
            // We need current state. 
            // Ideally we pass function to setAccounts, but we need the object for API call too.
            // So we'll use a functional update and "tap" into it, OR read ref? 
            // Or just do best effort.
            // Better: construct it based on what we know (we have the ID).
            // But we need the old data if we are doing partial updates? 
            // The signature accepts full data.

            targetAccount = {
                id,
                ...accountData,
                updated_at: now,
                synced: false
            } as PasswordAccount;
            // Note: If accountData is partial, this casts invalidly. But our usage passes full data.
        } else {
            const clientId = `${now}-${Math.floor(Math.random() * 10000)}`;
            targetAccount = {
                id: clientId,
                ...accountData,
                updated_at: now,
                synced: false
            };
        }

        // 2. Update Local
        setAccounts(prev => {
            let updated;
            if (id) {
                updated = prev.map(a => a.id === id ? targetAccount : a);
            } else {
                updated = [...prev, targetAccount];
            }
            AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            return updated;
        });

        // 3. Sync Online
        try {
            await api.post('/passwords', {
                client_id: targetAccount.id,
                service: targetAccount.service,
                username: targetAccount.username,
                password: targetAccount.password,
                group: targetAccount.group,
                updated_at: targetAccount.updated_at
            });

            // Mark Synced
            setAccounts(prev => {
                const verified = prev.map(a => a.id === targetAccount.id ? { ...a, synced: true } : a);
                AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(verified));
                return verified;
            });
            return true;
        } catch (e) {
            console.error('Failed to save password online', e);
            return false;
        }
    }, []);

    const deleteAccount = useCallback(async (id: string) => {
        setAccounts(prev => {
            const updated = prev.filter(a => a.id !== id);
            AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            return updated;
        });

        try {
            await api.delete(`/passwords/${id}`);
        } catch (e) {
            console.error('Failed to delete password online', e);
        }
    }, []);

    return {
        accounts,
        loading,
        saveAccount: saveAccountItem,
        deleteAccount,
        refresh: loadAccounts
    };
}
