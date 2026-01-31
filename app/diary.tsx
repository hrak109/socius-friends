import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, FlatList, TextInput, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, ScrollView, Alert, Keyboard } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import api from '@/services/api';
import { useLanguage } from '@/context/LanguageContext';
import { useDebounce } from '@/hooks/useDebounce';

type DiaryEntry = {
    id: string;
    date: string;
    content: string;
    title?: string;
    created_at: string;
};

export default function DiaryScreen() {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();
    const { t, language } = useLanguage();
    const [entries, setEntries] = useState<DiaryEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Edit States
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');
    const [editTitle, setEditTitle] = useState('');
    const [isAutosaving, setIsAutosaving] = useState(false);

    const debouncedTitle = useDebounce(editTitle, 500);
    const debouncedContent = useDebounce(editContent, 500);

    // Modal States
    const [modalVisible, setModalVisible] = useState(false);
    const [isKeyboardVisible, setKeyboardVisible] = useState(false);

    useEffect(() => {
        const showSubscription = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
        const hideSubscription = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false));
        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, []);


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



    const cancelEditing = () => {
        setEditingId(null);
        setEditContent('');
        setEditTitle('');
    };

    const saveEdit = async (id: string, silent: boolean = false) => {
        if (editContent.trim() === '' && editTitle.trim() === '') return;

        if (silent) setIsAutosaving(true);

        try {
            const res = await api.put(`/diary/${id}`, {
                content: editContent,
                title: editTitle.trim() === '' ? undefined : editTitle
            });
            setEntries(entries.map(e => e.id === id ? res.data : e));

            if (!silent) {
                setModalVisible(false); // Close on manual save if needed, but we rely on autosave mostly
            }
        } catch (error) {
            console.error('Failed to update diary entry:', error);
        } finally {
            if (silent) setIsAutosaving(false);
        }
    };

    const createEntry = async () => {
        if (editContent.trim() === '' && editTitle.trim() === '') return;
        setIsAutosaving(true);
        try {
            const today = new Date().toISOString();
            const res = await api.post('/diary', {
                content: editContent,
                title: editTitle.trim() === '' ? undefined : editTitle,
                date: today
            });

            const newDiary = res.data;
            setEditingId(newDiary.id);
            setEntries(prev => [newDiary, ...prev]);
        } catch (error) {
            console.error('Failed to create diary entry:', error);
        } finally {
            setIsAutosaving(false);
        }
    };

    // Autosave Effect
    useEffect(() => {
        if (!modalVisible && !editingId) return;

        if (editingId) {
            const currentEntry = entries.find(e => e.id === editingId);
            if (!currentEntry) return;

            const titleChanged = (debouncedTitle || '').trim() !== (currentEntry.title || '').trim();
            const contentChanged = debouncedContent.trim() !== currentEntry.content.trim();

            if (titleChanged || contentChanged) {
                saveEdit(editingId, true);
            }
        } else {
            // New entry creation
            if (debouncedContent.trim() !== '' || debouncedTitle.trim() !== '') {
                createEntry();
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedTitle, debouncedContent]);

    const renderTimelineItem = ({ item, index }: { item: DiaryEntry; index: number }) => {
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
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => {
                                // Open full screen modal for editing
                                setEditingId(item.id);
                                setEditContent(item.content);
                                setEditTitle(item.title || '');
                                setModalVisible(true);
                            }}
                            onLongPress={() => {
                                Alert.alert(
                                    t('common.delete'),
                                    t('common.delete_confirm'),
                                    [
                                        { text: t('common.cancel'), style: 'cancel' },
                                        {
                                            text: t('common.delete'),
                                            style: 'destructive',
                                            onPress: async () => {
                                                try {
                                                    await api.delete(`/diary/${item.id}`);
                                                    setEntries(entries.filter(e => e.id !== item.id));
                                                } catch (error) {
                                                    console.error('Failed to delete diary entry:', error);
                                                    Alert.alert(t('common.error'), t('common.delete_failed') || 'Failed to delete');
                                                }
                                            }
                                        }
                                    ]
                                );
                            }}
                        >
                            <View style={styles.cardHeader}>
                                {item.title ? (
                                    <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                                        {item.title}
                                    </Text>
                                ) : (
                                    <View style={{ flex: 1 }} />
                                )}
                            </View>
                            <Text style={[styles.cardContent, { color: colors.textSecondary }]} numberOfLines={4}>
                                {item.content}
                            </Text>
                            <Text style={[styles.cardTime, { color: colors.textSecondary }]}>
                                {dateObj.toLocaleTimeString(language === 'ko' ? 'ko-KR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View >
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom', 'left', 'right']}>
            <Stack.Screen options={{
                title: t('diary.title'),
                headerRight: () => (
                    <TouchableOpacity onPress={() => {
                        setEditingId(null);
                        setEditTitle('');
                        setEditContent('');
                        setModalVisible(true);
                    }} style={{ paddingRight: 8 }}>
                        <Ionicons name="add-circle" size={28} color={colors.primary} />
                    </TouchableOpacity>
                ),
            }} />

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



            {/* Modal - Full Screen Edit */}
            <Modal
                animationType="slide"
                presentationStyle="fullScreen"
                visible={modalVisible}
                statusBarTranslucent={true}
                onRequestClose={() => {
                    if (Platform.OS === 'android' && isKeyboardVisible) {
                        Keyboard.dismiss();
                    } else {
                        setModalVisible(false);
                        if (editingId) cancelEditing();
                    }
                }}
            >
                <KeyboardAvoidingView
                    behavior="padding"
                    style={{ flex: 1, backgroundColor: colors.background }}
                    keyboardVerticalOffset={Platform.OS === 'android' ? 64 : 0}
                >
                    <View style={{ flex: 1, paddingTop: insets.top }}>
                        <View style={styles.modalHeaderBar}>
                            <TouchableOpacity
                                onPress={() => {
                                    setModalVisible(false);
                                    if (editingId) cancelEditing();
                                }}
                                style={{ flexDirection: 'row', alignItems: 'center' }}
                            >
                                <Ionicons name="chevron-back" size={24} color={colors.text} />
                                <Text style={[styles.modalCancel, { color: colors.text, marginLeft: 4 }]}>{t('common.back')}</Text>
                            </TouchableOpacity>
                            <Text style={[styles.modalTitleText, { color: colors.text }]}>
                                {editingId ? (isAutosaving ? t('common.saving') : t('common.saving_complete')) : t('diary.new_entry')}
                            </Text>
                            {/* Hidden Spacer for alignment */}
                            <View style={{ width: 60 }} />
                        </View>

                        <ScrollView style={styles.modalBody}>
                            <TextInput
                                style={[styles.modalInputTitle, { color: colors.text, borderBottomColor: colors.border }]}
                                placeholder={t('diary.title_placeholder')}
                                placeholderTextColor={colors.textSecondary}
                                value={editTitle}
                                onChangeText={setEditTitle}
                            />
                            <TextInput
                                style={[styles.modalInputContent, { color: colors.text }]}
                                placeholder={t('diary.content_placeholder')}
                                placeholderTextColor={colors.textSecondary}
                                multiline
                                textAlignVertical="top"
                                value={editContent}
                                onChangeText={setEditContent}
                                scrollEnabled={false} // Let parent ScrollView handle it
                            />
                            {/* Add bottom padding for keyboard */}
                            <View style={{ height: 100 }} />
                        </ScrollView>
                    </View>

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
