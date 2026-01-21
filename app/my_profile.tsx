import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Image, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../services/api';
import { useSession } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useUserProfile } from '../context/UserProfileContext';
import { PROFILE_AVATARS } from '../constants/avatars';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

export default function ProfileScreen() {
    const router = useRouter();
    const { signOut } = useSession();
    const { colors } = useTheme();
    const { t } = useLanguage();
    const { displayName, displayAvatar, username: contextUsername, updateProfile } = useUserProfile();

    // Edit state
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const [editUsername, setEditUsername] = useState('');
    const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
    const [username, setUsername] = useState<string | null>(null);

    // Google Data
    const [googlePhoto, setGooglePhoto] = useState<string | null>(null);
    const [googleName, setGoogleName] = useState<string | null>(null);
    const [email, setEmail] = useState('');


    useEffect(() => {
        loadGoogleProfile();
        // Initialize from Context
        if (displayName) setEditName(displayName);

        if (displayAvatar && displayAvatar !== 'google') {
            setSelectedAvatar(displayAvatar);
        } else if (displayAvatar === 'google') {
            setSelectedAvatar('google');
        } else {
            // Default for new accounts or if not set
            setSelectedAvatar('google');
        }

        if (contextUsername) {
            setUsername(contextUsername);
            setEditUsername(contextUsername);
        }
    }, [displayName, displayAvatar, contextUsername]);

    const loadGoogleProfile = async () => {
        try {
            const currentUser = await GoogleSignin.getCurrentUser();
            if (currentUser?.user) {
                setGooglePhoto(currentUser.user.photo);
                setGoogleName(currentUser.user.name);
                setEmail(currentUser.user.email);
            }
        } catch (error) {
            console.error('Failed to load google profile', error);
        }
    };

    const loadBackendProfile = async () => {
        try {
            const res = await api.get('/users/me');
            if (res.data.username) {
                setUsername(res.data.username);
                setEditUsername(res.data.username);
            }

        } catch {

        }
    };

    useEffect(() => {
        loadBackendProfile();
    }, []);



    const handleSave = async () => {
        if (!editName.trim()) {
            Alert.alert(t('common.error'), t('profile.name_empty'));
            return;
        }

        try {
            // Update Context & Backend via single call (supports username)
            await updateProfile(editName, selectedAvatar || 'user-1', editUsername);

            setUsername(editUsername);
            setIsEditing(false);
            Alert.alert(t('common.success'), t('profile.profile_updated'));
        } catch (error: any) {
            Alert.alert(t('common.error'), error.response?.data?.detail || t('profile.profile_update_failed'));
        }
    };

    const handleSignOut = async () => {
        Alert.alert(
            t('settings.sign_out'),
            t('settings.sign_out_confirm'), // Uses correct key
            [
                { text: t('common.cancel'), style: "cancel" },
                {
                    text: t('settings.sign_out'),
                    style: "destructive",
                    onPress: async () => {
                        await signOut();
                        router.replace('/');
                    }
                }
            ]
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom', 'left', 'right']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
            >
                <ScrollView contentContainerStyle={styles.content}>
                    <View style={[styles.card, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
                        {/* Editable Socius Profile Section */}
                        <Text style={[styles.sectionHeader, { color: colors.text }]}>{t('profile.public_profile')}</Text>

                        <View style={styles.avatarContainer}>
                            {selectedAvatar === 'google' && googlePhoto ? (
                                <Image source={{ uri: googlePhoto }} style={styles.avatar} />
                            ) : selectedAvatar && PROFILE_AVATARS.find(a => a.id === selectedAvatar) ? (
                                <Image source={PROFILE_AVATARS.find(a => a.id === selectedAvatar)?.source} style={styles.avatar} />
                            ) : (
                                <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
                                    <Text style={styles.avatarInitials}>{editName?.charAt(0) || googleName?.charAt(0) || 'U'}</Text>
                                </View>
                            )}
                            <TouchableOpacity style={[styles.editAvatarBtn, { backgroundColor: colors.primary }]} onPress={() => setIsEditing(!isEditing)}>
                                <Ionicons name="pencil" size={16} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        {isEditing ? (
                            <View style={styles.editContainer}>
                                <Text style={[styles.label, { color: colors.textSecondary }]}>{t('profile.display_name')}</Text>
                                <TextInput
                                    style={[styles.input, { color: colors.text, backgroundColor: colors.inputBackground || colors.background, borderColor: colors.primary }]}
                                    value={editName}
                                    onChangeText={setEditName}
                                    placeholder={t('profile.edit_display_name_placeholder')}
                                    placeholderTextColor={colors.textSecondary}
                                />

                                <Text style={[styles.label, { color: colors.textSecondary, marginTop: 15 }]}>{t('profile.user_id')}</Text>
                                <TextInput
                                    style={[styles.input, { color: colors.text, backgroundColor: colors.inputBackground || colors.background, borderColor: colors.primary }]}
                                    value={editUsername}
                                    onChangeText={setEditUsername}
                                    placeholder={t('profile.edit_user_id_placeholder')}
                                    placeholderTextColor={colors.textSecondary}
                                    autoCapitalize="none"
                                />

                                <Text style={[styles.label, { color: colors.textSecondary, marginTop: 15 }]}>{t('profile.choose_avatar')}</Text>
                                <View style={styles.avatarGrid}>
                                    {googlePhoto && (
                                        <TouchableOpacity
                                            onPress={() => setSelectedAvatar('google')}
                                            style={[styles.avatarOption, selectedAvatar === 'google' && { borderColor: colors.primary, borderWidth: 2 }]}
                                        >
                                            <Image source={{ uri: googlePhoto }} style={styles.avatarOptionImg} />
                                        </TouchableOpacity>
                                    )}
                                    {PROFILE_AVATARS.map((avatar) => (
                                        <TouchableOpacity
                                            key={avatar.id}
                                            onPress={() => setSelectedAvatar(avatar.id)}
                                            style={[styles.avatarOption, selectedAvatar === avatar.id && { borderColor: colors.primary, borderWidth: 2 }]}
                                        >
                                            <Image source={avatar.source} style={styles.avatarOptionImg} />
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <View style={styles.buttonRow}>
                                    <TouchableOpacity style={[styles.actionSaveButton, { backgroundColor: colors.primary }]} onPress={handleSave}>
                                        <Text style={styles.buttonText}>{t('common.save')}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.actionCancelButton, { backgroundColor: colors.border }]} onPress={() => { setIsEditing(false); setEditName(displayName || googleName || ''); setEditUsername(username || ''); }}>
                                        <Text style={styles.buttonText}>{t('common.cancel')}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <View style={{ alignItems: 'center' }}>
                                <Text style={[styles.name, { color: colors.text }]}>{displayName || googleName || 'User'}</Text>
                                {username && <Text style={[styles.username, { color: colors.textSecondary }]}>@{username}</Text>}
                                <TouchableOpacity onPress={() => setIsEditing(true)}>
                                    <Text style={{ color: colors.primary, marginTop: 5 }}>{t('profile.edit_profile')}</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        <View style={[styles.divider, { backgroundColor: colors.border, marginVertical: 20 }]} />

                        {/* Read-Only Google Info */}
                        <Text style={[styles.sectionHeader, { color: colors.text, marginBottom: 15 }]}>{t('profile.google_account')}</Text>
                        <View style={styles.googleInfoRow}>
                            {googlePhoto && <Image source={{ uri: googlePhoto }} style={styles.googleAvatar} />}
                            <View>
                                <Text style={[styles.googleName, { color: colors.text }]}>{googleName}</Text>
                                <Text style={[styles.email, { color: colors.textSecondary }]}>{email}</Text>
                            </View>
                        </View>


                    </View>


                    <TouchableOpacity
                        style={[styles.signOutButton, { backgroundColor: colors.card, shadowColor: colors.shadow }]}
                        onPress={handleSignOut}
                    >
                        <Ionicons name="log-out-outline" size={24} color={'#FF3B30'} style={{ marginRight: 10 }} />
                        <Text style={[styles.signOutText, { color: '#FF3B30' }]}>{t('settings.sign_out')}</Text>
                    </TouchableOpacity>

                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        padding: 20,
    },
    card: {
        borderRadius: 20,
        padding: 25,
        alignItems: 'center',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
        marginBottom: 20,
    },
    avatarContainer: {
        position: 'relative',
        marginBottom: 15,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
    },
    avatarPlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarInitials: {
        fontSize: 40,
        color: '#fff',
        fontWeight: 'bold',
    },
    cameraButtonDisabled: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#ccc', // Disabled look
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
    },
    name: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    username: {
        fontSize: 16,
        marginBottom: 10,
    },
    email: {
        fontSize: 16,
        marginBottom: 20,
    },
    divider: {
        height: 1,
        width: '100%',
        marginBottom: 20,
    },
    section: {
        width: '100%',
        marginBottom: 10,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 15,
        borderRadius: 12,
    },
    infoText: {
        fontSize: 18,
        fontWeight: '500',
    },
    editIcon: {
        padding: 5,
    },
    editRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    input: {
        flex: 1,
        paddingHorizontal: 15,
        paddingVertical: 12,
        borderRadius: 12,
        fontSize: 16,
        borderWidth: 1,
        marginRight: 0,
        width: '100%',
    },
    saveButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    cancelButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    signOutButton: {
        flexDirection: 'row',
        padding: 18,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 2,
    },
    signOutText: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    sectionHeader: {
        fontSize: 18,
        fontWeight: 'bold',
        alignSelf: 'flex-start',
        marginBottom: 10,
    },
    editAvatarBtn: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 30,
        height: 30,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#fff',
    },
    editContainer: {
        width: '100%',
    },
    avatarGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        justifyContent: 'center',
        marginVertical: 10,
    },
    avatarOption: {
        padding: 2,
        borderRadius: 25,
    },
    avatarOptionImg: {
        width: 50,
        height: 50,
        borderRadius: 25,
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 15,
        gap: 10,
    },
    buttonText: {
        color: '#fff',
        fontWeight: '600',
    },
    actionSaveButton: {
        flex: 1,
        padding: 12,
        borderRadius: 10,
        alignItems: 'center',
    },
    actionCancelButton: {
        flex: 1,
        padding: 12,
        borderRadius: 10,
        alignItems: 'center',
    },
    googleInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        backgroundColor: 'rgba(0,0,0,0.05)',
        padding: 10,
        borderRadius: 10,
    },
    googleAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 10,
    },
    googleName: {
        fontWeight: '600',
        fontSize: 16,
    },
    uploadRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
    },
    customAvatarPreview: {
        width: 60,
        height: 60,
        borderRadius: 30,
    },
    uploadButtons: {
        flex: 1,
        flexDirection: 'row',
        gap: 10,
    },
    uploadBtn: {
        padding: 10,
        borderRadius: 8,
        alignItems: 'center',
        flex: 1.5,
    },
    removeBtn: {
        padding: 10,
        borderRadius: 8,
        alignItems: 'center',
        flex: 1,
    },
});
