import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SectionList, Modal, TextInput, Alert, ActivityIndicator, Keyboard, TouchableWithoutFeedback, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import AppSpecificChatHead from '../components/AppSpecificChatHead';

type PasswordAccount = {
    id: string;
    service: string;
    username: string;
    password: string;
    group: string;
    updated_at: number;
};

const STORAGE_KEY = 'user_passwords';
const GROUPS = ['social', 'work', 'personal', 'finance', 'other'];

export default function PasswordsScreen() {
    const { colors, isDark } = useTheme();
    const { t } = useLanguage();
    const [accounts, setAccounts] = useState<PasswordAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());

    // Form State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [service, setService] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [group, setGroup] = useState('other');

    useEffect(() => {
        loadAccounts();
    }, []);

    const loadAccounts = async () => {
        try {
            const saved = await AsyncStorage.getItem(STORAGE_KEY);
            if (saved) {
                setAccounts(JSON.parse(saved));
            }
        } catch (error) {
            console.error('Failed to load passwords', error);
        } finally {
            setLoading(false);
        }
    };

    const saveAccounts = async (newAccounts: PasswordAccount[]) => {
        try {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newAccounts));
            setAccounts(newAccounts);
        } catch (error) {
            console.error('Failed to save passwords', error);
            Alert.alert(t('common.error'), 'Failed to save');
        }
    };

    const handleSave = () => {
        if (!service.trim() || !password.trim()) {
            return;
        }

        const now = Date.now();
        let updatedAccounts = [...accounts];

        if (editingId) {
            // Update existing
            updatedAccounts = updatedAccounts.map(acc =>
                acc.id === editingId
                    ? { ...acc, service, username, password, group, updated_at: now }
                    : acc
            );
        } else {
            // Add new
            const newAccount: PasswordAccount = {
                id: now.toString(),
                service: service.trim(),
                username: username.trim(),
                password: password.trim(),
                group,
                updated_at: now,
            };
            updatedAccounts.push(newAccount);
        }

        saveAccounts(updatedAccounts);
        closeModal();
    };

    const handleDelete = (id: string) => {
        Alert.alert(
            t('common.confirm'),
            t('passwords.delete_confirm'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('passwords.delete'),
                    style: 'destructive',
                    onPress: () => {
                        const updated = accounts.filter(a => a.id !== id);
                        saveAccounts(updated);
                    }
                }
            ]
        );
    };

    const openModal = (account?: PasswordAccount) => {
        if (account) {
            setEditingId(account.id);
            setService(account.service);
            setUsername(account.username);
            setPassword(account.password);
            setGroup(account.group);
        } else {
            setEditingId(null);
            setService('');
            setUsername('');
            setPassword('');
            setGroup('social');
        }
        setModalVisible(true);
    };

    const closeModal = () => {
        setModalVisible(false);
        setEditingId(null);
        setService('');
        setUsername('');
        setPassword('');
    };

    const copyToClipboard = async (text: string, type: 'username' | 'password') => {
        await Clipboard.setStringAsync(text);
        // Could show a toast here if configured, for now just standard behavior
    };

    const toggleVisibility = (id: string) => {
        const newSet = new Set(visiblePasswords);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setVisiblePasswords(newSet);
    };

    const filteredSections = useMemo(() => {
        let filtered = accounts;
        if (searchQuery) {
            const lower = searchQuery.toLowerCase();
            filtered = accounts.filter(a =>
                a.service.toLowerCase().includes(lower) ||
                a.username.toLowerCase().includes(lower)
            );
        }

        // Group by 'group'
        const grouped: { [key: string]: PasswordAccount[] } = {};
        GROUPS.forEach(g => grouped[g] = []);

        filtered.forEach(a => {
            const g = GROUPS.includes(a.group) ? a.group : 'other';
            grouped[g].push(a);
        });

        return GROUPS
            .map(g => ({
                title: t(`passwords.groups.${g}` as any) || g.toUpperCase(),
                data: grouped[g]
            }))
            .filter(section => section.data.length > 0);
    }, [accounts, searchQuery, t]);

    const renderItem = ({ item }: { item: PasswordAccount }) => {
        const isVisible = visiblePasswords.has(item.id);

        return (
            <TouchableOpacity
                style={[styles.itemContainer, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
                onPress={() => openModal(item)}
                onLongPress={() => handleDelete(item.id)}
            >
                <View style={styles.itemIcon}>
                    {/* Placeholder icon based on group or generic */}
                    <View style={[styles.iconCircle, { backgroundColor: isDark ? '#333' : '#f0f0f0' }]}>
                        <Text style={[styles.iconText, { color: colors.primary }]}>
                            {item.service.charAt(0).toUpperCase()}
                        </Text>
                    </View>
                </View>

                <View style={styles.itemContent}>
                    <Text style={[styles.itemService, { color: colors.text }]}>{item.service}</Text>
                    {!!item.username && (
                        <TouchableOpacity onPress={(e) => {
                            e.stopPropagation();
                            copyToClipboard(item.username, 'username');
                        }}>
                            <Text style={[styles.itemUsername, { color: colors.textSecondary }]}>{item.username}</Text>
                        </TouchableOpacity>
                    )}
                    <View style={styles.passwordRow}>
                        <Text style={[styles.itemPassword, { color: colors.textSecondary }]}>
                            {isVisible ? item.password : '••••••••••••'}
                        </Text>
                        <View style={styles.actions}>
                            <TouchableOpacity onPress={(e) => {
                                e.stopPropagation();
                                toggleVisibility(item.id);
                            }}>
                                <Ionicons name={isVisible ? "eye-off" : "eye"} size={20} color={colors.textSecondary} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={(e) => {
                                e.stopPropagation();
                                copyToClipboard(item.password, 'password');
                            }} style={{ marginLeft: 12 }}>
                                <Ionicons name="copy-outline" size={20} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                <Ionicons name="chevron-forward" size={20} color={colors.border} />
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
            <Stack.Screen options={{ title: t('passwords.title') }} />

            {/* Search Bar */}
            <View style={[styles.searchContainer, { borderBottomColor: colors.border }]}>
                <View style={[styles.searchBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#f0f0f0' }]}>
                    <Ionicons name="search" size={20} color={colors.textSecondary} />
                    <TextInput
                        style={[styles.searchInput, { color: colors.text }]}
                        placeholder={t('passwords.search_placeholder')}
                        placeholderTextColor={colors.textSecondary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
            ) : (
                <SectionList
                    sections={filteredSections}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
                    renderSectionHeader={({ section: { title } }) => (
                        <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
                            <Text style={[styles.sectionHeaderText, { color: colors.textSecondary }]}>{title}</Text>
                        </View>
                    )}
                    contentContainerStyle={styles.listContent}
                    stickySectionHeadersEnabled={false}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="key-outline" size={48} color={colors.textSecondary} />
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('passwords.no_accounts')}</Text>
                        </View>
                    }
                />
            )}

            {/* FAB */}
            <TouchableOpacity
                style={[styles.fab, { backgroundColor: colors.primary }]}
                onPress={() => openModal()}
            >
                <Ionicons name="add" size={30} color="#fff" />
            </TouchableOpacity>

            {/* Add/Edit Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={closeModal}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={{ flex: 1 }}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
                >
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                        <View style={styles.modalOverlay}>
                            <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                                <View style={styles.modalHeader}>
                                    <Text style={[styles.modalTitle, { color: colors.text }]}>
                                        {editingId ? t('passwords.edit_account') : t('passwords.add_account')}
                                    </Text>
                                    <TouchableOpacity onPress={closeModal}>
                                        <Ionicons name="close" size={24} color={colors.textSecondary} />
                                    </TouchableOpacity>
                                </View>

                                <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                                    <Text style={[styles.label, { color: colors.textSecondary }]}>{t('passwords.service_placeholder')}</Text>
                                    <TextInput
                                        style={[styles.input, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#f5f5f5', color: colors.text, borderColor: colors.border }]}
                                        value={service}
                                        onChangeText={setService}
                                        placeholder="Netflix"
                                        placeholderTextColor={colors.textSecondary}
                                    />

                                    <Text style={[styles.label, { color: colors.textSecondary }]}>{t('passwords.username_placeholder')}</Text>
                                    <TextInput
                                        style={[styles.input, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#f5f5f5', color: colors.text, borderColor: colors.border }]}
                                        value={username}
                                        onChangeText={setUsername}
                                        autoCapitalize="none"
                                        placeholder="user@example.com"
                                        placeholderTextColor={colors.textSecondary}
                                    />

                                    <Text style={[styles.label, { color: colors.textSecondary }]}>{t('passwords.password_placeholder')}</Text>
                                    <TextInput
                                        style={[styles.input, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#f5f5f5', color: colors.text, borderColor: colors.border }]}
                                        value={password}
                                        onChangeText={setPassword}
                                        secureTextEntry={false}
                                        placeholder="********"
                                        placeholderTextColor={colors.textSecondary}
                                    />

                                    <Text style={[styles.label, { color: colors.textSecondary }]}>{t('passwords.group_label')}</Text>
                                    <View style={styles.groupContainer}>
                                        {GROUPS.map(g => (
                                            <TouchableOpacity
                                                key={g}
                                                style={[
                                                    styles.groupChip,
                                                    { backgroundColor: group === g ? colors.primary : (isDark ? '#333' : '#f0f0f0') }
                                                ]}
                                                onPress={() => setGroup(g)}
                                            >
                                                <Text style={[
                                                    styles.groupText,
                                                    { color: group === g ? '#fff' : colors.text }
                                                ]}>
                                                    {t(`passwords.groups.${g}` as any) || g}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    <TouchableOpacity
                                        style={[styles.saveButton, { backgroundColor: colors.primary }]}
                                        onPress={handleSave}
                                    >
                                        <Text style={styles.saveButtonText}>{t('common.save')}</Text>
                                    </TouchableOpacity>
                                </ScrollView>
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </KeyboardAvoidingView>
            </Modal>

            {/* Secrets Friend Chat Head */}
            <AppSpecificChatHead roleType="secrets" appContext="passwords" />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    searchContainer: {
        padding: 16,
        paddingTop: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        height: 40,
        borderRadius: 10,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 16,
        height: '100%',
    },
    listContent: {
        paddingBottom: 80,
    },
    sectionHeader: {
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    sectionHeaderText: {
        fontSize: 13,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    itemIcon: {
        marginRight: 16,
    },
    iconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconText: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    itemContent: {
        flex: 1,
        marginRight: 10,
    },
    itemService: {
        fontSize: 17,
        fontWeight: '600',
        marginBottom: 2,
    },
    itemUsername: {
        fontSize: 14,
        marginBottom: 4,
    },
    passwordRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    itemPassword: {
        fontSize: 14,
        fontFamily: 'monospace', // Monospace helps with dots alignment
        flex: 1,
    },
    actions: {
        flexDirection: 'row',
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
        shadowColor: "#000",
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
        maxHeight: '90%',
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
    label: {
        fontSize: 13,
        fontWeight: '500',
        marginBottom: 8,
        marginTop: 12,
    },
    input: {
        height: 50,
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 16,
        borderWidth: 1,
    },
    groupContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 4,
    },
    groupChip: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
    },
    groupText: {
        fontSize: 14,
        fontWeight: '500',
    },
    saveButton: {
        height: 50,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 24,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
