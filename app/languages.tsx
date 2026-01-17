
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Dimensions } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

const { width } = Dimensions.get('window');

// Mock data for the dashboard
const WORD_OF_DAY = {
    word: 'Serendipity',
    phonetic: '/ˌser.ənˈdɪp.ə.ti/',
    definition: 'The occurrence and development of events by chance in a happy or beneficial way.'
};

const RECENT_CONVERSATIONS = [
    { id: '1', name: 'Spanish Practice', lastMessage: 'Hola, ¿cómo estás?', time: '10:30 AM', avatar: 'socius-avatar-3' },
    { id: '2', name: 'French Basics', lastMessage: 'Merci beaucoup!', time: 'Yesterday', avatar: 'socius-avatar-1' },
];

export default function LanguagesApp() {
    const { colors } = useTheme();
    const { t } = useLanguage();
    const router = useRouter();

    const ACCENT_COLOR = '#C7C7CC'; // Very light grey as requested
    const TEXT_ACCENT = '#8E8E93'; // Darker grey for text visibility

    const tools = [
        { id: 'translator', icon: 'language', label: 'languages.translator', color: '#5856D6' }, // Keep vibrant colors for tools? Or stick to grey? User said "visuals... use very light grey". I'll keep distinct colors for sub-tools to be "visually appealing" as requested, but standard grey for the main structure.
        { id: 'vocabulary', icon: 'book', label: 'languages.vocabulary', color: '#FF9500' },
        { id: 'expressions', icon: 'chatbubbles', label: 'languages.expressions', color: '#34C759' },
    ];

    const renderToolCard = (tool: any) => (
        <TouchableOpacity
            key={tool.id}
            style={[styles.toolCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => console.log(`Open ${tool.id}`)}
        >
            <View style={[styles.iconContainer, { backgroundColor: tool.color + '20' }]}>
                <Ionicons name={tool.icon as any} size={28} color={tool.color} />
            </View>
            <Text style={[styles.toolLabel, { color: colors.text }]}>{t(tool.label)}</Text>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <Stack.Screen
                options={{
                    title: t('languages.title'),
                    headerStyle: { backgroundColor: colors.background },
                    headerTintColor: colors.text,
                    headerShadowVisible: false,
                }}
            />

            <ScrollView contentContainerStyle={styles.content}>

                {/* Word of the Day Banner */}
                <View style={[styles.section, styles.bannerContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.bannerHeader}>
                        <Ionicons name="sunny" size={20} color="#FFD60A" />
                        <Text style={[styles.sectionTitle, { color: colors.text, marginLeft: 8 }]}>
                            {t('languages.word_of_day')}
                        </Text>
                    </View>
                    <View style={styles.wordContent}>
                        <Text style={[styles.wordText, { color: colors.text }]}>{WORD_OF_DAY.word}</Text>
                        <Text style={[styles.phoneticText, { color: TEXT_ACCENT }]}>{WORD_OF_DAY.phonetic}</Text>
                        <Text style={[styles.definitionText, { color: colors.textSecondary }]}>{WORD_OF_DAY.definition}</Text>
                    </View>
                </View>

                {/* Tools Grid */}
                <View style={styles.toolsGrid}>
                    {tools.map(renderToolCard)}
                </View>

                {/* Conversations Section */}
                <View style={styles.section}>
                    <Text style={[styles.sectionHeader, { color: colors.text }]}>{t('languages.conversations')}</Text>
                    {RECENT_CONVERSATIONS.map((chat) => (
                        <TouchableOpacity
                            key={chat.id}
                            style={[styles.chatItem, { backgroundColor: colors.card, borderColor: colors.border }]}
                        >
                            <View style={[styles.avatarPlaceholder, { backgroundColor: '#E5E5EA' }]}>
                                <Ionicons name="person" size={20} color="#8E8E93" />
                            </View>
                            <View style={styles.chatInfo}>
                                <Text style={[styles.chatName, { color: colors.text }]}>{chat.name}</Text>
                                <Text style={[styles.chatMessage, { color: colors.textSecondary }]}>{chat.lastMessage}</Text>
                            </View>
                            <Text style={[styles.chatTime, { color: TEXT_ACCENT }]}>{chat.time}</Text>
                        </TouchableOpacity>
                    ))}

                    <TouchableOpacity style={[styles.newChatButton, { backgroundColor: ACCENT_COLOR }]}>
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
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
    },
    wordContent: {
        alignItems: 'center',
        paddingVertical: 10,
    },
    wordText: {
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    phoneticText: {
        fontSize: 16,
        marginBottom: 12,
        fontStyle: 'italic',
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
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
        marginBottom: 10,
    },
    avatarPlaceholder: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    chatInfo: {
        flex: 1,
    },
    chatName: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 2,
    },
    chatMessage: {
        fontSize: 14,
    },
    chatTime: {
        fontSize: 12,
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
});
