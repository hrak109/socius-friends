import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Ionicons } from '@expo/vector-icons';

type PasswordWidgetProps = {
    service: string;
    username: string;
    password: string;
    messageId?: string | number;
    onSaved?: () => void;
};

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

// Global cache for instant feedback
const SAVED_CACHE = new Map<string, boolean>();

export default function PasswordWidget({
    service: initialService,
    username: initialUsername,
    password: initialPassword,
    messageId,
    onSaved
}: PasswordWidgetProps) {
    const { colors } = useTheme();
    const { t } = useLanguage();

    const [loading, setLoading] = useState(false);
    const [saved, setSaved] = useState(false);
    const [service, setService] = useState(initialService || '');
    const [username, setUsername] = useState(initialUsername || '');
    const [password, setPassword] = useState(initialPassword || '');
    const [selectedGroup, setSelectedGroup] = useState('other');
    const [showPassword, setShowPassword] = useState(false);

    // Check persistence
    useEffect(() => {
        const checkStatus = async () => {
            if (!messageId) return;

            // Check memory cache first
            if (SAVED_CACHE.has(String(messageId))) {
                setSaved(true);
                return;
            }

            try {
                const key = `password_saved_${messageId}`;
                const status = await AsyncStorage.getItem(key);
                if (status === 'true') {
                    setSaved(true);
                    SAVED_CACHE.set(String(messageId), true);
                }
            } catch {
                // Ignore
            }
        };
        checkStatus();
    }, [messageId]);

    const handleSave = async () => {
        if (!password.trim()) return;

        setLoading(true);
        try {
            // Load existing accounts
            const existing = await AsyncStorage.getItem(STORAGE_KEY);
            const accounts: PasswordAccount[] = existing ? JSON.parse(existing) : [];

            // Create new account entry
            const newAccount: PasswordAccount = {
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                service: service || 'Unknown',
                username: username || '',
                password: password,
                group: selectedGroup,
                updated_at: Date.now(),
            };

            // Add to accounts and save
            accounts.unshift(newAccount);
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));

            setSaved(true);

            // Persist widget status
            if (messageId) {
                SAVED_CACHE.set(String(messageId), true);
                await AsyncStorage.setItem(`password_saved_${messageId}`, 'true');
            }

            if (onSaved) onSaved();
        } catch (error) {
            console.error('Failed to save password:', error);
        } finally {
            setLoading(false);
        }
    };

    if (saved) {
        return (
            <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.primary }]}>
                <View style={styles.successContent}>
                    <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                    <Text style={[styles.successText, { color: colors.text }]}>
                        {t('passwords.saved') || 'Saved'} {service || 'password'}! 🔐
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.header}>
                <Ionicons name="key" size={20} color={colors.primary} />
                <Text style={[styles.title, { color: colors.text }]}>
                    {t('passwords.save_credentials') || 'Save Credentials'}
                </Text>
            </View>

            {/* Service Input */}
            <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                    {t('passwords.service') || 'Service'}
                </Text>
                <TextInput
                    style={[styles.input, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                    value={service}
                    onChangeText={setService}
                    placeholder={t('passwords.service_placeholder') || 'e.g., Google, Netflix'}
                    placeholderTextColor={colors.textSecondary}
                />
            </View>

            {/* Username Input */}
            <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                    {t('passwords.username') || 'Username / Email'}
                </Text>
                <TextInput
                    style={[styles.input, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                    value={username}
                    onChangeText={setUsername}
                    placeholder={t('passwords.username_placeholder') || 'Enter username or email'}
                    placeholderTextColor={colors.textSecondary}
                    autoCapitalize="none"
                />
            </View>

            {/* Password Input */}
            <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                    {t('passwords.password') || 'Password'}
                </Text>
                <View style={styles.passwordRow}>
                    <TextInput
                        style={[styles.input, styles.passwordInput, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                        value={password}
                        onChangeText={setPassword}
                        placeholder="••••••••"
                        placeholderTextColor={colors.textSecondary}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                    />
                    <TouchableOpacity
                        style={[styles.eyeButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                        onPress={() => setShowPassword(!showPassword)}
                    >
                        <Ionicons
                            name={showPassword ? "eye-off" : "eye"}
                            size={18}
                            color={colors.textSecondary}
                        />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Group Selector */}
            <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                    {t('passwords.category') || 'Category'}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.groupScroll}>
                    {GROUPS.map((g) => (
                        <TouchableOpacity
                            key={g}
                            style={[
                                styles.groupChip,
                                {
                                    backgroundColor: selectedGroup === g ? colors.primary : colors.inputBackground,
                                    borderColor: selectedGroup === g ? colors.primary : colors.border
                                }
                            ]}
                            onPress={() => setSelectedGroup(g)}
                        >
                            <Text style={[
                                styles.groupChipText,
                                { color: selectedGroup === g ? '#fff' : colors.text }
                            ]}>
                                {t(`passwords.group_${g}`) || g.charAt(0).toUpperCase() + g.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Save Button */}
            <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: colors.primary }]}
                onPress={handleSave}
                disabled={loading || !password.trim()}
            >
                {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                ) : (
                    <>
                        <Ionicons name="save" size={18} color="#fff" />
                        <Text style={styles.saveButtonText}>
                            {t('common.save') || 'Save'}
                        </Text>
                    </>
                )}
            </TouchableOpacity>

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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    title: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    inputGroup: {
        marginBottom: 10,
    },
    label: {
        fontSize: 12,
        marginBottom: 4,
    },
    input: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        fontSize: 14,
    },
    passwordRow: {
        flexDirection: 'row',
        gap: 8,
    },
    passwordInput: {
        flex: 1,
    },
    eyeButton: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    groupScroll: {
        flexDirection: 'row',
    },
    groupChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        marginRight: 8,
        borderWidth: 1,
    },
    groupChipText: {
        fontSize: 12,
        fontWeight: '500',
    },
    saveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        borderRadius: 8,
        marginTop: 8,
    },
    saveButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
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
