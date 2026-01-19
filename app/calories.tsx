import React, { useState, useMemo } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, FlatList, Modal, TextInput, Alert, ActivityIndicator, Keyboard, TouchableWithoutFeedback, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import AppSpecificChatHead from '../components/AppSpecificChatHead';
import { useCalories, CalorieEntry } from '../hooks/useCalories';

export default function CaloriesScreen() {
    const { colors, isDark } = useTheme();
    const { t } = useLanguage();

    // Use Shared Hook
    const { entries, loading, addEntry, updateEntry, deleteEntry } = useCalories();

    const [modalVisible, setModalVisible] = useState(false);

    // Form state
    const [editingEntry, setEditingEntry] = useState<CalorieEntry | null>(null);
    const [food, setFood] = useState('');
    const [calories, setCalories] = useState('');

    const handleAddEntry = async () => {
        if (!food.trim() || !calories.trim()) {
            return;
        }

        const calNum = parseInt(calories, 10);
        if (isNaN(calNum)) {
            Alert.alert(t('common.error'), 'Invalid calories number');
            return;
        }

        try {
            if (editingEntry) {
                await updateEntry(editingEntry.id, food.trim(), calNum);
            } else {
                await addEntry(food.trim(), calNum);
            }
            // Reset and close
            setFood('');
            setCalories('');
            setEditingEntry(null);
            setModalVisible(false);
        } catch (e) {
            Alert.alert(t('common.error'), 'Failed to save entry');
        }
    };

    const handleEdit = (entry: CalorieEntry) => {
        setEditingEntry(entry);
        setFood(entry.food);
        setCalories(entry.calories.toString());
        setModalVisible(true);
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
                    onPress: () => deleteEntry(id)
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
        // Add today if not present
        dates.add(todayStr);

        const totalAll = entries.reduce((sum, e) => sum + e.calories, 0);
        const average = dates.size > 0 ? Math.round(totalAll / dates.size) : 0;

        return { todayTotal, average };
    }, [entries]);

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
                <View style={[styles.entryItem, { borderBottomColor: colors.border }]}>
                    <View style={styles.entryLeft}>
                        <Text style={[styles.entryFood, { color: colors.text }]}>{item.food}</Text>
                        <Text style={[styles.entryTime, { color: colors.textSecondary }]}>
                            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    </View>
                    <View style={styles.entryRight}>
                        <Text style={[styles.entryCalories, { color: colors.primary }]}>
                            {item.calories}
                        </Text>
                        <View style={styles.actionButtons}>
                            <TouchableOpacity onPress={() => handleEdit(item)} style={styles.actionButton}>
                                <Ionicons name="pencil" size={20} color={colors.textSecondary} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.actionButton}>
                                <Ionicons name="trash-outline" size={20} color={colors.error || '#FF3B30'} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 50 }} />
            </SafeAreaView>
        );
    }

    const totalCalories = entries.reduce((sum, item) => sum + item.calories, 0);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: t('calories.title'),
                    headerShadowVisible: false,
                    headerStyle: { backgroundColor: colors.background },
                    headerTitleStyle: { color: colors.text, fontWeight: '600' },
                    headerTintColor: colors.primary,
                    headerRight: () => (
                        <TouchableOpacity onPress={() => setModalVisible(true)} style={{ paddingRight: 8 }}>
                            <Ionicons name="add-circle" size={28} color={colors.primary} />
                        </TouchableOpacity>
                    ),
                }}
            />

            {/* Stats Card */}
            <View style={styles.statsContainer}>
                <View style={[styles.statCard, { backgroundColor: colors.card }]}>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('calories.today')}</Text>
                    <Text style={[styles.statValue, { color: colors.primary }]}>{stats.todayTotal}</Text>
                    <Text style={[styles.statUnit, { color: colors.textSecondary }]}>kcal</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.card }]}>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('calories.average')}</Text>
                    <Text style={[styles.statValue, { color: colors.text }]}>{stats.average}</Text>
                    <Text style={[styles.statUnit, { color: colors.textSecondary }]}>kcal/day</Text>
                </View>
            </View>

            {/* List */}
            {entries.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Ionicons name="fast-food-outline" size={64} color={colors.textSecondary} />
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('calories.no_entries')}</Text>
                    <TouchableOpacity
                        style={[styles.addButton, { backgroundColor: colors.primary }]}
                        onPress={() => setModalVisible(true)}
                    >
                        <Text style={styles.addButtonText}>{t('calories.add_entry')}</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={entries}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            )}


            {/* Add Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => {
                    setModalVisible(false);
                    setEditingEntry(null);
                    setFood('');
                    setCalories('');
                }}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalOverlay}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
                >
                    <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
                        <View style={styles.modalBackdrop} />
                    </TouchableWithoutFeedback>

                    <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>
                                {editingEntry ? t('calories.edit_entry') : t('calories.add_entry')}
                            </Text>
                            <TouchableOpacity onPress={() => {
                                setModalVisible(false);
                                setEditingEntry(null);
                                setFood('');
                                setCalories('');
                            }}>
                                <Ionicons name="close" size={24} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <Text style={[styles.inputLabel, { color: colors.text }]}>{t('calories.food_name')}</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                            placeholder="e.g. Banana"
                            placeholderTextColor={colors.textSecondary}
                            value={food}
                            onChangeText={setFood}
                            autoFocus
                        />

                        <Text style={[styles.inputLabel, { color: colors.text }]}>{t('calories.calories')}</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                            placeholder="e.g. 105"
                            placeholderTextColor={colors.textSecondary}
                            value={calories}
                            onChangeText={setCalories}
                            keyboardType="number-pad"
                        />

                        <TouchableOpacity
                            style={[styles.modalAddButton, { backgroundColor: colors.primary }]}
                            onPress={handleAddEntry}
                        >
                            <Text style={styles.modalAddButtonText}>
                                {editingEntry ? t('calories.update') : t('common.add')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            <AppSpecificChatHead roleType="cal_tracker" appContext="calories" />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
    },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    statsContainer: {
        flexDirection: 'row',
        padding: 20,
        gap: 15,
    },
    statCard: {
        flex: 1,
        padding: 15,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    statLabel: { fontSize: 14, marginBottom: 5 },
    statValue: { fontSize: 28, fontWeight: 'bold' },
    statUnit: { fontSize: 12 },
    listContent: { paddingHorizontal: 20, paddingBottom: 100 },
    dateHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        marginTop: 15,
        marginBottom: 5,
    },
    dateHeaderText: { fontSize: 14, fontWeight: '600' },
    dateHeaderTotal: { fontSize: 14, fontWeight: 'bold' },
    entryItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 15,
        borderBottomWidth: 1,
    },
    entryLeft: { flex: 1 },
    entryFood: { fontSize: 16, fontWeight: '500', marginBottom: 2 },
    entryTime: { fontSize: 12 },
    entryCalories: { fontSize: 18, fontWeight: 'bold' },
    entryRight: { flexDirection: 'row', alignItems: 'center', gap: 15 },
    actionButtons: { flexDirection: 'row', gap: 10, marginLeft: 10 },
    actionButton: { padding: 4 },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 50,
    },
    emptyText: { marginTop: 15, fontSize: 16 },
    addButton: {
        marginTop: 20,
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 25,
    },
    addButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

    // Modal
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalContent: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: { fontSize: 20, fontWeight: 'bold' },
    inputLabel: { fontSize: 14, marginBottom: 8, fontWeight: '500' },
    input: {
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        borderWidth: 1,
        marginBottom: 20,
    },
    modalAddButton: {
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        marginTop: 10,
    },
    modalAddButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
