import { StyleSheet, View, Text, TouchableOpacity, TextInput, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, Alert, Keyboard, ScrollView, Dimensions } from 'react-native';
import { DraggableNoteGrid } from '../components/features/notes/DraggableNoteGrid';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import api from '@/services/api';
import { useLanguage } from '@/context/LanguageContext';
import { useDebounce } from '@/hooks/useDebounce';
import { useState, useEffect, useRef } from 'react';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 40) / 2; // 16px side margins + 8px gap

type NoteEntry = {
    id: string;
    date: string;
    content: string;
    title?: string;
    position: number;
    created_at: string;
    updated_at: string;
};

export default function NotesScreen() {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();
    const { t, language } = useLanguage();
    const [entries, setEntries] = useState<NoteEntry[]>([]);
    const [filteredEntries, setFilteredEntries] = useState<NoteEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Editing states
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');
    const [editTitle, setEditTitle] = useState('');
    const [isAutosaving, setIsAutosaving] = useState(false);

    // Ref to track if we are currently creating a note to prevent duplicates
    const isCreatingRef = useRef(false);

    const debouncedTitle = useDebounce(editTitle, 200);
    const debouncedContent = useDebounce(editContent, 200);

    // Modal states
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
            const res = await api.get('/notes');
            setEntries(res.data);
            setFilteredEntries(res.data);
        } catch (error) {
            console.error('Failed to fetch notes:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchEntries();
    }, []);

    useEffect(() => {
        if (searchQuery.trim() === '') {
            setFilteredEntries(entries);
        } else {
            const query = searchQuery.toLowerCase();
            const filtered = entries.filter(entry =>
                (entry.title && entry.title.toLowerCase().includes(query)) ||
                entry.content.toLowerCase().includes(query)
            );
            setFilteredEntries(filtered);
        }
    }, [searchQuery, entries]);


    const startEditing = (entry: NoteEntry) => {
        setEditingId(entry.id);
        setEditContent(entry.content);
        setEditTitle(entry.title || '');
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditContent('');
        setEditTitle('');
    };

    const saveEdit = async (id: string, silent: boolean = false) => {
        if (editContent.trim() === '' && editTitle.trim() === '') return;

        if (silent) setIsAutosaving(true);

        try {
            const res = await api.put(`/notes/${id}`, {
                content: editContent,
                title: editTitle
            });

            const updated = entries.map((e: NoteEntry) => e.id === id ? res.data : e);
            setEntries(updated);

            if (!silent) {
                setModalVisible(false); // Close modal on save completion if not silent
            }
        } catch (error) {
            console.error('Failed to update note:', error);
        } finally {
            if (silent) setIsAutosaving(false);
        }
    };

    const createEntry = async () => {
        if (editContent.trim() === '' && editTitle.trim() === '') return;

        // Prevent duplicate creation if already creating
        if (isCreatingRef.current) return;
        isCreatingRef.current = true;

        setIsAutosaving(true);
        try {
            const today = new Date().toISOString();
            const res = await api.post('/notes', {
                content: editContent,
                title: editTitle.trim() === '' ? (t('common.untitled') || 'Untitled') : editTitle,
                date: today
            });

            const newNote = res.data;
            setEditingId(newNote.id);
            setEntries((prev: NoteEntry[]) => [newNote, ...prev]);
        } catch (error) {
            console.error('Failed to create note:', error);
        } finally {
            setIsAutosaving(false);
            isCreatingRef.current = false;
        }
    };

    // Autosave Effect
    useEffect(() => {
        if (!modalVisible && !editingId) return;

        // If currently creating, skip this effect run to avoid concurrency
        if (isCreatingRef.current) return;

        if (editingId) {
            const currentEntry = entries.find((e: NoteEntry) => e.id === editingId);
            if (!currentEntry) return;

            const titleChanged = (debouncedTitle || '') !== (currentEntry.title || '');
            const contentChanged = debouncedContent !== currentEntry.content;

            if (titleChanged || contentChanged) {
                saveEdit(editingId, true);
            }
        } else {
            // New entry creation
            if (debouncedContent !== '' || debouncedTitle !== '') {
                createEntry();
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedTitle, debouncedContent]);

    const handleReorder = async (newData: NoteEntry[]) => {
        setEntries(newData);
        try {
            await api.put('/notes/reorder', {
                note_ids: newData.map(n => parseInt(n.id))
            });
        } catch (error) {
            console.error('Failed to sync note order:', error);
            Alert.alert(t('common.error'), 'Failed to save note order');
        }
    };

    const handleDelete = (note: NoteEntry) => {
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
                            await api.delete(`/notes/${note.id}`);
                            // Optimistic update
                            const newEntries = entries.filter(e => e.id !== note.id);
                            setEntries(newEntries);
                            // Also update filtered if needed, but effect might handle it? 
                            // Effect depends on [searchQuery, entries], so updating entries triggers effect.
                        } catch (error) {
                            console.error('Failed to delete note:', error);
                            Alert.alert(t('common.error'), 'Failed to delete note');
                        }
                    }
                }
            ]
        );
    };

    const renderNoteItem = (item: NoteEntry) => (
        <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => startEditing(item)}
            style={[
                styles.noteCard,
                {
                    backgroundColor: colors.card,
                    shadowColor: isDark ? '#000' : '#888',
                }
            ]}
        >
            <View style={styles.noteHeader}>
                <Text style={[styles.noteTitle, { color: colors.text, flex: 1 }]} numberOfLines={2}>
                    {item.title || (t('common.untitled') || 'Untitled')}
                </Text>
                <Ionicons name="menu" size={20} color={colors.textSecondary} style={{ opacity: 0.5 }} />
            </View>
            <Text style={[styles.notePreview, { color: colors.textSecondary }]} numberOfLines={4}>
                {item.content}
            </Text>
            <View style={styles.noteFooter}>
                <Text style={[styles.noteDate, { color: colors.textSecondary }]}>
                    {new Date(item.updated_at || item.created_at).toLocaleDateString(language === 'ko' ? 'ko-KR' : 'en-US', { month: 'short', day: 'numeric' })}
                </Text>
            </View>
        </TouchableOpacity>
    );


    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom', 'left', 'right']}>
            <Stack.Screen options={{
                title: t('notes.title'),
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


            <View style={[styles.searchContainer, { marginHorizontal: 16, marginTop: 10, marginBottom: 10, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                <Ionicons name="search" size={20} color={colors.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                    placeholder={t('common.search') || 'Search...'}
                    placeholderTextColor={colors.textSecondary}
                    style={[styles.searchInput, { color: colors.text }]}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                )}
            </View>

            {
                isLoading ? (
                    <View style={[styles.center, { backgroundColor: colors.background }]}>
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                ) : (
                    <DraggableNoteGrid
                        data={filteredEntries}
                        onOrderChange={handleReorder}
                        renderItem={renderNoteItem}
                        onDelete={handleDelete}
                        contentContainerStyle={styles.scrollContent}
                        ListEmptyComponent={
                            <View style={styles.emptyState}>
                                <Ionicons name="document-text-outline" size={64} color={colors.textSecondary} style={{ opacity: 0.5 }} />
                                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('notes.no_entries')}</Text>
                            </View>
                        }
                    />
                )
            }



            {/* Edit/Create Modal */}
            <Modal
                animationType="slide"
                presentationStyle="fullScreen"
                visible={modalVisible || !!editingId}
                onRequestClose={() => {
                    if (Platform.OS === 'android' && isKeyboardVisible) {
                        Keyboard.dismiss();
                    } else {
                        setModalVisible(false);
                        if (editingId) cancelEditing();
                    }
                }}
            >
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
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
                            <Text style={[styles.modalTitleText, { color: colors.text, flex: 1, textAlign: 'center' }]}>
                                {editingId ? (isAutosaving ? t('common.saving') : t('common.saving_complete')) : t('notes.new_entry')}
                            </Text>
                            <View style={{ width: 60 }} />
                        </View>

                        <ScrollView style={styles.modalBody}>
                            <TextInput
                                style={[styles.modalInputTitle, { color: colors.text }]}
                                placeholder={t('notes.title_placeholder')}
                                placeholderTextColor={colors.textSecondary}
                                value={editTitle}
                                onChangeText={setEditTitle}
                                multiline
                            />
                            <TextInput
                                style={[styles.modalInputContent, { color: colors.text }]}
                                placeholder={t('notes.content_placeholder')}
                                placeholderTextColor={colors.textSecondary}
                                value={editContent}
                                onChangeText={setEditContent}
                                multiline
                                textAlignVertical="top"
                                scrollEnabled={false}
                            />
                            <View style={{ height: 100 }} />
                        </ScrollView>

                    </View>

                </KeyboardAvoidingView>
            </Modal>

        </SafeAreaView >
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
    header: {
        paddingHorizontal: 16,
        paddingBottom: 10,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
        marginTop: 10,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 16,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
    },
    scrollContent: {
        paddingTop: 10,
        paddingBottom: 100,
    },
    noteCard: {
        borderRadius: 16,
        padding: 16,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 2,
        width: COLUMN_WIDTH,
        height: 180, // Fixed height for equal-sized grid
        backgroundColor: '#fff', // Safety default
    },
    columnWrapper: {
        paddingHorizontal: 16,
        justifyContent: 'space-between',
    },
    noteHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    noteFooter: {
        marginTop: 'auto', // Push footer to the bottom of the fixed-height card
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    noteTitle: {
        fontSize: 17,
        fontWeight: '700',
        marginBottom: 8,
        lineHeight: 22,
    },
    notePreview: {
        fontSize: 15,
        lineHeight: 21,
        marginBottom: 12,
        opacity: 0.9,
    },
    noteDate: {
        fontSize: 12,
        fontWeight: '500',
        opacity: 0.6,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 80,
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
    modalCancel: {
        fontSize: 17,
    },
    modalSave: {
        fontSize: 17,
        fontWeight: '600',
    },
    modalTitleText: {
        fontSize: 17,
        fontWeight: '600',
    },
    modalBody: {
        flex: 1,
        padding: 24,
    },
    modalInputTitle: {
        fontSize: 28,
        fontWeight: '800',
        marginBottom: 20,
    },
    modalInputContent: {
        fontSize: 18,
        lineHeight: 28,
        minHeight: 200,
    },
});
