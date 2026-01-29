import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';

type WorkoutOption = {
    label: string;
    calories: number;
};

type WorkoutWidgetProps = {
    exercise: string;
    duration?: number;
    options: WorkoutOption[];
    messageId?: string | number;
    onLogged?: () => void;
};

const ACTIVITIES_KEY = 'workout_activities';

// Global cache for instant feedback
const LOGGED_CACHE = new Map<string, boolean>();

export default function WorkoutWidget({ exercise, duration, options, messageId, onLogged }: WorkoutWidgetProps) {
    const { colors } = useTheme();
    const { t } = useLanguage();

    const [loading, setLoading] = useState(false);
    const [logged, setLogged] = useState(false);
    const [customCalories, setCustomCalories] = useState('');
    const [showCustom, setShowCustom] = useState(false);

    // Check persistence
    useEffect(() => {
        const checkStatus = async () => {
            if (!messageId) return;

            // Check memory cache first
            if (LOGGED_CACHE.has(String(messageId))) {
                setLogged(true);
                return;
            }

            try {
                const key = `workout_logged_${messageId}`;
                const status = await AsyncStorage.getItem(key);
                if (status === 'true') {
                    setLogged(true);
                    LOGGED_CACHE.set(String(messageId), true);
                }
            } catch (e) {
                console.error('Failed to load workout widget status', e);
            }
        };
        checkStatus();
    }, [messageId]);

    const handleLog = async (calories: number) => {
        setLoading(true);
        try {
            // Get safe exercise name
            let safeExerciseName: string;
            if (Array.isArray(exercise)) {
                safeExerciseName = exercise.join(', ').trim() || 'Workout';
            } else if (typeof exercise === 'string') {
                safeExerciseName = exercise.trim() || 'Workout';
            } else {
                safeExerciseName = 'Workout';
            }

            // Create new activity entry
            const newActivity = {
                id: Date.now().toString(),
                name: safeExerciseName,
                duration: duration || 0,
                calories: calories,
                date: dayjs().format('YYYY-MM-DD'),
                timestamp: Date.now()
            };

            // Load existing activities and add new one
            const savedActivities = await AsyncStorage.getItem(ACTIVITIES_KEY);
            const activities = savedActivities ? JSON.parse(savedActivities) : [];
            const updatedActivities = [newActivity, ...activities];
            await AsyncStorage.setItem(ACTIVITIES_KEY, JSON.stringify(updatedActivities));

            setLogged(true);

            // Persist status
            if (messageId) {
                LOGGED_CACHE.set(String(messageId), true);
                await AsyncStorage.setItem(`workout_logged_${messageId}`, 'true');
            }

            if (onLogged) onLogged();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (logged) {
        return (
            <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.primary }]}>
                <View style={styles.successContent}>
                    <Ionicons name="checkmark-circle" size={24} color="#FF3B30" />
                    <Text style={[styles.successText, { color: colors.text }]}>{t('workout.logged') || 'Logged'} {exercise}!</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.headerRow}>
                <Ionicons name="fitness" size={20} color="#FF3B30" />
                <Text style={[styles.title, { color: colors.text }]}>{exercise}</Text>
            </View>
            {duration && duration > 0 && (
                <Text style={[styles.duration, { color: colors.textSecondary }]}>{duration} min</Text>
            )}

            <View style={styles.optionsContainer}>
                {options.map((opt, index) => {
                    let label = opt.label;
                    // Translate known keys
                    if (opt.label.toLowerCase().includes('light')) label = t('workout.intensity_light') || 'Light';
                    if (opt.label.toLowerCase().includes('moderate')) label = t('workout.intensity_moderate') || 'Moderate';
                    if (opt.label.toLowerCase().includes('high') || opt.label.toLowerCase().includes('intense')) label = t('workout.intensity_high') || 'High';

                    return (
                        <TouchableOpacity
                            key={index}
                            style={[styles.optionButton, { backgroundColor: colors.inputBackground }]}
                            onPress={() => handleLog(opt.calories)}
                            disabled={loading}
                        >
                            <Text style={[styles.optionLabel, { color: colors.text }]}>{label}</Text>
                            <Text style={[styles.optionValue, { color: '#FF3B30' }]}>{opt.calories} kcal</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {showCustom ? (
                <View style={styles.customContainer}>
                    <TextInput
                        style={[styles.input, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                        placeholder={t('workout.calories_burned') || 'Calories'}
                        placeholderTextColor={colors.textSecondary}
                        keyboardType="number-pad"
                        value={customCalories}
                        onChangeText={setCustomCalories}
                    />
                    <TouchableOpacity
                        style={[styles.customButton, { backgroundColor: '#FF3B30' }]}
                        onPress={() => {
                            const val = parseInt(customCalories, 10);
                            if (!isNaN(val)) handleLog(val);
                        }}
                        disabled={loading || !customCalories}
                    >
                        <Text style={styles.customButtonText}>{t('workout.save') || 'Log'}</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <TouchableOpacity onPress={() => setShowCustom(true)} style={styles.showCustomBtn}>
                    <Text style={[styles.showCustomText, { color: colors.textSecondary }]}>{t('workout.custom_calories') || 'Enter Custom'}</Text>
                </TouchableOpacity>
            )}

            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator color="#FF3B30" />
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginTop: 10,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        width: '100%',
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    title: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    duration: {
        fontSize: 12,
        marginBottom: 10,
    },
    optionsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    optionButton: {
        flex: 1,
        minWidth: '30%',
        padding: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    optionLabel: {
        fontSize: 12,
        fontWeight: '500',
        textAlign: 'center',
    },
    optionValue: {
        fontSize: 12,
        fontWeight: 'bold',
        marginTop: 2,
    },
    customContainer: {
        flexDirection: 'row',
        marginTop: 10,
        gap: 8,
    },
    input: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 10,
        height: 40,
    },
    customButton: {
        paddingHorizontal: 16,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    customButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 12,
    },
    showCustomBtn: {
        marginTop: 10,
        alignItems: 'center',
    },
    showCustomText: {
        fontSize: 12,
        textDecorationLine: 'underline',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 12,
    },
    successContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    successText: {
        fontWeight: 'bold',
        fontSize: 14,
    },
});
