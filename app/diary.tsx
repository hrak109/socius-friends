import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, FlatList, TextInput, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { useLanguage } from '../context/LanguageContext';

type DiaryEntry = {
    id: string;
    date: string;
    content: string;
    title?: string;
    created_at: string;
};

export default function DiaryScreen() {
    const { colors, isDark } = useTheme();
    const { t, language } = useLanguage();
    const [entries, setEntries] = useState<DiaryEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Edit States
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');
    const [editTitle, setEditTitle] = useState('');
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    // Modal States
    const [modalVisible, setModalVisible] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newContent, setNewContent] = useState('');

    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const toggleExpand = (id: string) => {
        const newExpanded = new Set(expandedIds);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedIds(newExpanded);
    };

    const fetchEntries = async () => {
        try {
            setIsLoading(true);
            const res = await api.get('/diary');
            setEntries(res.data);
        } catch (error) {
            console.error('Failed to fetch diary entries:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchEntries();
    }, []);

    const handleSaveEntry = async () => {
        if (newContent.trim() === '') return;

        try {
            const today = new Date().toISOString();
            const res = await api.post('/diary', {
                content: newContent,
                title: newTitle.trim() === '' ? undefined : newTitle,
                date: today
            });

            setEntries([res.data, ...entries]);
            setNewTitle('');
            setNewContent('');
            setModalVisible(false);
        } catch (error) {
            console.error('Failed to save diary entry:', error);
        }
    };

    const startEditing = (entry: DiaryEntry) => {
        setEditingId(entry.id);
        setEditContent(entry.content);
        setEditTitle(entry.title || '');
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditContent('');
        setEditTitle('');
    };

    const saveEdit = async (id: string) => {
        if (editContent.trim() === '') return;
        setIsSavingEdit(true);
        try {
            const res = await api.put(`/diary/${id}`, {
                content: editContent,
                title: editTitle.trim() === '' ? undefined : editTitle
            });
            setEntries(entries.map(e => e.id === id ? res.data : e));
            setEditingId(null);
            setEditContent('');
            setEditTitle('');
        } catch (error) {
            console.error('Failed to update diary entry:', error);
        } finally {
            setIsSavingEdit(false);
        }
    };

    const renderTimelineItem = ({ item, index }: { item: DiaryEntry; index: number }) => {
        const isEditing = editingId === item.id;
        const isExpanded = expandedIds.has(item.id);
        const dateObj = new Date(item.date);
        const day = dateObj.toLocaleDateString('en-US', { day: 'numeric' });
        const month = dateObj.toLocaleDateString(language === 'ko' ? 'ko-KR' : 'en-US', { month: 'short' });
        const year = dateObj.getFullYear();
        const isLastItem = index === entries.length - 1;

        return (
            <View style={styles.timelineRow}>
                {/* Date Column */}
                <View style={styles.dateColumn}>
                    <Text style={[styles.dayText, { color: colors.text }]}>{day}</Text>
                    <Text style={[styles.monthText, { color: colors.textSecondary }]}>{month}</Text>
                    {new Date().getFullYear() !== year && (
                        <Text style={[styles.yearText, { color: colors.textSecondary }]}>{year}</Text>
                    )}
                </View>

                {/* Timeline Connector */}
                <View style={styles.timelineConnector}>
                    <View style={[styles.timelineDot, { backgroundColor: colors.primary }]} />
                    {!isLastItem && <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />}
                </View>

                {/* Content Card */}
                <View style={styles.contentColumn}>
                    <View style={[styles.card, { backgroundColor: colors.card, shadowColor: isDark ? '#000' : '#888' }]}>
                        {isEditing ? (
                            <View>
                                <TextInput
                                    style={[styles.editInput, { color: colors.text, backgroundColor: colors.inputBackground, fontWeight: '700', marginBottom: 8, minHeight: 40 }]}
                                    placeholder={t('diary.title_placeholder')}
                                    placeholderTextColor={colors.textSecondary}
                                    value={editTitle}
                                    onChangeText={setEditTitle}
                                />
                                <TextInput
                                    style={[styles.editInput, { color: colors.text, backgroundColor: colors.inputBackground }]}
                                    multiline
                                    value={editContent}
                                    onChangeText={setEditContent}
                                    autoFocus
                                />
                                <View style={styles.editActions}>
                                    <TouchableOpacity onPress={cancelEditing} disabled={isSavingEdit}>
                                        <Text style={[styles.editText, { color: colors.textSecondary }]}>{t('common.cancel')}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => saveEdit(item.id)} disabled={isSavingEdit}>
                                        <Text style={[styles.editText, { color: colors.primary, fontWeight: 'bold' }]}>{t('common.save')}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <TouchableOpacity activeOpacity={0.8} onPress={() => toggleExpand(item.id)}>
                                <View style={styles.cardHeader}>
                                    {item.title ? (
                                        <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                                            {item.title}
                                        </Text>
                                    ) : (
                                        <View style={{ flex: 1 }} />
                                    )}
                                    <TouchableOpacity onPress={() => startEditing(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                        <Ionicons name="create-outline" size={18} color={colors.textSecondary} />
                                    </TouchableOpacity>
                                </View>
                                <Text style={[styles.cardContent, { color: colors.textSecondary }]} numberOfLines={isExpanded ? undefined : 4}>
                                    {item.content}
                                </Text>
                                <Text style={[styles.cardTime, { color: colors.textSecondary }]}>
                                    {dateObj.toLocaleTimeString(language === 'ko' ? 'ko-KR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <Stack.Screen options={{ title: t('diary.title'), headerBackTitle: t('common.back') }} />

            {isLoading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={entries}
                    keyExtractor={(item) => item.id}
                    renderItem={renderTimelineItem}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Ionicons name="book-outline" size={64} color={colors.textSecondary} style={{ opacity: 0.5 }} />
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('diary.no_entries')}</Text>
                        </View>
                    }
                />
            )}

            <TouchableOpacity
                style={[styles.fab, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
                onPress={() => setModalVisible(true)}
            >
                <Ionicons name="pencil" size={26} color="#fff" />
            </TouchableOpacity>

            {/* Modal - Same minimal style as Notes */}
            <Modal
                animationType="slide"
                presentationStyle="pageSheet"
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
                    <SafeAreaView style={{ flex: 1 }}>
                        <View style={styles.modalHeaderBar}>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Text style={[styles.modalCancel, { color: colors.textSecondary }]}>{t('common.cancel')}</Text>
                            </TouchableOpacity>
                            <Text style={[styles.modalTitleText, { color: colors.text }]}>{t('diary.new_entry')}</Text>
                            <TouchableOpacity onPress={handleSaveEntry}>
                                <Text style={[styles.modalSave, { color: colors.primary }]}>{t('common.save')}</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            <TextInput
                                style={[styles.modalInputTitle, { color: colors.text, borderBottomColor: colors.border }]}
                                placeholder={t('diary.title_placeholder')}
                                placeholderTextColor={colors.textSecondary}
                                value={newTitle}
                                onChangeText={setNewTitle}
                            />
                            <TextInput
                                style={[styles.modalInputContent, { color: colors.text }]}
                                placeholder={t('diary.content_placeholder')}
                                placeholderTextColor={colors.textSecondary}
                                multiline
                                textAlignVertical="top"
                                value={newContent}
                                onChangeText={setNewContent}
                            />
                        </ScrollView>
                    </SafeAreaView>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        paddingVertical: 20,
        paddingHorizontal: 16,
        paddingBottom: 100,
    },
    timelineRow: {
        flexDirection: 'row',
        marginBottom: 4,
    },
    dateColumn: {
        width: 60,
        alignItems: 'center',
        paddingTop: 0,
    },
    dayText: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    monthText: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    yearText: {
        fontSize: 10,
        marginTop: 2,
    },
    timelineConnector: {
        width: 20,
        alignItems: 'center',
        marginRight: 10,
    },
    timelineDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginTop: 8,
        zIndex: 1,
    },
    timelineLine: {
        width: 2,
        flex: 1,
        marginTop: -4, // Overlap slightly
        marginBottom: -20, // Extend to next item
    },
    contentColumn: {
        flex: 1,
        paddingBottom: 20,
    },
    card: {
        borderRadius: 16,
        padding: 16,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
        flex: 1,
        marginRight: 8,
    },
    cardContent: {
        fontSize: 15,
        lineHeight: 22,
        marginBottom: 8,
    },
    cardTime: {
        fontSize: 12,
        opacity: 0.6,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 100,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 16,
        fontWeight: '500',
    },
    fab: {
        position: 'absolute',
        bottom: 30,
        right: 24,
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    modalHeaderBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(0,0,0,0.1)',
    },
    modalCancel: { fontSize: 17 },
    modalSave: { fontSize: 17, fontWeight: '600' },
    modalTitleText: { fontSize: 17, fontWeight: '600' },
    modalBody: { flex: 1, padding: 24 },
    modalInputTitle: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 16,
        paddingBottom: 8,
        borderBottomWidth: 1,
    },
    modalInputContent: {
        fontSize: 17,
        lineHeight: 24,
        minHeight: 200,
    },
    editInput: {
        fontSize: 15,
        lineHeight: 22,
        minHeight: 80,
        marginBottom: 10,
        borderRadius: 8,
        padding: 8,
    },
    editActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 16,
    },
    editText: {
        fontSize: 14,
    },
});
