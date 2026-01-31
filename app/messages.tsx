import React, { useState, useCallback, useEffect } from 'react';
import {
    StyleSheet,
    View,
    Text,
    FlatList,
    TouchableOpacity,
    Image,
    RefreshControl,
    Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { useSession } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { useLanguage } from '@/context/LanguageContext';
import { SOCIUS_AVATAR_MAP, PROFILE_AVATAR_MAP } from '@/constants/avatars';
import api from '@/services/api';
import DraggableFlatList, { ScaleDecorator, RenderItemParams } from 'react-native-draggable-flatlist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TypingIndicator from '@/components/features/chat/widgets/TypingIndicator';
import { getCachedThreads, cacheThreads, CachedThread } from '@/services/ChatCache';
import { DraggableAppsGrid } from '@/components/features/home/DraggableAppsGrid';
import { stripJsonBlocks } from '@/utils/string';

const APPS_ORDER_KEY = 'user_apps_order_v1';

const DEFAULT_APPS = [
    { id: 'socius', label: 'friends.socius_friend', icon: 'sparkles', color: '#ffc320ff', route: '/socius-friends' },
    { id: 'friends', label: 'friends.user_friend', icon: 'people', color: '#007AFF', route: '/friends' },
    { id: 'bible', label: 'bible.title', icon: 'book', color: '#8D6E63', route: '/bible' },
    { id: 'calories', label: 'calories.title', icon: 'nutrition', color: '#34C759', route: '/calories' },
    { id: 'passwords', label: 'passwords.title', icon: 'key', color: '#5856D6', route: '/passwords' },
    { id: 'notes', label: 'notes.title', icon: 'document-text', color: '#FF9500', route: '/notes' },
    { id: 'diary', label: 'diary.title', icon: 'journal', color: '#FF2D55', route: '/diary' },
    { id: 'workout', label: 'workout.title', icon: 'fitness', color: '#FF3B30', route: '/workout' },
    { id: 'languages', label: 'languages.title', icon: 'globe', color: '#BDB2FF', route: '/languages' },
];

interface ChatThread {
    id: string;
    type: 'user' | 'socius';
    name: string;
    avatar?: string;
    lastMessage?: string;
    lastMessageTime?: string;
    lastMessageIsFromUser?: boolean;  // For Socius threads: true = waiting for response
    unread?: number;
    sociusRole?: string;
    multilingual_selection?: string;
}

const PulseAvatar = ({ children, isTyping }: { children: React.ReactNode, isTyping: boolean }) => {
    return (
        <View>
            {children}
        </View>
    );
};


export default function MessagesScreen() {
    const router = useRouter();
    const { colors } = useTheme();
    const { t, language } = useLanguage();
    const { session } = useSession();
    const { lastNotificationTime, typingThreads, setTyping, friendRequests, refreshNotifications } = useNotifications();
    const [threads, setThreads] = useState<ChatThread[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [apps, setApps] = useState(DEFAULT_APPS);
    const [isTwoRow, setIsTwoRow] = useState(false);

    const loadAppsOrder = async () => {
        try {
            const twoRow = await AsyncStorage.getItem('user_apps_two_row');
            setIsTwoRow(twoRow === 'true');

            const saved = await AsyncStorage.getItem(APPS_ORDER_KEY);
            if (saved) {
                const savedOrder = JSON.parse(saved);
                // Merge with default to ensure new apps appear
                // Get objects for saved order, filtering out any that no longer exist in DEFAULT_APPS
                const savedAppObjects = savedOrder
                    .map((id: string) => DEFAULT_APPS.find(a => a.id === id))
                    .filter((app: typeof DEFAULT_APPS[0] | undefined): app is typeof DEFAULT_APPS[0] => app !== undefined);

                // Identify and append new apps not present in saved order
                const newAppObjects = DEFAULT_APPS.filter(a => !savedOrder.includes(a.id));

                setApps([...savedAppObjects, ...newAppObjects]);
            }
        } catch (error) {
            console.error('Failed to load apps order', error);
        }
    };

    // Load apps order on focus to support immediate update from settings
    useFocusEffect(
        useCallback(() => {
            loadAppsOrder();
        }, [])
    );

    const handleDragEnd = async ({ data }: { data: typeof DEFAULT_APPS }) => {
        setApps(data);
        try {
            const order = data.map(a => a.id);
            await AsyncStorage.setItem(APPS_ORDER_KEY, JSON.stringify(order));
        } catch (error) {
            console.error('Failed to save apps order', error);
        }
    };

    const renderAppItem = ({ item, drag, isActive }: RenderItemParams<typeof DEFAULT_APPS[0]>) => {
        return (
            <ScaleDecorator>
                <TouchableOpacity
                    style={[styles.appItem, { opacity: isActive ? 0.5 : 1 }, isTwoRow && { marginBottom: 6, width: 70 }]}
                    onPress={() => router.push(item.route as any)}
                    onLongPress={drag}
                    disabled={isActive}
                >
                    {item.id === 'socius' ? (
                        <View style={[
                            styles.appIcon,
                            {
                                backgroundColor: 'transparent',
                                shadowColor: item.color,
                                shadowOpacity: 0.25,
                                overflow: 'hidden'
                            }
                        ]}>
                            <Image
                                source={require('../assets/images/socius-rainbow.jpg')}
                                style={{ width: 48, height: 48, position: 'absolute' }}
                            />
                            <Ionicons name={item.icon as any} size={24} color="#fff" />
                        </View>
                    ) : (
                        <View style={[
                            styles.appIcon,
                            {
                                backgroundColor: item.color,
                                shadowColor: item.color,
                                shadowOpacity: 0.25
                            }
                        ]}>
                            <Ionicons name={item.icon as any} size={24} color="#fff" />
                        </View>
                    )}
                    <Text style={[styles.appLabel, { color: colors.text }]} numberOfLines={1}>{t(item.label)}</Text>
                    {item.id === 'friends' && friendRequests > 0 && (
                        <View style={{
                            position: 'absolute',
                            top: 0,
                            right: 9,
                            width: 18,
                            height: 18,
                            borderRadius: 9,
                            backgroundColor: '#FF3B30',
                            justifyContent: 'center',
                            alignItems: 'center',
                            borderWidth: 1.5,
                            borderColor: '#fff'
                        }}>
                            <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>{friendRequests}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </ScaleDecorator >
        );
    };

    const loadThreads = useCallback(async () => {
        // Load cached threads first for instant display
        const cached = await getCachedThreads();
        if (cached.length > 0) {
            setThreads(cached as ChatThread[]);
        }

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
                // Filter to only show Socius companions with actual messages
                const sociusThreads: ChatThread[] = (sociusResponse.data || [])
                    .filter((comp: any) => comp.last_message !== null || (comp.unread_count || 0) > 0)
                    .map((comp: any) => ({
                        id: `socius-${comp.id}`,
                        type: 'socius',
                        name: comp.name,
                        avatar: comp.avatar,
                        lastMessage: comp.last_message,
                        lastMessageTime: comp.last_message_time,
                        lastMessageIsFromUser: comp.last_message_is_from_user,
                        sociusRole: comp.role,
                        multilingual_selection: comp.multilingual_selection,
                        unread: comp.unread_count || 0
                    }));

                // Restore typing indicators for Socius threads where we're waiting for response
                sociusThreads.forEach(thread => {
                    if (thread.lastMessageIsFromUser) {
                        // Last message is from user = still waiting for bot response
                        setTyping(thread.id, true);
                    } else {
                        // Bot has replied, ensure typing is cleared
                        setTyping(thread.id, false);
                    }
                });

                // Combine and sort by last message time (newest first)
                const allThreads = [...sociusThreads, ...userThreads].sort((a, b) => {
                    const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
                    const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
                    return timeB - timeA;
                });

                setThreads(allThreads);
                // Cache the fresh threads
                cacheThreads(allThreads as CachedThread[]);
            } catch (error) {
                console.error('Failed to load socius friends:', error);
                // Fallback to just user threads if socius fails
                setThreads([...userThreads]);
                cacheThreads(userThreads as CachedThread[]);
            }
        } catch (error) {
            console.error('Failed to load threads:', error);
            // Keep cached data if API fails
        }
    }, [setTyping]);

    // Refresh on screen focus
    useFocusEffect(
        useCallback(() => {
            if (session) {
                loadThreads();
                refreshNotifications();
            }
        }, [session, loadThreads, refreshNotifications])
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
        let avatarSource = null;
        const isTyping = typingThreads.has(item.id);

        if (item.type === 'socius') {
            // Socius: use SOCIUS_AVATAR_MAP
            avatarSource = SOCIUS_AVATAR_MAP[item.avatar || 'socius-avatar-0'];
        } else if (item.avatar) {
            // User: check if it's a PROFILE_AVATAR_MAP key, otherwise use as URL
            if (PROFILE_AVATAR_MAP[item.avatar]) {
                avatarSource = PROFILE_AVATAR_MAP[item.avatar];
            } else if (item.avatar.startsWith('http')) {
                avatarSource = { uri: item.avatar };
            }
        }

        return (
            <TouchableOpacity
                style={[styles.threadItem, { borderBottomColor: colors.border }]}
                onPress={() => handleThreadPress(item)}
            >
                <PulseAvatar isTyping={isTyping}>
                    <View style={[
                        styles.avatarContainer,
                        {
                            backgroundColor: item.type === 'socius' ? '#fff' : colors.primary,
                            borderWidth: item.type === 'socius' ? 1 : 0,
                            borderColor: colors.border
                        }
                    ]}>
                        {avatarSource ? (
                            <Image source={avatarSource} style={styles.avatar} />
                        ) : (
                            <Ionicons
                                name={item.type === 'socius' ? 'sparkles' : 'person'}
                                size={24}
                                color={item.type === 'socius' ? colors.primary : "#fff"}
                            />
                        )}
                        {isTyping && (
                            <View style={{
                                position: 'absolute',
                                right: -8,
                                bottom: -4,
                                backgroundColor: colors.card,
                                borderRadius: 10,
                                borderWidth: 1,
                                borderColor: colors.border,
                                padding: 2,
                                elevation: 2,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 1 },
                                shadowOpacity: 0.2,
                                shadowRadius: 1,
                            }}>
                                <TypingIndicator color={colors.primary} />
                            </View>
                        )}
                    </View>
                </PulseAvatar>

                <View style={styles.threadContent}>
                    <View style={styles.threadHeader}>
                        <Text style={[styles.threadName, { color: colors.text }]} numberOfLines={1}>
                            {item.name}
                        </Text>
                        {item.type === 'socius' && item.sociusRole && (
                            <View style={[
                                styles.aiTag,
                                {
                                    backgroundColor: (() => {
                                        const role = item.sociusRole.toLowerCase();
                                        if (role.includes('bible') || role.includes('christian')) return '#8D6E63';
                                        if (role.includes('workout') || role.includes('fitness')) return '#FF3B30';
                                        if (role.includes('diary') || role.includes('journal')) return '#FF2D55';
                                        if (role.includes('calorie') || role.includes('nutrition') || role.includes('diet') || role.includes('tracker')) return '#34C759';
                                        if (role.includes('note')) return '#FF9500';
                                        if (role.includes('password') || role.includes('secret')) return '#5856D6';
                                        if (role.includes('multilingual') || role.includes('language')) return '#BDB2FF';
                                        if (role.includes('casual') || role.includes('romantic') || role.includes('assistant')) return '#ffc320ff';
                                        return '#007AFF'; // Default Socius Blue
                                    })()
                                }
                            ]}>
                                <Text style={styles.aiTagText}>
                                    {t(`setup.roles.${item.sociusRole}`) !== `setup.roles.${item.sociusRole}` ? t(`setup.roles.${item.sociusRole}`) : (item.sociusRole.charAt(0).toUpperCase() + item.sociusRole.slice(1))}
                                    {item.sociusRole === 'multilingual' && item.multilingual_selection && (
                                        (() => {
                                            const flags: Record<string, string> = {
                                                'en': ' 🇺🇸', 'ko': ' 🇰🇷', 'ja': ' 🇯🇵', 'zh': ' 🇨🇳', 'es': ' 🇪🇸', 'fr': ' 🇫🇷', 'de': ' 🇩🇪'
                                            };
                                            return flags[item.multilingual_selection] || '';
                                        })()
                                    )}
                                </Text>
                            </View>
                        )}
                        {item.type === 'user' && (
                            <View style={[styles.aiTag, { backgroundColor: '#007AFF' }]}>
                                <Text style={styles.aiTagText}>
                                    {t('friends.user_friend') || 'User. Friend.'}
                                </Text>
                            </View>
                        )}
                    </View>
                    {isTyping ? (
                        <Text style={[styles.typingText, { color: colors.primary }]}>
                            {t('chat.typing') || 'Socius is typing...'}
                        </Text>
                    ) : (
                        <Text
                            style={[
                                styles.lastMessage,
                                { color: (item.unread || 0) > 0 ? colors.text : colors.textSecondary },
                                (item.unread || 0) > 0 && styles.unreadMessage
                            ]}
                            numberOfLines={1}
                        >
                            {(() => {
                                const msg = item.lastMessage || (language === 'ko' ? '대화를 시작해보세요' : 'Start a conversation');
                                return stripJsonBlocks(msg) || (language === 'ko' ? '메시지를 보냈습니다' : 'Sent a message');
                            })()}
                        </Text>
                    )}
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

    // Replace render logic
    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
            {/* Apps Row (Draggable) */}
            <View style={[styles.appsContainer, isTwoRow && { height: 180 }]}>
                {isTwoRow ? (
                    <DraggableAppsGrid
                        apps={apps}
                        onOrderChange={(data) => handleDragEnd({ data })}
                        onAppPress={(item) => router.push(item.route as any)}
                        badges={{ friends: friendRequests }}
                    />
                ) : (
                    <DraggableFlatList
                        data={apps}
                        onDragEnd={handleDragEnd}
                        keyExtractor={(item) => item.id}
                        renderItem={renderAppItem}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.appsContent}
                    />
                )}
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
        paddingVertical: 10,
        paddingHorizontal: 0,
    },
    appsContent: {
        paddingHorizontal: 16,
        gap: 12,
    },
    appItem: {
        alignItems: 'center',
        width: 60,
    },
    appIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    appLabel: {
        fontSize: 10,
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
    typingText: {
        fontStyle: 'italic',
        fontSize: 14,
        marginTop: 4,
    }
});


