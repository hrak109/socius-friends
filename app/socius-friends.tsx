import React, { useState, useCallback } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    FlatList,
    Image,
    RefreshControl,
    Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import api from '../services/api';
import { SOCIUS_AVATAR_MAP } from '../constants/avatars';

interface SociusFriend {
    id: string;
    name: string;
    avatar: string;
    role: string;
}

export default function SociusManagerScreen() {
    const router = useRouter();
    const { colors } = useTheme();
    const { t } = useLanguage();

    const [friends, setFriends] = useState<SociusFriend[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadFriends = useCallback(async () => {
        try {
            const response = await api.get('/friends/socius');
            setFriends(response.data || []);
        } catch (error) {
            console.error('Failed to load socius friends:', error);
            Alert.alert(t('common.error'), 'Failed to load list');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [t]);

    useFocusEffect(
        useCallback(() => {
            loadFriends();
        }, [loadFriends])
    );

    const onRefresh = () => {
        setRefreshing(true);
        loadFriends();
    };

    const handleCreateNew = () => {
        router.push('/socius-setup');
    };

    const handleChat = (friend: SociusFriend) => {
        router.push({
            pathname: '/chat/[id]',
            params: {
                id: `socius-${friend.id}`, // Ensure distinctive ID prefix if needed, usually just friend.id if internal logic handles it. 
                // MessagesScreen uses `socius-${comp.id}`. Protocol: socius IDs are integers in DB? 
                // Chat screen expects 'socius-ID' or just ID?
                // MessagesScreen: id: `socius-${comp.id}`, type: 'socius'.
                // Chat [id].tsx: parses ID.
                // Let's stick to consistent `socius-${id}` ID for routing to Chat to avoid collision with user IDs.
                type: 'socius',
                name: friend.name,
                avatar: friend.avatar,
                sociusRole: friend.role
            }
        });
    };

    // Function to confirm and delete a Socius friend could be added here
    // For now, minimal scope as requested: List + Add Button.

    const renderItem = ({ item }: { item: SociusFriend }) => {
        const roleLabel = t(`setup.roles.${item.role}`);
        const displayRole = roleLabel.startsWith('setup.roles.') ? item.role : roleLabel;
        const avatarSource = SOCIUS_AVATAR_MAP[item.avatar] || SOCIUS_AVATAR_MAP['socius-avatar-0'];

        return (
            <TouchableOpacity
                style={[styles.friendItem, { backgroundColor: colors.card, shadowColor: colors.shadow }]}
                onPress={() => handleChat(item)}
            >
                <View style={styles.avatarContainer}>
                    <Image source={avatarSource} style={styles.avatar} />
                </View>
                <View style={styles.infoContainer}>
                    <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
                    <Text style={[styles.role, { color: colors.textSecondary }]}>{displayRole}</Text>
                </View>
                <Ionicons name="chatbubble-ellipses-outline" size={24} color={colors.primary} />
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
            <Stack.Screen options={{ title: t('friends.my_socius') }} />

            <FlatList
                data={friends}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                ListEmptyComponent={
                    !loading ? (
                        <View style={styles.emptyContainer}>
                            <View style={[styles.emptyIconContainer, { backgroundColor: colors.card }]}>
                                <Ionicons name="sparkles-outline" size={48} color={colors.primary} />
                            </View>
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                {t('friends.no_socius')}
                            </Text>
                        </View>
                    ) : null
                }
            />

            <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
                <TouchableOpacity
                    style={[styles.createButton, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
                    onPress={handleCreateNew}
                >
                    <Ionicons name="add" size={24} color="#fff" />
                    <Text style={styles.createButtonText}>{t('friends.create_new')}</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    listContent: {
        padding: 20,
        paddingBottom: 100,
    },
    friendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    avatarContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#f0f0f0',
        overflow: 'hidden',
    },
    avatar: {
        width: 50,
        height: 50,
    },
    infoContainer: {
        flex: 1,
        marginLeft: 16,
    },
    name: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    role: {
        fontSize: 14,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 60,
    },
    emptyIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    emptyText: {
        fontSize: 16,
        textAlign: 'center',
    },
    footer: {
        padding: 20,
        borderTopWidth: StyleSheet.hairlineWidth,
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
    createButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 16,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
        gap: 8,
    },
    createButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
