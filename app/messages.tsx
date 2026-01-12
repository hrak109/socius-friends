import React, { useState, useCallback } from 'react';
import {
    StyleSheet,
    View,
    Text,
    FlatList,
    TouchableOpacity,
    Image,
    RefreshControl,
    ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { useSession } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useLanguage } from '../context/LanguageContext';
import { SOCIUS_AVATAR_MAP } from '../constants/avatars';
import api from '../services/api';

interface ChatThread {
    id: string;
    type: 'user' | 'socius';
    name: string;
    avatar?: string;
    lastMessage?: string;
    lastMessageTime?: string;
    unread?: number;
    sociusRole?: string;
}

export default function MessagesScreen() {
    const router = useRouter();
    const { colors } = useTheme();
    const { t } = useLanguage();
    const { session } = useSession();
    const { lastNotificationTime } = useNotifications();
    const [threads, setThreads] = useState<ChatThread[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    const loadThreads = useCallback(async () => {
        try {
            // Load real user chats
            const dmResponse = await api.get('/messages/recent');
            const userThreads: ChatThread[] = (dmResponse.data || []).map((conv: any) => ({
                id: `user-${conv.friend_id}`,
                type: 'user',
                name: conv.friend_display_name || conv.friend_username,
                avatar: conv.friend_avatar,
                lastMessage: conv.last_message,
                lastMessageTime: conv.last_message_time,
                unread: conv.unread_count || 0,
            }));

            // Load Socius AI friends from API
            try {
                const sociusResponse = await api.get('/friends/socius');
                const sociusThreads: ChatThread[] = (sociusResponse.data || []).map((comp: any) => ({
                    id: `socius-${comp.id}`,
                    type: 'socius',
                    name: comp.name,
                    avatar: comp.avatar,
                    lastMessage: comp.last_message || "Nice to meet you!",
                    lastMessageTime: comp.last_message_time,
                    sociusRole: comp.role,
                    unread: comp.unread_count || 0
                }));

                // Combine and sort by last message time (newest first)
                const allThreads = [...sociusThreads, ...userThreads].sort((a, b) => {
                    const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
                    const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
                    return timeB - timeA;
                });

                setThreads(allThreads);
            } catch (error) {
                console.error('Failed to load socius friends:', error);
                // Fallback to just user threads if socius fails
                setThreads([...userThreads]);
            }
        } catch (error) {
            console.error('Failed to load threads:', error);
        }
    }, []);

    // Refresh on screen focus
    useFocusEffect(
        useCallback(() => {
            if (session) {
                loadThreads();
            }
        }, [session, loadThreads])
    );

    // Refresh when new notification arrives via SSE
    useFocusEffect(
        useCallback(() => {
            if (lastNotificationTime) {
                loadThreads();
            }
        }, [lastNotificationTime, loadThreads])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await loadThreads();
        setRefreshing(false);
    };

    const handleThreadPress = (thread: ChatThread) => {
        router.push({
            pathname: '/chat/[id]',
            params: {
                id: thread.id,
                type: thread.type,
                name: thread.name,
                avatar: thread.avatar || '',
                sociusRole: thread.sociusRole || '',
            },
        });
    };

    const renderThread = ({ item }: { item: ChatThread }) => {
        const avatarSource = item.type === 'socius'
            ? SOCIUS_AVATAR_MAP[item.avatar || 'socius-avatar-0']
            : item.avatar
                ? { uri: item.avatar }
                : null;

        return (
            <TouchableOpacity
                style={[styles.threadItem, { borderBottomColor: colors.border }]}
                onPress={() => handleThreadPress(item)}
            >
                <View style={[styles.avatarContainer, { backgroundColor: colors.primary }]}>
                    {avatarSource ? (
                        <Image source={avatarSource} style={styles.avatar} />
                    ) : (
                        <Ionicons
                            name={item.type === 'socius' ? 'sparkles' : 'person'}
                            size={24}
                            color="#fff"
                        />
                    )}
                </View>

                <View style={styles.threadContent}>
                    <View style={styles.threadHeader}>
                        <Text style={[styles.threadName, { color: colors.text }]} numberOfLines={1}>
                            {item.name}
                        </Text>
                        {item.type === 'socius' && (
                            <View style={[styles.aiTag, { backgroundColor: colors.primary }]}>
                                <Text style={styles.aiTagText}>
                                    {t('chat.socius')} {item.sociusRole ? `• ${t(`setup.roles.${item.sociusRole}`) !== `setup.roles.${item.sociusRole}` ? t(`setup.roles.${item.sociusRole}`) : (item.sociusRole.charAt(0).toUpperCase() + item.sociusRole.slice(1))}` : ''}
                                </Text>
                            </View>
                        )}
                    </View>
                    <Text
                        style={[
                            styles.lastMessage,
                            { color: (item.unread || 0) > 0 ? colors.text : colors.textSecondary },
                            (item.unread || 0) > 0 && styles.unreadMessage
                        ]}
                        numberOfLines={1}
                    >
                        {item.lastMessage || 'Start a conversation'}
                    </Text>
                </View>

                {
                    (item.unread || 0) > 0 && (
                        <View style={[styles.unreadBadge, { backgroundColor: '#FF3B30' }]}>
                            <Text style={styles.unreadText}>{item.unread}</Text>
                        </View>
                    )
                }
            </TouchableOpacity >
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
            {/* Apps Row (Horizontal Scroll) */}
            <View style={styles.appsContainer}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.appsContent}
                >
                    <TouchableOpacity
                        style={styles.appItem}
                        onPress={() => router.push('/socius-friends')}
                    >
                        <View style={[styles.appIcon, { backgroundColor: '#007AFF', shadowColor: '#007AFF', shadowOpacity: 0.25 }]}>
                            <Ionicons name="sparkles" size={30} color="#fff" />
                        </View>
                        <Text style={[styles.appLabel, { color: colors.text }]}>{t('friends.socius_friend')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.appItem}
                        onPress={() => router.push('/friends')}
                    >
                        <View style={[styles.appIcon, { backgroundColor: '#34C759', shadowColor: '#34C759', shadowOpacity: 0.25 }]}>
                            <Ionicons name="people" size={30} color="#fff" />
                        </View>
                        <Text style={[styles.appLabel, { color: colors.text }]}>{t('friends.title')}</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>

            {/* Threads List */}
            <FlatList
                data={threads}
                keyExtractor={(item) => item.id}
                renderItem={renderThread}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="chatbubbles-outline" size={64} color={colors.textSecondary} />
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                            {t('messages.no_messages')}
                        </Text>
                        <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                            {t('messages.start_chat')}
                        </Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    appsContainer: {
        paddingVertical: 15,
        paddingHorizontal: 0,
    },
    appsContent: {
        paddingHorizontal: 20,
        gap: 20,
    },
    appItem: {
        alignItems: 'center',
        width: 70,
    },
    appIcon: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 5,
    },
    appLabel: {
        fontSize: 12,
        fontWeight: '500',
        textAlign: 'center',
    },
    threadItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    avatarContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    avatar: {
        width: 50,
        height: 50,
    },
    threadContent: {
        flex: 1,
        marginLeft: 12,
    },
    threadHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    threadName: {
        fontSize: 16,
        fontWeight: '600',
    },
    aiTag: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    aiTagText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    lastMessage: {
        fontSize: 14,
        marginTop: 4,
    },
    unreadMessage: {
        fontWeight: 'bold',
    },
    unreadBadge: {
        minWidth: 22,
        height: 22,
        borderRadius: 11,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
    },
    unreadText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 100,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        marginTop: 16,
    },
    emptySubtext: {
        fontSize: 14,
        marginTop: 8,
    },
});
