import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, FlatList, TextInput, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { useDebounce } from '../hooks/useDebounce';

type NoteEntry = {
    id: string;
    date: string;
    content: string;
    title?: string;
    created_at: string;
    updated_at: string;
};

export default function NotesScreen() {
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
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    const [isAutosaving, setIsAutosaving] = useState(false);

    const debouncedTitle = useDebounce(editTitle, 1000);
    const debouncedContent = useDebounce(editContent, 1000);

    // Modal states
    const [modalVisible, setModalVisible] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newContent, setNewContent] = useState('');

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

    const handleSaveEntry = async () => {
        if (newContent.trim() === '') return;

        try {
            const today = new Date().toISOString();
            const res = await api.post('/notes', {
                content: newContent,
                title: newTitle.trim() === '' ? 'Untitled' : newTitle,
                date: today
            });

            const updated = [res.data, ...entries];
            setEntries(updated);
            setNewTitle('');
            setNewContent('');
            setModalVisible(false);
        } catch (error) {
            console.error('Failed to save note:', error);
        }
    };

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
        if (editContent.trim() === '') return;

        if (silent) setIsAutosaving(true);
        else setIsSavingEdit(true);

        try {
            const res = await api.put(`/notes/${id}`, {
                content: editContent,
                title: editTitle
            });

            const updated = entries.map(e => e.id === id ? res.data : e);
            setEntries(updated);

            if (!silent) {
                setEditingId(null);
                setEditContent('');
                setEditTitle('');
                setModalVisible(false); // Ensure modal closes
            }
        } catch (error) {
            console.error('Failed to update note:', error);
        } finally {
            if (silent) setIsAutosaving(false);
            else setIsSavingEdit(false);
        }
    };

    // Autosave Effect
    useEffect(() => {
        if (!editingId) return;
        const currentEntry = entries.find(e => e.id === editingId);
        if (!currentEntry) return;

        // Check if changed compared to SAVED entry
        // We use debounced values to determine if we should save
        const titleChanged = (debouncedTitle || '').trim() !== (currentEntry.title || '').trim();
        const contentChanged = debouncedContent.trim() !== currentEntry.content.trim();

        if (titleChanged || contentChanged) {
            saveEdit(editingId, true);
        }
    }, [debouncedTitle, debouncedContent]);

    const renderNoteCard = (item: NoteEntry) => (
        <TouchableOpacity
            key={item.id}
            activeOpacity={0.9}
            onPress={() => startEditing(item)}
            style={[styles.noteCard, { backgroundColor: colors.card, shadowColor: isDark ? '#000' : '#888' }]}
        >
            <Text style={[styles.noteTitle, { color: colors.text }]} numberOfLines={2}>
                {item.title || 'Untitled'}
            </Text>
            <Text style={[styles.notePreview, { color: colors.textSecondary }]} numberOfLines={8}>
                {item.content}
            </Text>
            <Text style={[styles.noteDate, { color: colors.textSecondary }]}>
                {new Date(item.updated_at || item.created_at).toLocaleDateString(language === 'ko' ? 'ko-KR' : 'en-US', { month: 'short', day: 'numeric' })}
            </Text>
        </TouchableOpacity>
    );

    // Split for Masonry Layout
    const leftColumn = filteredEntries.filter((_, i) => i % 2 === 0);
    const rightColumn = filteredEntries.filter((_, i) => i % 2 !== 0);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom', 'left', 'right']}>
            <Stack.Screen options={{ title: t('notes.title') }} />


            <View style={[styles.searchContainer, { marginHorizontal: 16, marginTop: 10, marginBottom: 10, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                <Ionicons name="search" size={20} color={colors.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                    placeholder={t('notes.title_placeholder') || 'Search notes...'} // Recycle placeholder trans or add new
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
                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                        {filteredEntries.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Ionicons name="document-text-outline" size={64} color={colors.textSecondary} style={{ opacity: 0.5 }} />
                                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('notes.no_entries')}</Text>
                            </View>
                        ) : (
                            <View style={styles.masonryContainer}>
                                <View style={styles.column}>
                                    {leftColumn.map(renderNoteCard)}
                                </View>
                                <View style={styles.column}>
                                    {rightColumn.map(renderNoteCard)}
                                </View>
                            </View>
                        )}
                    </ScrollView>
                )
            }

            <TouchableOpacity
                style={[styles.fab, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
                onPress={() => setModalVisible(true)}
            >
                <Ionicons name="add" size={30} color="#fff" />
            </TouchableOpacity>

            {/* Edit/Create Modal */}
            <Modal
                animationType="slide"
                presentationStyle="pageSheet"
                visible={modalVisible || !!editingId}
                onRequestClose={() => {
                    setModalVisible(false);
                    if (editingId) cancelEditing();
                }}
            >
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.background }} keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}>
                    <SafeAreaView style={{ flex: 1 }}>
                        <View style={styles.modalHeaderBar}>
                            <TouchableOpacity onPress={() => {
                                setModalVisible(false);
                                if (editingId) cancelEditing();
                            }}>
                                <Text style={[styles.modalCancel, { color: colors.textSecondary }]}>{t('common.cancel')}</Text>
                            </TouchableOpacity>
                            <Text style={[styles.modalTitleText, { color: colors.text }]}>
                                {editingId ? (isAutosaving ? t('common.saving') || 'Saving...' : t('notes.edit_entry')) : t('notes.new_entry')}
                            </Text>
                            <TouchableOpacity
                                onPress={editingId ? () => saveEdit(editingId, false) : handleSaveEntry}
                                disabled={isSavingEdit}
                            >
                                <Text style={[styles.modalSave, { color: colors.primary }]}>{t('common.save')}</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            <TextInput
                                style={[styles.modalInputTitle, { color: colors.text }]}
                                placeholder={t('notes.title_placeholder')}
                                placeholderTextColor={colors.textSecondary}
                                value={editingId ? editTitle : newTitle}
                                onChangeText={editingId ? setEditTitle : setNewTitle}
                                multiline
                            />
                            <TextInput
                                style={[styles.modalInputContent, { color: colors.text }]}
                                placeholder={t('notes.content_placeholder')}
                                placeholderTextColor={colors.textSecondary}
                                value={editingId ? editContent : newContent}
                                onChangeText={editingId ? setEditContent : setNewContent}
                                multiline
                                textAlignVertical="top"
                            />
                        </ScrollView>
                    </SafeAreaView>
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
    masonryContainer: {
        flexDirection: 'row',
        paddingHorizontal: 8,
    },
    column: {
        flex: 1,
        paddingHorizontal: 4,
    },
    noteCard: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 8,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 2,
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
