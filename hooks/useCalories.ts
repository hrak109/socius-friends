import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type CalorieEntry = {
    id: string;
    food: string;
    calories: number;
    date: string; // YYYY-MM-DD
    timestamp: number;
};

const STORAGE_KEY = 'calories_entries';

export function useCalories() {
    const [entries, setEntries] = useState<CalorieEntry[]>([]);
    const [loading, setLoading] = useState(true);

    const loadEntries = useCallback(async () => {
        try {
            const saved = await AsyncStorage.getItem(STORAGE_KEY);
            if (saved) {
                setEntries(JSON.parse(saved));
            }
        } catch (error) {
            console.error('Failed to load calories', error);
        } finally {
            setLoading(false);
        }
    }, []);

    // Load on mount
    useEffect(() => {
        loadEntries();
    }, [loadEntries]);

    const addEntry = useCallback(async (food: string, calories: number) => {
        try {
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];

            const newEntry: CalorieEntry = {
                id: Date.now().toString(),
                food: food.trim(),
                calories,
                date: dateStr,
                timestamp: now.getTime(),
            };

            const updated = [newEntry, ...entries];
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            setEntries(updated);
            return newEntry;
        } catch (error) {
            console.error('Failed to add calorie entry', error);
            throw error;
        }
    }, [entries]);

    const deleteEntry = useCallback(async (id: string) => {
        try {
            const updated = entries.filter(e => e.id !== id);
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            setEntries(updated);
        } catch (error) {
            console.error('Failed to delete calorie entry', error);
            throw error;
        }
    }, [entries]);

    return {
        entries,
        loading,
        addEntry,
        deleteEntry,
        refresh: loadEntries
    };
}
