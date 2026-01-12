import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Bubble, GiftedChat, IMessage, User } from 'react-native-gifted-chat';
import { PROFILE_AVATAR_MAP, SOCIUS_AVATAR_MAP } from '../constants/avatars';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useNotifications } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';
import { useUserProfile } from '../context/UserProfileContext';
import api from '../services/api';
import { fixTimestamp } from '../utils/date';

const SociusAvatar = ({ source }: { source: any }) => {
    const { colors } = useTheme();
    return (
        <View style={[styles.botAvatarContainer, { backgroundColor: colors.inputBackground }]}>
            <Image
                source={source}
                style={styles.botAvatarImage}
            />
        </View>
    );
};

interface ChatInterfaceProps {
    onClose?: () => void;
    isModal?: boolean;
    initialMessage?: string;
    context?: string; // NEW: Context support
    friendId?: number; // NEW: For DM chats with users
    companionId?: number; // NEW: For specific Socius companions

    friendName?: string; // NEW: Name of friend/bot
    friendAvatar?: string; // NEW: Avatar key/url of friend/bot
    showHeader?: boolean; // NEW: Should show header
}

export default function ChatInterface({ onClose, isModal = false, initialMessage = '', context = 'global', friendId, companionId, friendName, friendAvatar, showHeader = true }: ChatInterfaceProps) {
    const { colors, avatarId } = useTheme();
    const { t, language } = useLanguage();
    const { displayName, displayAvatar } = useUserProfile();

    const botUser: User = React.useMemo(() => ({
        _id: 2,
        name: friendName || t('chat.socius'), // Use friendName if available
        avatar: friendAvatar, // Store avatar key/url here
    }), [t, friendName, friendAvatar]);

    const { user } = useAuth(); // Use AuthContext for user info if available
    const [messages, setMessages] = useState<IMessage[]>([]);
    const [text, setText] = useState(initialMessage);
    const [isTyping, setIsTyping] = useState(false);
    const [isWaitingForResponse, setIsWaitingForResponse] = useState(false); // NEW: Disable input state
    const responseTimeoutRef = useRef<any>(null);
    const selectedModel = 'soc-model';
    const { refreshNotifications, lastMessage, lastNotificationTime } = useNotifications();
    const textInputRef = useRef<any>(null);
    const processedMessageIds = useRef<Set<number>>(new Set());

    // Listen for real-time messages from SSE via NotificationContext
    useEffect(() => {
        if (lastMessage && lastMessage.context === context && lastMessage.content) {
            // Avoid processing the same message twice
            if (processedMessageIds.current.has(lastMessage.id)) {
                return;
            }
            processedMessageIds.current.add(lastMessage.id);

            // Append the new message from SSE
            const newMsg: IMessage = {
                _id: lastMessage.id,
                text: lastMessage.content,
                createdAt: new Date(),
                user: botUser,
            };
            setMessages((prev) => GiftedChat.append(prev, [newMsg]));
            setIsTyping(false);
            setIsWaitingForResponse(false);
            if (responseTimeoutRef.current) clearTimeout(responseTimeoutRef.current);
        }
    }, [lastMessage?.timestamp, lastMessage?.id, lastMessage?.context, lastMessage?.content, context, botUser]);

    useEffect(() => {
        if (initialMessage) {
            setText(initialMessage);
            // Delay focus to ensure layout is ready
            setTimeout(() => {
                if (textInputRef.current) {
                    textInputRef.current.focus();
                }
            }, 600);
        }
    }, [initialMessage]);

    useFocusEffect(
        useCallback(() => {
            let isActive = true;

            const fetchHistory = async () => {
                try {
                    const res = await api.get('/history', {
                        params: { model: selectedModel, context }
                    });

                    if (!isActive) return;

                    const history = res.data || [];

                    const formattedMessages: IMessage[] = history.map((msg: any) => {
                        const safeId = msg.id || Math.random();

                        let safeDate = new Date();
                        try {
                            safeDate = fixTimestamp(msg.created_at);
                        } catch (e) {
                            console.error('Date parse error', e);
                        }

                        let safeAvatar = user?.photo;
                        if (displayAvatar && PROFILE_AVATAR_MAP[displayAvatar]) {
                            safeAvatar = PROFILE_AVATAR_MAP[displayAvatar];
                        }

                        return {
                            _id: safeId,
                            text: String(msg.content || ''),
                            createdAt: safeDate,
                            user: msg.role === 'user' ? {
                                _id: 1,
                                name: displayName || user?.name || 'Me',
                                avatar: safeAvatar
                            } : botUser,
                        };
                    });

                    if (formattedMessages.length === 0) {
                        setMessages(prev => {
                            if (prev.length === 0) {
                                return [{
                                    _id: 1,
                                    text: t('chat.welcome') || 'Hello! I am Socius.',
                                    createdAt: new Date(),
                                    user: botUser,
                                }];
                            }
                            return prev;
                        });
                    } else {
                        setMessages(formattedMessages.reverse());
                    }
                    refreshNotifications();
                } catch (error: any) {
                    console.error('Failed to fetch history:', error);
                }
            };

            fetchHistory();

            return () => {
                isActive = false;
            };
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [context, lastNotificationTime]) // Only re-create callback when context changes
    );

    const handleSendQuestion = useCallback(async (text: string) => {
        setIsTyping(true);
        setIsWaitingForResponse(true); // Disable input

        // Set 60s timeout to re-enable
        if (responseTimeoutRef.current) clearTimeout(responseTimeoutRef.current);
        responseTimeoutRef.current = setTimeout(() => {
            setIsWaitingForResponse(false);
            setIsTyping(false);
        }, 60000);

        try {
            await api.post('/ask', {
                q_text: text,
                model: selectedModel,
                context, // Pass context
                companion_id: companionId // Pass companion ID
            });
        } catch (error) {
            console.error('Error sending question:', error);
            setIsTyping(false);
            setIsWaitingForResponse(false); // Re-enable on error
            if (responseTimeoutRef.current) clearTimeout(responseTimeoutRef.current);
            appendBotMessage('Sorry, I encountered an error sending your message.');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedModel, context]);

    const onSend = useCallback((newMessages: IMessage[] = []) => {
        setMessages((previousMessages) => GiftedChat.append(previousMessages, newMessages));
        const messageText = newMessages[0].text;
        handleSendQuestion(messageText);
        setText('');
    }, [handleSendQuestion]);

    useEffect(() => {
        if (messages.length > 0 && messages[0].user._id !== 1) {
            setIsTyping(false);
            setIsWaitingForResponse(false); // Re-enable when bot answers
            if (responseTimeoutRef.current) clearTimeout(responseTimeoutRef.current);
        }
    }, [messages]);

    const appendBotMessage = (text: string) => {
        const msg: IMessage = {
            _id: Math.round(Math.random() * 1000000),
            text,
            createdAt: new Date(),
            user: botUser,
        };
        setMessages((previousMessages) => GiftedChat.append(previousMessages, [msg]));
    };

    const renderBubble = (props: any) => (
        <Bubble
            {...props}
            wrapperStyle={{
                left: { backgroundColor: colors.inputBackground, borderRadius: 15 },
                right: { backgroundColor: colors.primary, borderRadius: 15 }
            }}
            textStyle={{
                left: { color: colors.text },
                right: { color: colors.buttonText }
            }}
        />
    );

    // Custom input toolbar to fix iOS 26 keyboard input issues
    const renderInputToolbar = () => (
        <View style={[styles.customInputToolbar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
            <TextInput
                ref={textInputRef}
                style={[styles.customTextInput, {
                    backgroundColor: isWaitingForResponse ? colors.card : colors.inputBackground, // Visual feedback
                    color: isWaitingForResponse ? colors.textSecondary : colors.text
                }]}
                placeholder={isWaitingForResponse ? t('chat.thinking') || "Socius is thinking..." : t('chat.placeholder')}
                placeholderTextColor={colors.textSecondary}
                value={text}
                onChangeText={setText}
                multiline
                textAlignVertical="center"
                returnKeyType="default"
                blurOnSubmit={false}
                editable={!isWaitingForResponse} // Disable input
            />
            <TouchableOpacity
                style={[styles.customSendButton, { backgroundColor: (!text.trim() || isWaitingForResponse) ? colors.border : '#007AFF' }]}
                onPress={() => {
                    if (text.trim()) {
                        onSend([{
                            _id: Math.round(Math.random() * 1000000),
                            text: text.trim(),
                            createdAt: new Date(),
                            user: {
                                _id: 1,
                                name: displayName || user?.name || 'Me',
                            }
                        }]);
                    }
                }}
                disabled={!text.trim() || isWaitingForResponse} // Disable button
            >
                <Ionicons name="send" size={20} color={(!text.trim() || isWaitingForResponse) ? colors.textSecondary : '#FFFFFF'} />
            </TouchableOpacity>
        </View>
    );

    const renderAvatar = (props: any) => {
        if (props.currentMessage?.user?._id === 1) {
            let avatarSource = user?.photo;
            if (displayAvatar && PROFILE_AVATAR_MAP[displayAvatar]) {
                avatarSource = PROFILE_AVATAR_MAP[displayAvatar];
            }

            return (
                <Avatar
                    {...props}
                    currentMessage={{
                        ...props.currentMessage,
                        user: {
                            ...props.currentMessage.user,
                            avatar: avatarSource || props.currentMessage.user.avatar
                        }
                    }}
                    imageStyle={{ left: styles.userAvatar, right: styles.userAvatar }}
                />
            );
        }

        // BOT AVATAR LOGIC
        // 1. Try to use friendAvatar prop (key) from SOCIUS_AVATAR_MAP
        // 2. Try to use friendAvatar prop as URI (if it's a URL)
        // 3. Fallback to default

        let source;
        if (friendAvatar && SOCIUS_AVATAR_MAP[friendAvatar]) {
            source = SOCIUS_AVATAR_MAP[friendAvatar];
        } else if (friendAvatar) {
            source = { uri: friendAvatar }; // Fallback for URLs
        } else {
            source = SOCIUS_AVATAR_MAP['socius-icon']; // Default
        }

        return <SociusAvatar source={source} />;
    };

    return (
        <SafeAreaView
            style={[styles.container, { backgroundColor: colors.background }]}
            edges={['left', 'right', 'bottom']}
        >
            {showHeader && (
                <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                    {onClose ? (
                        <TouchableOpacity onPress={onClose} style={styles.backButton}>
                            {isModal ? (
                                <Ionicons name="close" size={24} color={colors.text} />
                            ) : (
                                <Ionicons name="arrow-back" size={24} color={colors.text} />
                            )}
                        </TouchableOpacity>
                    ) : (
                        <View style={{ width: 40 }} />
                    )}
                    <Text style={[styles.headerTitle, { color: colors.text }]}>
                        {context && context !== 'global'
                            ? `${t('chat.title')} (${context.charAt(0).toUpperCase() + context.slice(1)})`
                            : t('chat.title')}
                    </Text>
                    <View style={{ width: 40 }} />
                </View>
            )}

            <GiftedChat
                messages={messages}
                text={text}
                textInputRef={textInputRef}
                onInputTextChanged={setText}
                onSend={(messages) => onSend(messages)}
                user={{
                    _id: 1,
                    name: displayName || user?.name || 'Me',
                    avatar: displayAvatar ? PROFILE_AVATAR_MAP[displayAvatar] : (user?.photo || undefined),
                }}
                isTyping={isTyping}
                locale={language}
                renderBubble={renderBubble}
                renderAvatar={renderAvatar}
                renderInputToolbar={renderInputToolbar}
                placeholder={t('chat.placeholder')}
                showUserAvatar={true}
                alwaysShowSend
                isScrollToBottomEnabled
                renderUsernameOnMessage={true}
                timeTextStyle={{
                    left: { color: colors.textSecondary },
                    right: { color: 'rgba(255, 255, 255, 0.7)' }
                }}
                keyboardShouldPersistTaps="handled"
                bottomOffset={Platform.OS === 'ios' ? 34 : 0}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        padding: 10,
        borderBottomWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 56,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    backButton: {
        padding: 8,
    },
    clearButton: {
        padding: 8,
    },
    userAvatar: {
        borderRadius: 18,
        width: 36,
        height: 36,
    },
    botAvatarContainer: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 18,
    },
    botAvatarImage: {
        width: 36,
        height: 36,
        borderRadius: 18,
    },
    customInputToolbar: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderTopWidth: 1,
    },
    customTextInput: {
        flex: 1,
        minHeight: 40,
        maxHeight: 120,
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 10,
        fontSize: 16,
        marginRight: 10,
    },
    customSendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
