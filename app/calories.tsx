import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, FlatList, Modal, TextInput, Alert, ActivityIndicator, Keyboard, TouchableWithoutFeedback, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

type CalorieEntry = {
    id: string;
    food: string;
    calories: number;
    date: string; // YYYY-MM-DD
    timestamp: number;
};

const STORAGE_KEY = 'calories_entries';

export default function CaloriesScreen() {
    const { colors, isDark } = useTheme();
    const { t } = useLanguage();
    const [entries, setEntries] = useState<CalorieEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);

    // Form state
    const [food, setFood] = useState('');
    const [calories, setCalories] = useState('');

    useEffect(() => {
        loadEntries();
    }, []);

    const loadEntries = async () => {
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
    };

    const saveEntries = async (newEntries: CalorieEntry[]) => {
        try {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newEntries));
            setEntries(newEntries);
        } catch (error) {
            console.error('Failed to save calories', error);
            Alert.alert(t('common.error'), t('profile.profile_update_failed'));
        }
    };

    const handleAddEntry = () => {
        if (!food.trim() || !calories.trim()) {
            return;
        }

        const calNum = parseInt(calories, 10);
        if (isNaN(calNum)) {
            Alert.alert(t('common.error'), 'Invalid calories number');
            return;
        }

        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];

        const newEntry: CalorieEntry = {
            id: Date.now().toString(),
            food: food.trim(),
            calories: calNum,
            date: dateStr,
            timestamp: now.getTime(),
        };

        const updated = [newEntry, ...entries];
        saveEntries(updated);

        // Reset and close
        setFood('');
        setCalories('');
        setModalVisible(false);
    };

    const handleDelete = (id: string) => {
        Alert.alert(
            t('calories.delete'),
            t('calories.delete_confirm'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.confirm'),
                    style: 'destructive',
                    onPress: () => {
                        const updated = entries.filter(e => e.id !== id);
                        saveEntries(updated);
                    }
                }
            ]
        );
    };

    // Stats
    const stats = useMemo(() => {
        const todayStr = new Date().toISOString().split('T')[0];
        const todayEntries = entries.filter(e => e.date === todayStr);
        const todayTotal = todayEntries.reduce((sum, e) => sum + e.calories, 0);

        // Daily Average
        // Get unique dates
        const dates = new Set(entries.map(e => e.date));
        // Add today if not present (so average includes today even if 0)
        dates.add(todayStr);

        const totalAll = entries.reduce((sum, e) => sum + e.calories, 0);
        const average = dates.size > 0 ? Math.round(totalAll / dates.size) : 0;

        return { todayTotal, average };
    }, [entries]);

    // List list all, showing date header when it changes.
    // And "average calories eaten in a day"

    const renderItem = ({ item, index }: { item: CalorieEntry, index: number }) => {
        const prevItem = entries[index - 1];
        const showDateHeader = !prevItem || prevItem.date !== item.date;

        return (
            <View>
                {showDateHeader && (
                    <View style={[styles.dateHeader, { backgroundColor: isDark ? '#333' : '#f0f0f0' }]}>
                        <Text style={[styles.dateHeaderText, { color: colors.textSecondary }]}>
                            {item.date === new Date().toISOString().split('T')[0] ? t('common.today') : item.date}
                        </Text>
                        <Text style={[styles.dateHeaderTotal, { color: colors.primary }]}>
                            {entries.filter(e => e.date === item.date).reduce((sum, e) => sum + e.calories, 0)} kcal
                        </Text>
                    </View>
                )}
                <TouchableOpacity
                    style={[styles.entryItem, { borderBottomColor: colors.border }]}
                    onLongPress={() => handleDelete(item.id)}
                >
                    <View style={styles.entryLeft}>
                        <Text style={[styles.entryFood, { color: colors.text }]}>{item.food}</Text>
                        <Text style={[styles.entryTime, { color: colors.textSecondary }]}>
                            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    </View>
                    <Text style={[styles.entryCalories, { color: colors.text }]}>{item.calories} kcal</Text>
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
            <Stack.Screen options={{ title: t('calories.title') }} />

            {/* Dashboard */}
            <View style={styles.dashboard}>
                <View style={[styles.statCard, { backgroundColor: colors.card, shadowColor: colors.border }]}>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('calories.today_total')}</Text>
                    <Text style={[styles.statValue, { color: colors.primary }]}>{stats.todayTotal}</Text>
                    <Text style={[styles.statUnit, { color: colors.textSecondary }]}>kcal</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.card, shadowColor: colors.border }]}>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('calories.daily_average')}</Text>
                    <Text style={[styles.statValue, { color: '#34C759' }]}>{stats.average}</Text>
                    <Text style={[styles.statUnit, { color: colors.textSecondary }]}>kcal</Text>
                </View>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
            ) : (
                <FlatList
                    data={entries}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="nutrition-outline" size={48} color={colors.textSecondary} />
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('calories.no_entries')}</Text>
                        </View>
                    }
                />
            )}

            {/* FAB */}
            <TouchableOpacity
                style={[styles.fab, { backgroundColor: colors.primary, shadowColor: "#000" }]}
                onPress={() => setModalVisible(true)}
            >
                <Ionicons name="add" size={30} color="#fff" />
            </TouchableOpacity>

            {/* Add Entry Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={{ flex: 1 }}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
                >
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                        <View style={styles.modalOverlay}>
                            <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                                <View style={styles.modalHeader}>
                                    <Text style={[styles.modalTitle, { color: colors.text }]}>{t('calories.add_entry')}</Text>
                                    <TouchableOpacity onPress={() => setModalVisible(false)}>
                                        <Ionicons name="close" size={24} color={colors.textSecondary} />
                                    </TouchableOpacity>
                                </View>

                                <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                                    <TextInput
                                        style={[styles.input, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#f5f5f5', color: colors.text, borderColor: colors.border }]}
                                        placeholder={t('calories.food_placeholder')}
                                        placeholderTextColor={colors.textSecondary}
                                        value={food}
                                        onChangeText={setFood}
                                    />

                                    <TextInput
                                        style={[styles.input, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#f5f5f5', color: colors.text, borderColor: colors.border }]}
                                        placeholder={t('calories.calories_placeholder')}
                                        placeholderTextColor={colors.textSecondary}
                                        value={calories}
                                        onChangeText={setCalories}
                                        keyboardType="number-pad"
                                    />

                                    <TouchableOpacity
                                        style={[styles.saveButton, { backgroundColor: colors.primary }]}
                                        onPress={handleAddEntry}
                                    >
                                        <Text style={styles.saveButtonText}>{t('calories.save')}</Text>
                                    </TouchableOpacity>
                                </ScrollView>
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    dashboard: {
        flexDirection: 'row',
        padding: 16,
        gap: 12,
    },
    statCard: {
        flex: 1,
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    statLabel: {
        fontSize: 13,
        fontWeight: '500',
        marginBottom: 4,
    },
    statValue: {
        fontSize: 28,
        fontWeight: 'bold',
    },
    statUnit: {
        fontSize: 12,
        fontWeight: '500',
    },
    listContent: {
        paddingBottom: 80,
    },
    dateHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        paddingHorizontal: 16,
        alignItems: 'center',
    },
    dateHeaderText: {
        fontSize: 14,
        fontWeight: '600',
    },
    dateHeaderTotal: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    entryItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    entryLeft: {
        flex: 1,
    },
    entryFood: {
        fontSize: 16,
        fontWeight: '500',
    },
    entryTime: {
        fontSize: 12,
        marginTop: 2,
    },
    entryCalories: {
        fontSize: 16,
        fontWeight: '600',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 60,
    },
    emptyText: {
        marginTop: 12,
        fontSize: 16,
    },
    fab: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 6,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    modalContent: {
        borderRadius: 24,
        padding: 24,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    input: {
        height: 50,
        borderRadius: 12,
        paddingHorizontal: 16,
        marginBottom: 16,
        fontSize: 16,
        borderWidth: 1,
    },
    saveButton: {
        height: 50,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
