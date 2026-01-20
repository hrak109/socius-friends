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
                console.log(`Failed to sync entry ${entry.id}`, error);
                // Keep synced=false/undefined
            }
        }

        if (changed) {
            await saveToStorage(updatedEntries);
            setEntries(updatedEntries);
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

                // Filter out remote entries that might conflict with local unsynced
                const finalEntries = [...remoteEntries, ...unsyncedLocal.filter(e => !remoteMap.has(e.id))];

                // Sort by date/timestamp desc
                finalEntries.sort((a, b) => {
                    if (a.date !== b.date) return b.date.localeCompare(a.date);
                    return b.timestamp - a.timestamp;
                });

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

    const addEntry = useCallback(async (food: string | string[], calories: number) => {
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
        const dateStr = now.toISOString().split('T')[0];
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
            const updated = [newEntry, ...prev];
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
            console.log('Online sync failed, saved locally');
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

    const updateEntry = useCallback(async (id: string, food: string, calories: number) => {
        // Find existing to get metadata
        setEntries(prev => {
            const existing = prev.find(e => e.id === id);
            if (!existing) return prev;

            const updatedEntry = { ...existing, food, calories, synced: false }; // Mark unsynced on edit
            const updatedList = prev.map(e => e.id === id ? updatedEntry : e);
            saveToStorage(updatedList);
            return updatedList;
        });

        try {
            // Fetch current to sync? Or assume we can just post.
            // Ideally we should syncPending logic pick this up.
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
