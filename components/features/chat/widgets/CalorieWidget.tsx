import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { useCalories } from '@/hooks/useCalories';
import { Ionicons } from '@expo/vector-icons';

type CalorieOption = {
    label: string;
    calories: number;
};

type CalorieWidgetProps = {
    food: string;
    options: CalorieOption[];
    messageId?: string | number; // For persistence
    onLogged?: () => void;
};

// Global cache for instant feedback
const LOGGED_CACHE = new Map<string, boolean>();

export default function CalorieWidget({ food, options, messageId, onLogged }: CalorieWidgetProps) {
    const { colors } = useTheme();
    const { t } = useLanguage();
    const { addEntry } = useCalories();

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
                const key = `calorie_logged_${messageId}`;
                const status = await AsyncStorage.getItem(key);
                if (status === 'true') {
                    setLogged(true);
                    LOGGED_CACHE.set(String(messageId), true);
                }
            } catch (e) {
                console.error('Failed to load calorie widget status', e);
            }
        };
        checkStatus();
    }, [messageId]);

    const handleLog = async (calories: number) => {
        setLoading(true);
        try {
            // Debug: log what we're passing


            // Ensure food is a string at call time
            const foodToLog = food || 'Unknown Food';
            await addEntry(foodToLog, calories);
            setLogged(true);

            // Persist status
            if (messageId) {
                LOGGED_CACHE.set(String(messageId), true);
                await AsyncStorage.setItem(`calorie_logged_${messageId}`, 'true');
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
                    <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                    <Text style={[styles.successText, { color: colors.text }]}>{t('calories.logged')} {food}!</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>{t('calories.select_portion')} ({food})</Text>

            <View style={styles.optionsContainer}>
                {options.map((opt, index) => {
                    let label = opt.label;
                    // Translate known keys
                    if (opt.label === 'Light Meal') label = t('calories.light_meal') || 'Light Meal';
                    if (opt.label === 'Average Meal') label = t('calories.average_meal') || 'Average Meal';
                    if (opt.label === 'Heavier Meal') label = t('calories.heavier_meal') || 'Heavier Meal';

                    return (
                        <TouchableOpacity
                            key={index}
                            style={[styles.optionButton, { backgroundColor: colors.inputBackground }]}
                            onPress={() => handleLog(opt.calories)}
                            disabled={loading}
                        >
                            <Text style={[styles.optionLabel, { color: colors.text }]}>{label}</Text>
                            <Text style={[styles.optionValue, { color: colors.primary }]}>{opt.calories} kcal</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {showCustom ? (
                <View style={styles.customContainer}>
                    <TextInput
                        style={[styles.input, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                        placeholder={t('calories.calories')}
                        placeholderTextColor={colors.textSecondary}
                        keyboardType="number-pad"
                        value={customCalories}
                        onChangeText={setCustomCalories}
                    />
                    <TouchableOpacity
                        style={[styles.customButton, { backgroundColor: colors.primary }]}
                        onPress={() => {
                            const val = parseInt(customCalories, 10);
                            if (!isNaN(val)) handleLog(val);
                        }}
                        disabled={loading || !customCalories}
                    >
                        <Text style={styles.customButtonText}>{t('calories.log_button')}</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <TouchableOpacity onPress={() => setShowCustom(true)} style={styles.showCustomBtn}>
                    <Text style={[styles.showCustomText, { color: colors.textSecondary }]}>{t('calories.log_custom')}</Text>
                </TouchableOpacity>
            )}

            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator color={colors.primary} />
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
    title: {
        fontSize: 14,
        fontWeight: 'bold',
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
