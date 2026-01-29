
import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Image, RefreshControl } from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import api from '@/services/api';
import { SOCIUS_AVATAR_MAP } from '@/constants/avatars';

const { width } = Dimensions.get('window');

const FLAGS: Record<string, string> = {
    'en': '🇺🇸', 'ko': '🇰🇷', 'ja': '🇯🇵', 'zh': '🇨🇳', 'es': '🇪🇸', 'fr': '🇫🇷', 'de': '🇩🇪'
};

const LANG_NAMES: Record<string, string> = {
    'en': 'English', 'ko': 'Korean', 'ja': 'Japanese', 'zh': 'Chinese', 'es': 'Spanish', 'fr': 'French', 'de': 'German'
};

const SAMPLE_WORDS: Record<string, { word: string, phonetic: string, definitions: Record<string, string> }> = {
    'en': { word: 'Serendipity', phonetic: '/ˌser.ənˈdɪp.ə.ti/', definitions: { en: 'The occurrence of events by chance in a happy way.', ko: '뜻밖의(좋은) 발견, 운수 좋은 뜻밖의 해후.' } },
    'ko': { word: '눈치 (Nunchi)', phonetic: '/nun.tɕʰi/', definitions: { en: 'The subtle art of gauging moods.', ko: '남의 마음을 그때그때 상황으로 미루어 알아내는 것.' } },
    'ja': { word: '木漏れ日 (Komorebi)', phonetic: '/ko.mo.re.bi/', definitions: { en: 'Sunlight filtering through trees.', ko: '나뭇잎 사이로 비치는 햇살.' } },
    'zh': { word: '加油 (Jiāyóu)', phonetic: '/tɕi̯á.i̯ǒu̯/', definitions: { en: 'Add oil! (You can do it)', ko: '화이팅! (힘내라)' } },
    'es': { word: 'Sobremesa', phonetic: '/so.bɾeˈme.sa/', definitions: { en: 'Time spent conversing at the table after a meal.', ko: '식사 후 테이블에서 이야기하며 보내는 시간.' } },
    'fr': { word: 'Flâneur', phonetic: '/flɑnœʀ/', definitions: { en: 'A stroller who observes the city.', ko: '도시를 관찰하며 거니는 산책자.' } },
    'de': { word: 'Fernweh', phonetic: '/ˈfɛrnveː/', definitions: { en: 'Aching for far-off places.', ko: '먼 곳에 대한 동경/향수.' } }
};

interface MultilingualFriend {
    id: number;
    name: string;
    avatar: string;
    role: string;
    multilingual_selection: string;
    last_message: string;
    last_message_time: string;
}

export default function LanguagesApp() {
    const { colors } = useTheme();
    const { t, language: userLang } = useLanguage();
    const router = useRouter();
    const [friends, setFriends] = useState<MultilingualFriend[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [wordIndex, setWordIndex] = useState(0); // For skipping words

    const ACCENT_COLOR = '#C7C7CC';
    const TEXT_ACCENT = '#8E8E93';

    const loadFriends = useCallback(async () => {
        try {
            const response = await api.get('/friends/socius');
            const allFriends = response.data || [];
            const multilingual = allFriends.filter((f: any) => f.role === 'multilingual');
            setFriends(multilingual);
        } catch (error) {
            console.error('Failed to load language friends', error);
        } finally {
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadFriends();
        }, [loadFriends])
    );

    const onRefresh = () => {
        setRefreshing(true);
        loadFriends();
    };

    // Stats Computation (Conversations count)
    const stats = useMemo(() => {
        const counts: Record<string, number> = {};
        friends.forEach(f => {
            // Only count if there is a message history (active conversation)
            // If checking 'active' conversations, simply counting the threads (friends with messages)
            // But since get(/friends/socius) returns all friends, some might have last_message as null.
            // My loading logic already keeps all.
            // Let's assume count = 1 per friend for "conversation count" metric requested by user
            // "count of conversation count" -> Number of active threads per language.
            const lang = f.multilingual_selection || 'en';
            if (f.last_message) {
                counts[lang] = (counts[lang] || 0) + 1;
            } else {
                // Even if empty, it's a "conversation channel"
                counts[lang] = (counts[lang] || 0) + 1;
            }
        });
        return counts;
    }, [friends]);

    const activeLanguages = Object.keys(stats);

    // Word of the Day Selection
    const wordOfDay = useMemo(() => {
        if (activeLanguages.length === 0) return { ...SAMPLE_WORDS['en'], definition: SAMPLE_WORDS['en'].definitions[userLang as 'en' | 'ko'] || SAMPLE_WORDS['en'].definitions['en'] };

        // Use wordIndex to cycle or pick random deterministic
        // To make it truly random on load but skippable:
        const langKeys = activeLanguages;
        // Simple deterministic rotation based on index
        const langKey = langKeys[wordIndex % langKeys.length];
        const wordData = SAMPLE_WORDS[langKey] || SAMPLE_WORDS['en'];

        return {
            ...wordData,
            definition: wordData.definitions[userLang as 'en' | 'ko'] || wordData.definitions['en']  // Translate definition
        };
    }, [activeLanguages, wordIndex, userLang]);

    const handleSkipWord = () => {
        setWordIndex(prev => prev + 1);
    };

    const handleChatPress = (friend: MultilingualFriend) => {
        router.push({
            pathname: '/chat/[id]',
            params: {
                id: `socius-${friend.id}`,
                type: 'socius',
                name: friend.name,
                avatar: friend.avatar || '',
                sociusRole: 'multilingual',
            },
        });
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom', 'left', 'right']}>
            <Stack.Screen
                options={{
                    title: t('languages.title'),
                    headerStyle: { backgroundColor: colors.background },
                    headerTintColor: colors.text,
                    headerShadowVisible: false,
                }}
            />

            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >

                {/* Dashboard / Stats */}
                <View style={[styles.section, styles.statsContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 12 }]}>
                        {t('languages.my_languages') || 'My Languages'}
                    </Text>
                    <View style={styles.statsGrid}>
                        {activeLanguages.length > 0 ? activeLanguages.map(lang => (
                            <View key={lang} style={[styles.statBadge, { backgroundColor: colors.inputBackground }]}>
                                <Text style={styles.statFlag}>{FLAGS[lang] || '🇺🇸'}</Text>
                                <Text style={[styles.statName, { color: colors.text }]}>{LANG_NAMES[lang] || lang.toUpperCase()}</Text>
                                <View style={[styles.statCountBadge, { backgroundColor: colors.primary }]}>
                                    <Text style={styles.statCount}>{stats[lang]}</Text>
                                </View>
                            </View>
                        )) : (
                            <Text style={{ color: colors.textSecondary }}>{t('languages.no_languages') || 'No languages configured yet.'}</Text>
                        )}
                    </View>
                </View>

                {/* Word of the Day Banner */}
                <View style={[styles.section, styles.bannerContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.bannerHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="sunny" size={20} color="#FFD60A" />
                            <Text style={[styles.sectionTitle, { color: colors.text, marginLeft: 8 }]}>
                                {t('languages.word_of_day')}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={handleSkipWord}>
                            <Ionicons name="refresh" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.wordContent}>
                        <Text style={[styles.wordText, { color: colors.text }]}>{wordOfDay.word}</Text>
                        <Text style={[styles.phoneticText, { color: TEXT_ACCENT }]}>{wordOfDay.phonetic}</Text>
                        <Text style={[styles.definitionText, { color: colors.textSecondary }]}>{wordOfDay.definition}</Text>
                    </View>
                </View>

                {/* Conversations Section */}
                <View style={styles.section}>
                    <Text style={[styles.sectionHeader, { color: colors.text }]}>{t('languages.conversations')}</Text>

                    {friends.length > 0 ? friends.map((friend) => (
                        <TouchableOpacity
                            key={friend.id}
                            style={[styles.chatItem, { backgroundColor: colors.card, borderColor: colors.border }]}
                            onPress={() => handleChatPress(friend)}
                        >
                            <View style={[styles.avatarContainer, { borderColor: colors.border }]}>
                                <Image
                                    source={SOCIUS_AVATAR_MAP[friend.avatar || 'socius-avatar-0']}
                                    style={styles.avatar}
                                />
                                <View style={styles.flagOverlay}>
                                    <Text style={styles.flagEmoji}>
                                        {FLAGS[friend.multilingual_selection] || ''}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.chatInfo}>
                                <Text style={[styles.chatName, { color: colors.text }]}>{friend.name}</Text>
                                <Text style={[styles.chatMessage, { color: colors.textSecondary }]} numberOfLines={1}>
                                    {friend.last_message || t('messages.start_chat')}
                                </Text>
                            </View>

                            <TouchableOpacity
                                style={[styles.chatButton, { backgroundColor: colors.primary }]}
                                onPress={() => handleChatPress(friend)}
                            >
                                <Ionicons name="chatbubble" size={16} color="#FFF" />
                                <Text style={styles.chatButtonText}>{t('common.chat') || 'Chat'}</Text>
                            </TouchableOpacity>
                        </TouchableOpacity>
                    )) : (
                        <View style={styles.emptyContainer}>
                            <Text style={{ color: colors.textSecondary }}>
                                {t('languages.no_conversations') || 'No language friends yet.\nGo to Setup to create one!'}
                            </Text>
                        </View>
                    )}

                    <TouchableOpacity
                        style={[styles.newChatButton, { backgroundColor: ACCENT_COLOR }]}
                        onPress={() => router.push({ pathname: '/socius-setup', params: { role: 'multilingual' } })}
                    >
                        <Ionicons name="add" size={24} color="#FFF" />
                        <Text style={styles.newChatText}>{t('languages.start_chat')}</Text>
                    </TouchableOpacity>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: 16,
    },
    section: {
        marginBottom: 24,
    },
    sectionHeader: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
    },
    // Stats
    statsContainer: {
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    statBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 20,
        gap: 6,
    },
    statFlag: {
        fontSize: 16,
    },
    statName: {
        fontSize: 14,
        fontWeight: '500',
    },
    statCountBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
        minWidth: 20,
        alignItems: 'center',
    },
    statCount: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    // Banner
    bannerContainer: {
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        // Shadow for premium feel
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    bannerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    wordContent: {
        alignItems: 'center',
        paddingVertical: 10,
    },
    wordText: {
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 4,
        textAlign: 'center',
    },
    phoneticText: {
        fontSize: 16,
        marginBottom: 12,
        fontStyle: 'italic',
        textAlign: 'center',
    },
    definitionText: {
        textAlign: 'center',
        fontSize: 14,
        lineHeight: 20,
    },
    // Tools
    toolsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    toolCard: {
        width: (width - 48) / 3,
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
        borderWidth: 1,
        aspectRatio: 1,
        justifyContent: 'center',
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    toolLabel: {
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
    },
    // Chat List
    chatItem: {
        flexDirection: 'row',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
        marginBottom: 10,
    },
    avatarContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        position: 'relative',
        marginRight: 12,
        borderWidth: 1,
    },
    avatar: {
        width: '100%',
        height: '100%',
        borderRadius: 24,
    },
    flagOverlay: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        backgroundColor: '#fff',
        borderRadius: 10,
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1,
        elevation: 1,
    },
    flagEmoji: {
        fontSize: 12,
    },
    chatInfo: {
        flex: 1,
        marginRight: 8,
    },
    chatName: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 2,
    },
    chatMessage: {
        fontSize: 13,
    },
    chatButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 16,
        gap: 4,
    },
    chatButtonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    newChatButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        marginTop: 8,
    },
    newChatText: {
        color: '#FFF',
        fontWeight: 'bold',
        marginLeft: 8,
    },
    emptyContainer: {
        padding: 20,
        alignItems: 'center',
    }
});
