import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export interface PhysicalStats {
    weight: number; // kg
    height: number; // cm
    age: number;
    gender: 'male' | 'female';
    activityLevel: ActivityLevel;
}

export interface Activity {
    id: string;
    name: string;
    duration: number; // minutes
    calories: number;
    date: string; // ISO date string YYYY-MM-DD
    timestamp: number; // for sorting
    synced?: boolean;
}

const STATS_KEY = 'user_physical_stats';
const ACTIVITIES_KEY = 'workout_activities';

export function useWorkouts() {
    const [stats, setStats] = useState<PhysicalStats | null>(null);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);

    const syncPending = useCallback(async (localActivities: Activity[]) => {
        const pending = localActivities.filter(a => !a.synced);
        if (pending.length === 0) return localActivities;

        let updated = [...localActivities];
        let changed = false;

        for (const act of pending) {
            try {
                await api.post('/workouts/activities', {
                    client_id: act.id,
                    name: act.name,
                    duration: act.duration,
                    calories: act.calories,
                    date: act.date,
                    timestamp: act.timestamp
                });
                updated = updated.map(a => a.id === act.id ? { ...a, synced: true } : a);
                changed = true;
            } catch (e) {

            }
        }

        if (changed) {
            await AsyncStorage.setItem(ACTIVITIES_KEY, JSON.stringify(updated));
            setActivities(updated);
        }
        return updated;
    }, []);

    const fetchRemote = useCallback(async (currentLocalActs: Activity[]) => {
        // Stats
        try {
            const statsRes = await api.get('/workouts/stats');
            const mappedStats: PhysicalStats = {
                weight: statsRes.data.weight,
                height: statsRes.data.height,
                age: statsRes.data.age,
                gender: statsRes.data.gender,
                activityLevel: statsRes.data.activity_level
            };
            setStats(mappedStats);
            await AsyncStorage.setItem(STATS_KEY, JSON.stringify(mappedStats));
        } catch (e) { /* ignore */ }

        // Activities
        try {
            const actRes = await api.get('/workouts/activities');
            if (Array.isArray(actRes.data)) {
                const remoteMap = new Map();
                actRes.data.forEach((a: any) => {
                    remoteMap.set(a.client_id, {
                        id: a.client_id,
                        name: a.name,
                        duration: a.duration,
                        calories: a.calories,
                        date: a.date,
                        timestamp: a.timestamp,
                        synced: true
                    });
                });

                const remoteActs = Array.from(remoteMap.values());

                setActivities(prev => {
                    // Keep local unsynced acts that aren't in remote yet
                    const unsyncedLocal = prev.filter(a => !a.synced);
                    const finalActs = [...remoteActs, ...unsyncedLocal.filter(a => !remoteMap.has(a.id))];
                    finalActs.sort((a, b) => b.timestamp - a.timestamp);
                    AsyncStorage.setItem(ACTIVITIES_KEY, JSON.stringify(finalActs));
                    return finalActs;
                });
            }
        } catch (e) { /* ignore */ }
    }, []);

    const loadData = useCallback(async () => {
        try {
            const savedStats = await AsyncStorage.getItem(STATS_KEY);
            const savedActivities = await AsyncStorage.getItem(ACTIVITIES_KEY);

            // 1. Load Local
            if (savedStats) {
                setStats(JSON.parse(savedStats));
            }

            let localActs: Activity[] = [];
            if (savedActivities) {
                localActs = JSON.parse(savedActivities);
                setActivities(localActs);
            }

            // 2. Sync Pending
            const syncedActs = await syncPending(localActs);

            // 3. Fetch Remote
            await fetchRemote(syncedActs);

        } catch (error) {
            console.error('Failed to load workout data', error);
        } finally {
            setLoading(false);
        }
    }, [syncPending, fetchRemote]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const saveStats = useCallback(async (newStats: PhysicalStats) => {
        setStats(newStats);
        await AsyncStorage.setItem(STATS_KEY, JSON.stringify(newStats));

        try {
            await api.post('/workouts/stats', {
                weight: newStats.weight,
                height: newStats.height,
                age: newStats.age,
                gender: newStats.gender,
                activity_level: newStats.activityLevel
            });
        } catch (e) {
            console.error('Failed to sync physical stats', e);
        }
    }, []);



    // Redefining addActivity to match typical use case better
    const addActivityItem = useCallback(async (name: string, duration: number, calories: number, date?: string) => {
        const timestamp = Date.now();
        const clientId = `${timestamp}-${Math.floor(Math.random() * 10000)}`;
        // Use provided date or today
        const dateStr = date || new Date().toISOString().split('T')[0];

        const newActivity: Activity = {
            id: clientId,
            name,
            duration,
            calories,
            date: dateStr,
            timestamp,
            synced: false
        };

        setActivities(prev => {
            const updated = [newActivity, ...prev];
            AsyncStorage.setItem(ACTIVITIES_KEY, JSON.stringify(updated));
            return updated;
        });

        try {
            await api.post('/workouts/activities', {
                client_id: clientId,
                name,
                duration,
                calories,
                date: dateStr,
                timestamp
            });

            // Mark synced
            setActivities(prev => {
                const updated = prev.map(a => a.id === clientId ? { ...a, synced: true } : a);
                AsyncStorage.setItem(ACTIVITIES_KEY, JSON.stringify(updated));
                return updated;
            });

        } catch (e) {

        }

        return newActivity;
    }, []);

    const deleteActivity = useCallback(async (id: string) => {
        setActivities(prev => {
            const updated = prev.filter(a => a.id !== id);
            AsyncStorage.setItem(ACTIVITIES_KEY, JSON.stringify(updated));
            return updated;
        });

        try {
            await api.delete(`/workouts/activities/${id}`);
        } catch (e) {
            console.error('Failed to delete activity online', e);
        }
    }, []);

    return {
        stats,
        activities,
        loading,
        saveStats,
        addActivity: addActivityItem,
        deleteActivity,
        refresh: loadData
    };
}
