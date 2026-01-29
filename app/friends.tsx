import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, FlatList, TextInput, Image, Modal, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useNotifications } from '@/context/NotificationContext';
import { useLanguage } from '@/context/LanguageContext';
import { useRouter, Stack } from 'expo-router';
import api from '@/services/api';
import { PROFILE_AVATAR_MAP } from '@/constants/avatars';

type FriendItem = {
    id: number;
    friend_id: number;
    friend_username: string;
    friend_avatar?: string;
    status: string;
};

type UserSearchResult = {
    id: number;
    username: string;
    email: string;
    custom_avatar_url?: string;
};

export default function FriendsScreen() {
    const router = useRouter();
    const { colors } = useTheme();
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<'friends' | 'requests'>('friends');
    const [friends, setFriends] = useState<FriendItem[]>([]);
    const [requests, setRequests] = useState<FriendItem[]>([]);

    const { refreshNotifications } = useNotifications();

    // UI state
    const [isAddModalVisible, setIsAddModalVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const getAvatarSource = (avatar: string | undefined | null) => {
        if (!avatar) return null;
        if (PROFILE_AVATAR_MAP[avatar]) return PROFILE_AVATAR_MAP[avatar];
        if (avatar.startsWith('http')) return { uri: avatar };
        return { uri: `${api.defaults.baseURL?.replace('/api/socius', '')}${avatar}` };
    };

    const fetchFriends = async () => {
        try {
            const res = await api.get('/friends');
            setFriends(res.data);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchRequests = async () => {
        try {
            const res = await api.get('/friends/requests');
            setRequests(res.data);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        fetchFriends();
        fetchRequests();
    }, []);

    const handleSearchUsers = async (query: string) => {
        setSearchQuery(query);
        if (query.length < 3) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            const res = await api.get('/users/search', { params: { q: query } });
            setSearchResults(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSearching(false);
        }
    };

    const sendRequest = async (username: string) => {
        try {
            await api.post('/friends/request', { username });
            Alert.alert(t('common.success'), `Friend request sent to ${username}`);
            setSearchQuery('');
            setSearchResults([]);
            setIsAddModalVisible(false);
        } catch (error: any) {
            Alert.alert(t('common.error'), error.response?.data?.detail || 'Failed to send request');
        }
    };

    const acceptRequest = async (id: number) => {
        try {
            await api.post(`/friends/respond/${id}`, { action: 'accept' });
            fetchRequests();
            fetchFriends();
            refreshNotifications();
        } catch (error) {
            console.error(error);
        }
    };

    const rejectRequest = async (id: number) => {
        try {
            await api.post(`/friends/respond/${id}`, { action: 'reject' });
            fetchRequests();
            refreshNotifications();
        } catch (error) {
            console.error(error);
        }
    };

    const unfriend = async (friendId: number) => {
        Alert.alert(
            t('friends.unfriend_title'),
            t('friends.unfriend_message'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('friends.remove'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            // Fetch messages to clear unread count (marks as read)
                            await api.get(`/messages/${friendId}`);
                            await api.delete(`/friends/${friendId}`);
                            fetchFriends();
                            refreshNotifications();
                        } catch (error) {
                            console.error(error);
                        }
                    }
                }
            ]
        );
    };

    const renderFriendItem = ({ item }: { item: FriendItem }) => (
        <View style={[styles.friendCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {item.friend_avatar && getAvatarSource(item.friend_avatar) ? (
                <Image
                    source={getAvatarSource(item.friend_avatar)}
                    style={styles.listAvatar}
                />
            ) : (
                <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarInitials}>{item.friend_username.charAt(0).toUpperCase()}</Text>
                </View>
            )}
            <View style={styles.friendInfo}>
                <Text style={[styles.friendName, { color: colors.text }]}>{item.friend_username}</Text>
            </View>
            <View style={styles.actionButtons}>
                <TouchableOpacity style={[styles.actionBtn, styles.chatBtn]} onPress={() => router.push({ pathname: '/chat/[id]', params: { id: `user-${item.friend_id}`, type: 'user', name: item.friend_username, avatar: item.friend_avatar || '' } } as any)}>
                    <Ionicons name="chatbubble-outline" size={20} color="#1a73e8" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={() => unfriend(item.friend_id)}>
                    <Ionicons name="trash-outline" size={20} color="#dc3545" />
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderRequestItem = ({ item }: { item: FriendItem }) => (
        <View style={[styles.friendCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {item.friend_avatar && getAvatarSource(item.friend_avatar) ? (
                <Image
                    source={getAvatarSource(item.friend_avatar)}
                    style={styles.listAvatar}
                />
            ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: colors.inputBackground }]}>
                    <Text style={[styles.avatarInitials, { color: colors.primary }]}>{item.friend_username.charAt(0).toUpperCase()}</Text>
                </View>
            )}
            <View style={styles.friendInfo}>
                <Text style={[styles.friendName, { color: colors.text }]}>{item.friend_username}</Text>
                <Text style={[styles.usernameText, { color: colors.textSecondary }]}>{t('friends.sent_request')}</Text>
            </View>
            <View style={styles.actionButtons}>
                <TouchableOpacity style={[styles.actionBtn, styles.acceptBtn]} onPress={() => acceptRequest(item.id)}>
                    <Ionicons name="checkmark" size={20} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn, { borderColor: colors.border, backgroundColor: colors.background }]} onPress={() => rejectRequest(item.id)}>
                    <Ionicons name="close" size={20} color="#dc3545" />
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['left', 'right']}>
            <Stack.Screen
                options={{
                    headerRight: () => (
                        <TouchableOpacity onPress={() => setIsAddModalVisible(true)} style={{ marginRight: 10 }}>
                            <Ionicons name="person-add" size={24} color={colors.primary} />
                        </TouchableOpacity>
                    ),
                    title: t('friends.title')
                }}
            />
            {/* Custom Header Removed */}

            <View style={styles.tabContainer}>
                <View style={[styles.tabPillContainer, { backgroundColor: colors.inputBackground }]}>
                    <TouchableOpacity
                        style={[styles.tabButton, activeTab === 'friends' && { backgroundColor: colors.primary, shadowColor: colors.shadow }]}
                        onPress={() => setActiveTab('friends')}
                    >
                        <Text style={[styles.tabText, { color: colors.text }, activeTab === 'friends' && { color: colors.buttonText }]}>{t('friends.my_friends')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tabButton, activeTab === 'requests' && { backgroundColor: colors.primary, shadowColor: colors.shadow }]}
                        onPress={() => setActiveTab('requests')}
                    >
                        <Text style={[styles.tabText, { color: colors.text }, activeTab === 'requests' && { color: colors.buttonText }]}>
                            {t('friends.requests')} {requests.length > 0 && <Text style={{ color: activeTab === 'requests' ? colors.buttonText : colors.error }}>({requests.length})</Text>}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            <FlatList
                data={activeTab === 'friends' ? friends : requests}
                renderItem={activeTab === 'friends' ? renderFriendItem : renderRequestItem}
                keyExtractor={item => item.id.toString()}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                            {activeTab === 'friends' ? t('friends.no_friends') : t('friends.no_requests')}
                        </Text>
                    </View>
                }
            />

            <Modal
                visible={isAddModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setIsAddModalVisible(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={{ flex: 1 }}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
                >
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalContent, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
                            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                                <Text style={[styles.modalTitle, { color: colors.text }]}>{t('friends.add_friend')}</Text>
                                <TouchableOpacity onPress={() => setIsAddModalVisible(false)}>
                                    <Ionicons name="close" size={24} color={colors.text} />
                                </TouchableOpacity>
                            </View>
                            <TextInput
                                style={[styles.modalInput, { backgroundColor: colors.inputBackground, color: colors.text }]}
                                placeholder={t('friends.search_placeholder')}
                                placeholderTextColor={colors.textSecondary}
                                value={searchQuery}
                                onChangeText={handleSearchUsers}
                                autoCapitalize="none"
                            />

                            {isSearching ? (
                                <ActivityIndicator size="small" color={colors.primary} />
                            ) : (
                                <FlatList
                                    data={searchResults}
                                    keyExtractor={item => item.id.toString()}
                                    style={{ maxHeight: 200 }}
                                    keyboardShouldPersistTaps="handled"
                                    renderItem={({ item }) => (
                                        <View style={[styles.searchItem, { borderBottomColor: colors.border }]}>
                                            {item.custom_avatar_url && getAvatarSource(item.custom_avatar_url) ? (
                                                <Image
                                                    source={getAvatarSource(item.custom_avatar_url)}
                                                    style={[styles.listAvatar, { marginRight: 10, width: 40, height: 40, borderRadius: 20 }]}
                                                />
                                            ) : null}
                                            <View style={styles.searchInfo}>
                                                <Text style={[styles.friendName, { color: colors.text }]}>{item.username}</Text>
                                            </View>
                                            <TouchableOpacity
                                                style={[styles.addButton, { backgroundColor: colors.primary }]}
                                                onPress={() => sendRequest(item.username)}
                                            >
                                                <Text style={[styles.addButtonText, { color: colors.buttonText }]}>{t('friends.add')}</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                />
                            )}

                            <View style={styles.modalButtons}>
                                <TouchableOpacity onPress={() => setIsAddModalVisible(false)} style={[styles.closeButton, { backgroundColor: colors.inputBackground }]}>
                                    <Text style={[styles.closeButtonText, { color: colors.text }]}>{t('friends.close')}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f0f2f5',
    },
    // header styles removed
    tabContainer: {
        paddingVertical: 5, // Reduced from 10
        paddingHorizontal: 20,
        borderBottomWidth: 0, // Removed border
        borderBottomColor: '#f0f0f0',
    },
    tabPillContainer: {
        flexDirection: 'row',
        backgroundColor: '#f5f5f5',
        borderRadius: 25,
        padding: 4,
    },
    tabButton: {
        flex: 1,
        paddingVertical: 8, // Reduced from 10
        alignItems: 'center',
        borderRadius: 20,
    },
    activeTab: {
        backgroundColor: '#1a73e8',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
    },
    activeTabText: {
        color: '#fff',
    },
    listContent: {
        padding: 20,
        paddingBottom: 20, // Reduced from 100
    },
    friendCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderRadius: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
        borderWidth: 1,
    },
    avatarPlaceholder: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    listAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        marginRight: 15,
    },
    avatarInitials: {
        fontSize: 20,
        fontWeight: '700',
    },
    friendInfo: {
        flex: 1,
    },
    friendName: {
        fontSize: 16,
        fontWeight: '600',
    },
    usernameText: {
        fontSize: 13,
        marginTop: 2,
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    actionBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    chatBtn: {
        backgroundColor: '#e8f0fe',
    },
    deleteBtn: {
        backgroundColor: '#ffebee',
    },
    acceptBtn: {
        backgroundColor: '#4caf50',
    },
    rejectBtn: {
        backgroundColor: '#f5f5f5',
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 50,
    },
    emptyText: {
        color: '#999',
        fontSize: 16,
    },
    fab: {
        position: 'absolute',
        bottom: 30,
        right: 20,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#1a73e8',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#1a73e8',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 24,
        maxHeight: '80%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
        borderBottomWidth: 1,
        paddingBottom: 15,
        borderBottomColor: '#f0f0f0',
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 20,
        textAlign: 'center',
        color: '#1a1a1a',
    },
    modalInput: {
        backgroundColor: '#f5f5f5',
        borderRadius: 12,
        padding: 15,
        fontSize: 16,
        marginBottom: 15,
        color: '#333',
    },
    searchItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    searchInfo: {
        flex: 1,
    },
    addButton: {
        backgroundColor: '#1a73e8',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    addButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },
    modalButtons: {
        marginTop: 20,
        alignItems: 'center',
    },
    closeButton: {
        padding: 10,
    },
    closeButtonText: {
        color: '#666',
        fontSize: 16,
        fontWeight: '500',
    },
});
