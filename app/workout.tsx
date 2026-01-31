import React, { useState, useEffect, useMemo } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    Modal,
    TextInput,
    Alert,
    ScrollView,
    Platform,
    TouchableWithoutFeedback,
    KeyboardAvoidingView
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { useWorkouts, Activity, PhysicalStats, ActivityLevel } from '@/hooks/useWorkouts';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import AppSpecificChatHead from '@/components/features/chat/AppSpecificChatHead';

// Activity level multipliers (Harris-Benedict)
const ACTIVITY_LEVELS: { key: ActivityLevel; multiplier: number; }[] = [
    { key: 'sedentary', multiplier: 1.2 },      // Little or no exercise
    { key: 'light', multiplier: 1.375 },        // Light exercise 1-3 days/week
    { key: 'moderate', multiplier: 1.55 },      // Moderate exercise 3-5 days/week
    { key: 'active', multiplier: 1.725 },       // Hard exercise 6-7 days/week
    { key: 'very_active', multiplier: 1.9 },    // Very hard exercise, physical job
];

export default function WorkoutScreen() {
    const { colors } = useTheme();
    const { t } = useLanguage();

    const { stats, activities, loading, saveStats, addActivity, deleteActivity } = useWorkouts();

    // Modals
    const [showStatsModal, setShowStatsModal] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);

    // Form inputs
    const [weightInput, setWeightInput] = useState('');
    const [heightInput, setHeightInput] = useState('');
    const [ageInput, setAgeInput] = useState('');
    const [genderInput, setGenderInput] = useState<'male' | 'female'>('male');
    const [activityLevelInput, setActivityLevelInput] = useState<ActivityLevel>('moderate');

    const [activityName, setActivityName] = useState('');
    const [durationInput, setDurationInput] = useState('');
    const [caloriesInput, setCaloriesInput] = useState('');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);

    // Initialize inputs when stats load
    useEffect(() => {
        if (stats) {
            setWeightInput(stats.weight?.toString() || '');
            setHeightInput(stats.height?.toString() || '');
            setAgeInput(stats.age?.toString() || '');
            setGenderInput(stats.gender || 'male');
            setActivityLevelInput(stats.activityLevel || 'moderate');
        } else if (!loading && !stats) {
            // If finished loading and no stats, prompt user
            setShowStatsModal(true);
        }
    }, [stats, loading]);

    const handleSaveStats = async () => {
        if (!weightInput || !heightInput || !ageInput) return;

        const newStats: PhysicalStats = {
            weight: parseFloat(weightInput),
            height: parseFloat(heightInput),
            age: parseInt(ageInput),
            gender: genderInput,
            activityLevel: activityLevelInput
        };

        await saveStats(newStats);
        setShowStatsModal(false);
    };

    const handleAddActivity = async () => {
        if (!activityName || !caloriesInput) {
            Alert.alert(t('common.error'), 'Please enter name and calories');
            return;
        }

        const dateStr = selectedDate.toISOString().split('T')[0];
        await addActivity(activityName, parseInt(durationInput) || 0, parseInt(caloriesInput), dateStr);

        // Reset & Close
        setActivityName('');
        setDurationInput('');
        setCaloriesInput('');
        setSelectedDate(new Date());
        setShowAddModal(false);
    };

    const handleDeleteActivity = (id: string) => {
        Alert.alert(
            t('workout.delete'),
            t('workout.delete_confirm'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.delete'),
                    style: 'destructive',
                    onPress: () => deleteActivity(id)
                }
            ]
        );
    };

    // --- Calculations ---

    const bmr = useMemo(() => {
        if (!stats) return 0;
        // Mifflin-St Jeor Equation
        const s = stats.gender === 'male' ? 5 : -161;
        const val = (10 * stats.weight) + (6.25 * stats.height) - (5 * stats.age) + s;
        return Math.round(val);
    }, [stats]);

    const tdee = useMemo(() => {
        if (!stats || !bmr) return 0;
        const level = ACTIVITY_LEVELS.find(l => l.key === stats.activityLevel) || ACTIVITY_LEVELS[2];
        return Math.round(bmr * level.multiplier);
    }, [stats, bmr]);

    const todayActivities = useMemo(() => {
        const today = dayjs().format('YYYY-MM-DD');
        return activities.filter(a => a.date === today);
    }, [activities]);

    const todayActiveCalories = useMemo(() => {
        return todayActivities.reduce((sum, a) => sum + a.calories, 0);
    }, [todayActivities]);

    const dailyAverage = useMemo(() => {
        if (activities.length === 0) return 0;
        const dates = new Set(activities.map(a => a.date));
        const total = activities.reduce((sum, a) => sum + a.calories, 0);
        return Math.round(total / dates.size);
    }, [activities]);

    const totalToday = bmr + todayActiveCalories;

    // --- Render ---

    const renderActivityItem = ({ item }: { item: Activity }) => (
        <TouchableOpacity
            style={[styles.activityItem, { backgroundColor: colors.card }]}
            onLongPress={() => handleDeleteActivity(item.id)}
        >
            <View style={styles.activityIcon}>
                <Ionicons name="barbell-outline" size={24} color={colors.primary} />
            </View>
            <View style={styles.activityInfo}>
                <Text style={[styles.activityName, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.activityTime, { color: colors.textSecondary }]}>
                    {dayjs(item.timestamp).format('h:mm A')} • {item.duration > 0 ? `${item.duration} ${t('workout.min')}` : ''}
                </Text>
            </View>
            <Text style={[styles.activityCalories, { color: colors.primary }]}>
                {item.calories} kcal
            </Text>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
            <Stack.Screen
                options={{
                    headerRight: () => (
                        <TouchableOpacity onPress={() => setShowAddModal(true)} style={{ paddingRight: 8 }}>
                            <Ionicons name="add-circle" size={28} color={colors.primary} />
                        </TouchableOpacity>
                    ),
                }}
            />

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Formula Info */}
                {stats && (
                    <View style={[styles.formulaCard, { backgroundColor: colors.card }]}>
                        <Text style={[styles.formulaTitle, { color: colors.text }]}>📊 {t('workout.your_stats')}</Text>
                        <Text style={[styles.formulaText, { color: colors.textSecondary }]}>
                            BMR = 10×{stats.weight} + 6.25×{stats.height} - 5×{stats.age} {stats.gender === 'male' ? '+ 5' : '- 161'}
                        </Text>
                        <Text style={[styles.formulaText, { color: colors.textSecondary }]}>
                            TDEE = {bmr} × {ACTIVITY_LEVELS.find(l => l.key === stats.activityLevel)?.multiplier || 1.55}
                        </Text>
                    </View>
                )}

                {/* Visual Header - Row 1: BMR & TDEE */}
                <View style={styles.headerStatsRow}>
                    {/* BMR Card */}
                    <TouchableOpacity
                        style={[styles.statCard, { backgroundColor: colors.card }]}
                        onPress={() => {
                            if (stats) {
                                setShowStatsModal(true);
                            }
                        }}
                    >
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('workout.bmr')}</Text>
                        <Text style={[styles.statValue, { color: colors.text }]}>{bmr}</Text>
                        <Text style={[styles.statUnit, { color: colors.textSecondary }]}>kcal/{t('workout.day')}</Text>
                    </TouchableOpacity>

                    {/* TDEE Card */}
                    <TouchableOpacity
                        style={[styles.statCard, { backgroundColor: colors.card }]}
                        onPress={() => {
                            if (stats) {
                                setShowStatsModal(true);
                            }
                        }}
                    >
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('workout.tdee')}</Text>
                        <Text style={[styles.statValue, { color: '#34C759' }]}>{tdee}</Text>
                        <Text style={[styles.statUnit, { color: colors.textSecondary }]}>kcal/{t('workout.day')}</Text>
                    </TouchableOpacity>
                </View>

                {/* Visual Header - Row 2: Today Active & Daily Average */}
                <View style={styles.headerStatsRow}>
                    {/* Active Card */}
                    <View style={[styles.statCard, { backgroundColor: colors.card }]}>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('workout.active_calories')}</Text>
                        <Text style={[styles.statValue, { color: '#FF3B30' }]}>{todayActiveCalories}</Text>
                        <Text style={[styles.statUnit, { color: colors.textSecondary }]}>{t('common.today') || 'Today'}</Text>
                    </View>

                    {/* Average Card */}
                    <View style={[styles.statCard, { backgroundColor: colors.card }]}>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('workout.average')}</Text>
                        <Text style={[styles.statValue, { color: colors.text }]}>{dailyAverage}</Text>
                        <Text style={[styles.statUnit, { color: colors.textSecondary }]}>kcal/{t('workout.day')}</Text>
                    </View>
                </View>

                {/* Total Visual */}
                <View style={[styles.totalCard, { backgroundColor: colors.card }]}>
                    <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>{t('workout.total_calories')}</Text>
                    <View style={styles.totalRow}>
                        <Ionicons name="flame" size={32} color="#FF9500" />
                        <Text style={[styles.totalValue, { color: colors.text }]}>{totalToday}</Text>
                        <Text style={[styles.totalUnit, { color: colors.textSecondary }]}>kcal</Text>
                    </View>

                    {/* Visual Bar */}
                    <View style={styles.barContainer}>
                        <View style={{ flex: bmr, backgroundColor: '#34C759', height: 8, borderTopLeftRadius: 4, borderBottomLeftRadius: 4 }} />
                        <View style={{ flex: todayActiveCalories > 0 ? todayActiveCalories : 0.1, backgroundColor: '#FF3B30', height: 8, borderTopRightRadius: 4, borderBottomRightRadius: 4 }} />
                    </View>
                    <View style={styles.barLabels}>
                        <Text style={{ fontSize: 10, color: '#34C759' }}>{t('workout.rest')} ({bmr})</Text>
                        <Text style={{ fontSize: 10, color: '#FF3B30' }}>{t('workout.active')} ({todayActiveCalories})</Text>
                    </View>
                </View>

                {/* Activity History List */}
                <View style={styles.listHeader}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('workout.history')}</Text>
                </View>

                {activities.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={{ color: colors.textSecondary }}>{t('workout.no_activities')}</Text>
                    </View>
                ) : (
                    activities.map((item, index) => {
                        const prevItem = activities[index - 1];
                        const showDateHeader = !prevItem || prevItem.date !== item.date;
                        const isToday = item.date === dayjs().format('YYYY-MM-DD');

                        return (
                            <View key={item.id}>
                                {showDateHeader && (
                                    <View style={[styles.dateHeader, { backgroundColor: isToday ? colors.primary + '20' : colors.card }]}>
                                        <Text style={[styles.dateHeaderText, { color: isToday ? colors.primary : colors.textSecondary }]}>
                                            {isToday ? (t('common.today') || 'Today') : item.date}
                                        </Text>
                                    </View>
                                )}
                                <View style={{ marginBottom: 8 }}>
                                    {renderActivityItem({ item })}
                                </View>
                            </View>
                        );
                    })
                )}

                <View style={{ height: 80 }} />
            </ScrollView>

            {/* Stats Modal */}
            <Modal visible={showStatsModal} animationType="slide" transparent onRequestClose={() => setShowStatsModal(false)}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalOverlay}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
                >
                    <TouchableWithoutFeedback onPress={() => setShowStatsModal(false)}>
                        <View style={styles.modalBackdrop} />
                    </TouchableWithoutFeedback>
                    <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
                            <Text style={[styles.modalTitle, { color: colors.text, marginBottom: 0 }]}>{t('workout.edit_profile')}</Text>
                            <TouchableOpacity
                                style={{ position: 'absolute', right: 0 }}
                                onPress={() => setShowStatsModal(false)}
                            >
                                <Ionicons name="close" size={24} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                            <Text style={{ color: colors.textSecondary, marginBottom: 16 }}>{t('workout.bmr_explanation')}</Text>

                            <View style={styles.inputRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.inputLabel, { color: colors.text }]}>{t('workout.weight')}</Text>
                                    <TextInput
                                        style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                                        value={weightInput}
                                        onChangeText={setWeightInput}
                                        keyboardType="numeric"
                                        placeholder="60"
                                        placeholderTextColor={colors.textSecondary}
                                    />
                                </View>
                                <View style={{ width: 16 }} />
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.inputLabel, { color: colors.text }]}>{t('workout.height')}</Text>
                                    <TextInput
                                        style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                                        value={heightInput}
                                        onChangeText={setHeightInput}
                                        keyboardType="numeric"
                                        placeholder="170"
                                        placeholderTextColor={colors.textSecondary}
                                    />
                                </View>
                            </View>

                            <View style={styles.inputRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.inputLabel, { color: colors.text }]}>{t('workout.age')}</Text>
                                    <TextInput
                                        style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                                        value={ageInput}
                                        onChangeText={setAgeInput}
                                        keyboardType="numeric"
                                        placeholder="25"
                                        placeholderTextColor={colors.textSecondary}
                                    />
                                </View>
                                <View style={{ width: 16 }} />
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.inputLabel, { color: colors.text }]}>{t('workout.gender')}</Text>
                                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                                        <TouchableOpacity
                                            style={[styles.genderBtn, genderInput === 'male' && { backgroundColor: colors.primary }]}
                                            onPress={() => setGenderInput('male')}
                                        >
                                            <Text style={{ color: genderInput === 'male' ? '#fff' : colors.text }}>{t('workout.male')}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.genderBtn, genderInput === 'female' && { backgroundColor: colors.primary }]}
                                            onPress={() => setGenderInput('female')}
                                        >
                                            <Text style={{ color: genderInput === 'female' ? '#fff' : colors.text }}>{t('workout.female')}</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>

                            {/* Activity Level Selector */}
                            <View style={styles.activityLevelContainer}>
                                <Text style={[styles.inputLabel, { color: colors.text }]}>{t('workout.activity_level')}</Text>
                                <View style={styles.activityLevelRow}>
                                    {ACTIVITY_LEVELS.map(level => (
                                        <TouchableOpacity
                                            key={level.key}
                                            style={[
                                                styles.activityLevelBtn,
                                                activityLevelInput === level.key && { backgroundColor: colors.primary, borderColor: colors.primary }
                                            ]}
                                            onPress={() => setActivityLevelInput(level.key)}
                                        >
                                            <Text style={{
                                                color: activityLevelInput === level.key ? '#fff' : colors.text,
                                                fontSize: 12,
                                                fontWeight: activityLevelInput === level.key ? '600' : '400'
                                            }}>
                                                {t(`workout.activity_${level.key}`)}
                                            </Text>
                                            <Text style={{
                                                color: activityLevelInput === level.key ? 'rgba(255,255,255,0.7)' : colors.textSecondary,
                                                fontSize: 10
                                            }}>
                                                ×{level.multiplier}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.primary }]} onPress={handleSaveStats}>
                                <Text style={styles.saveButtonText}>{t('common.save')}</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Add Activity Modal */}
            <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={() => setShowAddModal(false)}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalOverlay}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
                >
                    <TouchableWithoutFeedback onPress={() => setShowAddModal(false)}>
                        <View style={styles.modalBackdrop} />
                    </TouchableWithoutFeedback>
                    <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.text, marginBottom: 0 }]}>{t('workout.add_activity')}</Text>
                            <TouchableOpacity onPress={() => {
                                setShowAddModal(false);
                                setActivityName('');
                                setDurationInput('');
                                setCaloriesInput('');
                                setSelectedDate(new Date());
                            }}>
                                <Ionicons name="close" size={24} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                            <View style={{ marginBottom: 20 }}>
                                <Text style={[styles.inputLabel, { color: colors.text }]}>{t('workout.activity_name')}</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                                    value={activityName}
                                    onChangeText={setActivityName}
                                    placeholder="Running, Gym, etc."
                                    placeholderTextColor={colors.textSecondary}
                                    autoFocus
                                />
                            </View>

                            <View style={{ marginBottom: 20 }}>
                                <Text style={[styles.inputLabel, { color: colors.text }]}>{t('common.date') || 'Date'}</Text>
                                <TouchableOpacity
                                    style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, justifyContent: 'center' }]}
                                    onPress={() => setShowDatePicker(true)}
                                >
                                    <Text style={{ color: colors.text, fontSize: 16 }}>
                                        {selectedDate.toLocaleDateString()}
                                    </Text>
                                </TouchableOpacity>
                                {showDatePicker && (
                                    <DateTimePicker
                                        value={selectedDate}
                                        mode="date"
                                        display="default"
                                        onChange={(event, date) => {
                                            setShowDatePicker(false);
                                            if (date) setSelectedDate(date);
                                        }}
                                    />
                                )}
                            </View>

                            <View style={[styles.inputRow, { marginBottom: 24 }]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.inputLabel, { color: colors.text }]}>{t('workout.duration')}</Text>
                                    <TextInput
                                        style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                                        value={durationInput}
                                        onChangeText={setDurationInput}
                                        keyboardType="numeric"
                                        placeholder="30"
                                        placeholderTextColor={colors.textSecondary}
                                    />
                                </View>
                                <View style={{ width: 16 }} />
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.inputLabel, { color: colors.text }]}>{t('workout.calories_burned')}</Text>
                                    <TextInput
                                        style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                                        value={caloriesInput}
                                        onChangeText={setCaloriesInput}
                                        keyboardType="numeric"
                                        placeholder="200"
                                        placeholderTextColor={colors.textSecondary}
                                    />
                                </View>
                            </View>

                            <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.primary, marginTop: 0 }]} onPress={handleAddActivity}>
                                <Text style={styles.saveButtonText}>{t('workout.save')}</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Workout Friend Chat Head */}
            <AppSpecificChatHead roleType="workout" appContext="workout" />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { padding: 16 },
    headerStatsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
    dateHeader: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginBottom: 8, marginTop: 4 },
    dateHeaderText: { fontSize: 14, fontWeight: '700' },
    statCard: { flex: 1, padding: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    statLabel: { fontSize: 12, marginBottom: 4 },
    statValue: { fontSize: 24, fontWeight: '800' },
    statUnit: { fontSize: 10, marginTop: 2 },
    avgContainer: { marginTop: 4, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 4 },
    totalCard: { padding: 20, borderRadius: 20, alignItems: 'center', marginBottom: 24 },
    totalLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
    totalRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
    totalValue: { fontSize: 48, fontWeight: '900' },
    totalUnit: { fontSize: 16, fontWeight: '500', marginTop: 12 },
    barContainer: { flexDirection: 'row', width: '100%', height: 8, marginBottom: 4 },
    barLabels: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
    listHeader: { marginBottom: 12 },
    sectionTitle: { fontSize: 18, fontWeight: '700' },
    activityItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, marginBottom: 12 },
    activityIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.05)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    activityInfo: { flex: 1 },
    activityName: { fontSize: 16, fontWeight: '600' },
    activityTime: { fontSize: 12, marginTop: 2 },
    activityCalories: { fontSize: 16, fontWeight: '700' },
    emptyState: { alignItems: 'center', padding: 20 },
    fab: { position: 'absolute', right: 20, bottom: 20, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 8 },
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
    inputRow: { flexDirection: 'row', marginBottom: 16 },
    inputLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
    input: {
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        borderWidth: 1,
        marginBottom: 20,
    },
    genderBtn: { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: '#ddd' },
    saveButton: { height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
    saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    modalActions: { flexDirection: 'row', marginTop: 16, gap: 12 },
    cancelButton: { flex: 1, height: 50, alignItems: 'center', justifyContent: 'center' },
    formulaCard: { padding: 16, borderRadius: 16, marginBottom: 12 },
    formulaTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
    formulaText: { fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginBottom: 4 },
    activityLevelContainer: { marginTop: 16 },
    activityLevelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    activityLevelBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#ddd' },
});
