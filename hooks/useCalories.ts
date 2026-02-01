import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

export type CalorieEntry = {
    id: string; // client_id
    food: string;
    calories: number;
    date: string; // YYYY-MM-DD
    timestamp: number;
    synced?: boolean; // New flag for offline sync
};

const STORAGE_KEY = 'calories_entries';

// Helper: sort entries by date desc, then timestamp desc
const sortEntries = (entries: CalorieEntry[]): CalorieEntry[] =>
    [...entries].sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return b.timestamp - a.timestamp;
    });

export function useCalories() {
    const [entries, setEntries] = useState<CalorieEntry[]>([]);
    const [loading, setLoading] = useState(true);

    // Helper to save to storage
    const saveToStorage = async (data: CalorieEntry[]) => {
        try {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.error('Failed to save to storage', e);
        }
    };

    const syncPending = useCallback(async (currentEntries: CalorieEntry[]) => {
        const pending = currentEntries.filter(e => !e.synced);
        if (pending.length === 0) return currentEntries;

        let updatedEntries = [...currentEntries];
        let changed = false;

        for (const entry of pending) {
            try {
                // Check if it already exists on server (idempotency handled by backend check on client_id)
                await api.post('/calories', {
                    client_id: entry.id,
                    food: entry.food,
                    calories: entry.calories,
                    date: entry.date,
                    timestamp: entry.timestamp
                });

                // Mark as synced
                updatedEntries = updatedEntries.map(e =>
                    e.id === entry.id ? { ...e, synced: true } : e
                );
                changed = true;
            } catch (error) {

                // Keep synced=false/undefined
            }
        }

        if (changed) {
            const sorted = sortEntries(updatedEntries);
            await saveToStorage(sorted);
            setEntries(sorted);
        }
        return updatedEntries;
    }, []);

    const fetchRemote = useCallback(async (currentLocal: CalorieEntry[]) => {
        try {
            const res = await api.get('/calories');
            if (Array.isArray(res.data)) {
                const remoteMap = new Map();
                res.data.forEach((item: any) => {
                    remoteMap.set(item.client_id, {
                        id: item.client_id,
                        food: item.food,
                        calories: item.calories,
                        date: item.date,
                        timestamp: item.timestamp,
                        synced: true
                    });
                });

                // Merge strategy:
                // 1. Keep local unsynced items (they are newer or not uploaded yet)
                // 2. Use remote items for everything else (source of truth)

                const unsyncedLocal = currentLocal.filter(e => !e.synced);

                // Convert map values to array
                const remoteEntries = Array.from(remoteMap.values());

                // Sort by date/timestamp desc
                const finalEntries = sortEntries([...remoteEntries, ...unsyncedLocal.filter(e => !remoteMap.has(e.id))]);


                setEntries(finalEntries);
                await saveToStorage(finalEntries);
            }
        } catch (error) {
            console.error('Failed to fetch remote calories', error);
        }
    }, []);

    const loadEntries = useCallback(async () => {
        try {
            const saved = await AsyncStorage.getItem(STORAGE_KEY);
            let localData: CalorieEntry[] = [];
            if (saved) {
                localData = JSON.parse(saved);
                setEntries(localData);
            }

            // 1. Try to sync pending items first
            const syncedData = await syncPending(localData);

            // 2. Then fetch latest from server
            await fetchRemote(syncedData);

        } catch (error) {
            console.error('Failed to load calories', error);
        } finally {
            setLoading(false);
        }
    }, [syncPending, fetchRemote]);

    // Load on mount
    useEffect(() => {
        loadEntries();
    }, [loadEntries]);

    const addEntry = useCallback(async (food: string | string[], calories: number, date?: string) => {
        // Guard against undefined/null food, and handle arrays
        let safeFoodName: string;
        if (Array.isArray(food)) {
            safeFoodName = food.join(', ').trim() || 'Unknown Food';
        } else if (typeof food === 'string') {
            safeFoodName = food.trim() || 'Unknown Food';
        } else {
            safeFoodName = 'Unknown Food';
        }

        const now = new Date();
        // Use local date format (YYYY-MM-DD) to avoid timezone offset issues
        const dateStr = date || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const timestamp = now.getTime();
        const clientId = `${timestamp}-${Math.floor(Math.random() * 10000)}`;

        const newEntry: CalorieEntry = {
            id: clientId,
            food: safeFoodName,
            calories,
            date: dateStr,
            timestamp: timestamp,
            synced: false
        };

        // Optimistic Save Local
        setEntries(prev => {
            const updated = sortEntries([newEntry, ...prev]);
            saveToStorage(updated);
            return updated;
        });

        // Background Sync attempt
        try {
            await api.post('/calories', {
                client_id: clientId,
                food: safeFoodName,
                calories,
                date: dateStr,
                timestamp
            });

            // If success, mark synced
            setEntries(prev => {
                const updated = prev.map(e => e.id === clientId ? { ...e, synced: true } : e);
                saveToStorage(updated);
                return updated;
            });
        } catch (error) {

            // Remains synced: false
        }

        return newEntry;
    }, []);

    const deleteEntry = useCallback(async (id: string) => {
        // Optimistic delete
        setEntries(prev => {
            const updated = prev.filter(e => e.id !== id);
            saveToStorage(updated);
            return updated;
        });

        try {
            await api.delete(`/calories/${id}`);
        } catch (error) {
            console.error('Failed to delete calorie entry online', error);
        }
    }, []);

    const updateEntry = useCallback(async (id: string, food: string, calories: number, date?: string) => {
        // Find existing to get metadata
        let existingEntry: CalorieEntry | undefined;

        setEntries(prev => {
            existingEntry = prev.find(e => e.id === id);
            if (!existingEntry) return prev;

            const updatedEntry: CalorieEntry = {
                ...existingEntry,
                food,
                calories,
                date: date || existingEntry.date,
                synced: false
            };
            const updatedList = sortEntries(prev.map(e => e.id === id ? updatedEntry : e));
            saveToStorage(updatedList);
            return updatedList;
        });

        try {
            // Call API to update the entry
            await api.put(`/calories/${id}`, {
                food,
                calories,
                date: date || existingEntry?.date
            });

            // Mark as synced on success
            setEntries(prev => {
                const updated = prev.map(e => e.id === id ? { ...e, synced: true } : e);
                saveToStorage(updated);
                return updated;
            });
        } catch (error) {
            console.error('Failed to update calorie entry online', error);
        }
    }, []);

    return {
        entries,
        loading,
        addEntry,
        updateEntry,
        deleteEntry,
        refresh: loadEntries
    };
}
