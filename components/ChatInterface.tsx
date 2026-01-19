import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View, Alert, Keyboard } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Bubble, Day, GiftedChat, IMessage, User, MessageText } from 'react-native-gifted-chat';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import TypingIndicator from './TypingIndicator';
import CalorieWidget from './CalorieWidget';
import { PROFILE_AVATAR_MAP, SOCIUS_AVATAR_MAP } from '../constants/avatars';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useNotifications } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';
import { useUserProfile } from '../context/UserProfileContext';
import api from '../services/api';
import { fixTimestamp } from '../utils/date';
import { getCachedMessages, cacheMessages, CachedMessage } from '../services/ChatCache';

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
    const { colors } = useTheme();
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
    const { refreshNotifications, lastMessage, lastNotificationTime, setTyping, typingThreads } = useNotifications();
    const textInputRef = useRef<any>(null);
    const processedMessageIds = useRef<Set<number>>(new Set());

    // UI Layout State
    const [isKeyboardVisible, setKeyboardVisible] = useState(false);
    const insets = useSafeAreaInsets();

    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const showListener = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
        const hideListener = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

        return () => {
            showListener.remove();
            hideListener.remove();
        };
    }, []);

    // Sync waiting state with global typing state for this context
    const threadId = friendId ? `user-${friendId}` : (companionId ? `socius-${companionId}` : context);
    const isGlobalTyping = typingThreads.has(threadId) || typingThreads.has(context);

    useEffect(() => {
        setIsWaitingForResponse(isGlobalTyping);
        setIsTyping(isGlobalTyping);
    }, [isGlobalTyping]);

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
    }, [lastMessage, lastMessage?.timestamp, lastMessage?.id, lastMessage?.context, lastMessage?.content, context, botUser]);

    useEffect(() => {
        if (initialMessage) {
            setText(initialMessage);
            // Robust check: sometimes state updates are batched or clobbered on mount
            setTimeout(() => {
                setText(prev => (prev && prev.length > 0) ? prev : initialMessage);
                if (textInputRef.current) {
                    textInputRef.current.focus();
                }
            }, 300);
        }
    }, [initialMessage]);

    useFocusEffect(
        useCallback(() => {
            let isActive = true;

            const fetchHistory = async () => {
                // Determine cache key
                const cacheKey = friendId ? `user-${friendId}` : (companionId ? `socius-${companionId}` : context);

                // Load cached messages first for instant display
                const cached = await getCachedMessages(cacheKey);
                if (cached.length > 0 && isActive) {
                    const restoredMessages: IMessage[] = cached.map((m) => {
                        if (m._id && typeof m._id === 'number') processedMessageIds.current.add(m._id);
                        return {
                            _id: m._id,
                            text: m.text,
                            createdAt: new Date(m.createdAt),
                            user: m.user,
                        };
                    });
                    setMessages(restoredMessages);
                }

                try {
                    let history: any[] = [];

                    if (friendId) {
                        // User-to-user DM: fetch from /messages/{friendId}
                        const res = await api.get(`/messages/${friendId}`);
                        history = res.data || [];
                    } else {
                        // Socius AI chat: fetch from /history
                        const res = await api.get('/history', {
                            params: { model: selectedModel, context }
                        });
                        history = res.data || [];
                    }

                    if (!isActive) return;

                    const formattedMessages: IMessage[] = history.map((msg: any) => {
                        if (msg.id) processedMessageIds.current.add(msg.id);
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

                        // DM uses is_me flag, Socius uses role
                        const isFromMe = friendId ? msg.is_me : (msg.role === 'user');

                        return {
                            _id: safeId,
                            text: String(msg.content || ''),
                            createdAt: safeDate,
                            user: isFromMe ? {
                                _id: 1,
                                name: displayName || user?.name || 'Me',
                                avatar: safeAvatar || undefined
                            } : botUser,
                        };
                    });

                    if (formattedMessages.length === 0 && !friendId) {
                        // Only show welcome for Socius, not for DMs
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
                        const reversedMessages = formattedMessages.reverse();
                        setMessages(reversedMessages);
                        // Cache fresh messages
                        const toCache: CachedMessage[] = reversedMessages.map((m) => ({
                            _id: m._id,
                            text: m.text,
                            createdAt: (m.createdAt instanceof Date ? m.createdAt : new Date(m.createdAt)).toISOString(),
                            user: {
                                _id: m.user._id,
                                name: m.user.name,
                                avatar: typeof m.user.avatar === 'string' ? m.user.avatar : undefined,
                            },
                        }));
                        cacheMessages(cacheKey, toCache);
                    }
                    refreshNotifications();
                } catch (error: any) {
                    console.error('Failed to fetch history:', error);
                    // Keep showing cached data if API fails
                }
            };

            fetchHistory();

            return () => {
                isActive = false;
            };
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [context, lastNotificationTime, friendId]) // Added friendId dependency
    );

    const handleSendQuestion = useCallback(async (text: string) => {
        if (friendId) {
            // User-to-user DM: POST to /messages
            try {
                await api.post('/messages', {
                    receiver_id: friendId,
                    content: text
                });
                // DMs don't need typing indicator or wait for AI response
            } catch (error) {
                console.error('Error sending DM:', error);
            }
        } else {
            // Socius AI chat: POST to /ask
            setIsTyping(true);
            // setIsWaitingForResponse(true) handled by effect on isGlobalTyping

            const currentThreadId = companionId ? `socius-${companionId}` : context;
            setTyping(currentThreadId, true);

            // Set 60s timeout to re-enable
            if (responseTimeoutRef.current) clearTimeout(responseTimeoutRef.current);
            responseTimeoutRef.current = setTimeout(() => {
                setIsTyping(false);
                setTyping(currentThreadId, false);
            }, 120000);

            try {
                await api.post('/ask', {
                    q_text: text,
                    model: selectedModel,
                    context,
                    companion_id: companionId
                });
            } catch (error) {
                console.error('Error sending question:', error);
                setIsTyping(false);
                setTyping(currentThreadId, false);
                if (responseTimeoutRef.current) clearTimeout(responseTimeoutRef.current);
                appendBotMessage('Sorry, I encountered an error sending your message.');
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedModel, context, friendId, companionId]);

    const onSend = useCallback((newMessages: IMessage[] = []) => {
        setMessages((previousMessages) => GiftedChat.append(previousMessages, newMessages));
        const messageText = newMessages[0].text;
        handleSendQuestion(messageText);
        setText('');
    }, [handleSendQuestion]);



    const appendBotMessage = (text: string) => {
        const msg: IMessage = {
            _id: Math.round(Math.random() * 1000000),
            text,
            createdAt: new Date(),
            user: botUser,
        };
        setMessages((previousMessages) => GiftedChat.append(previousMessages, [msg]));
    };



    const renderCustomView = useCallback((props: any) => {
        return null; // Moved to renderMessageText to ensure bottom position
    }, []);

    const renderMessageText = useCallback((props: any) => {
        const { currentMessage } = props;
        const isUser = currentMessage.user._id === 1;
        let text = currentMessage.text;

        const jsonMatch = currentMessage.text.match(/```json\s*([\s\S]*?)\s*```/);
        let widget = null;

        // Remove JSON block for display
        text = text.replace(/```json\s*[\s\S]*?\s*```/, '').trim();

        if (jsonMatch) {
            try {
                const data = JSON.parse(jsonMatch[1]);
                if (data.type === 'calorie_event') {
                    widget = (
                        <View style={{ padding: 5, width: 250, marginTop: 10 }}>
                            <CalorieWidget
                                food={data.food}
                                options={data.options}
                                messageId={currentMessage._id}
                            />
                        </View>
                    );
                }
            } catch (e) {
                // Ignore parse errors
            }
        }

        if (!text && !widget) return null;

        return (
            <View>
                {text ? (
                    <MessageText
                        {...props}
                        currentMessage={{
                            ...currentMessage,
                            text: text
                        }}
                    />
                ) : null}
                {widget}
            </View>
        );
    }, []);

    const renderBubble = useCallback((props: any) => (
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
            renderCustomView={renderCustomView}
            renderMessageText={renderMessageText}
        />
    ), [colors, renderCustomView, renderMessageText]);

    const renderDay = useCallback((props: any) => {
        // DayAnimated passes createdAt directly (as timestamp), inline passes via currentMessage
        const createdAt = props.createdAt || props.currentMessage?.createdAt;
        if (!createdAt) return null;

        // Handle both timestamp number and Date/string formats
        const date = typeof createdAt === 'number' ? new Date(createdAt) : new Date(createdAt);
        if (isNaN(date.getTime())) return null;

        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        let dateText = '';
        if (date.toDateString() === today.toDateString()) {
            dateText = t('common.today') || 'Today';
        } else if (date.toDateString() === yesterday.toDateString()) {
            dateText = t('common.yesterday') || 'Yesterday';
        } else {
            // Use locale-appropriate date format
            if (language === 'ko') {
                const month = date.getMonth() + 1;
                const day = date.getDate();
                dateText = `${month}월 ${day}일`;
            } else {
                dateText = date.toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                });
            }
        }

        // For inline days only: check if we should skip (same day as previous)
        // Don't skip for DayAnimated (when there's no currentMessage)
        if (props.currentMessage && props.previousMessage?.createdAt) {
            const prevDate = new Date(props.previousMessage.createdAt);
            if (prevDate.toDateString() === date.toDateString()) {
                return null; // Same day, don't show date
            }
        }

        return (
            <View style={{ alignItems: 'center', marginVertical: 10 }}>
                <View style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 12
                }}>
                    <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '600' }}>
                        {dateText}
                    </Text>
                </View>
            </View>
        );
    }, [t, language, colors]);

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

        // OTHER USER/BOT AVATAR LOGIC
        // 1. Try PROFILE_AVATAR_MAP (for user friends with custom avatars)
        // 2. Try SOCIUS_AVATAR_MAP (for Socius companions)
        // 3. Try as URL (for Google photos)
        // 4. Fallback to default

        let source;
        if (friendAvatar && PROFILE_AVATAR_MAP[friendAvatar]) {
            source = PROFILE_AVATAR_MAP[friendAvatar];
        } else if (friendAvatar && SOCIUS_AVATAR_MAP[friendAvatar]) {
            source = SOCIUS_AVATAR_MAP[friendAvatar];
        } else if (friendAvatar && friendAvatar.startsWith('http')) {
            source = { uri: friendAvatar };
        } else {
            source = SOCIUS_AVATAR_MAP['socius-avatar-0']; // Default
        }

        return <SociusAvatar source={source} />;
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? (showHeader ? 90 : 0) : 0}
        >
            <SafeAreaView
                style={[styles.container, { backgroundColor: colors.background }]}
                edges={['left', 'right']}
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
                    {...{ isDayAnimationEnabled: false } as any}
                    renderBubble={renderBubble}
                    renderAvatar={renderAvatar}
                    renderDay={renderDay}
                    renderInputToolbar={renderInputToolbar}
                    renderFooter={() => {
                        if (!isTyping) return null;

                        let source;
                        if (friendAvatar && PROFILE_AVATAR_MAP[friendAvatar]) {
                            source = PROFILE_AVATAR_MAP[friendAvatar];
                        } else if (friendAvatar && SOCIUS_AVATAR_MAP[friendAvatar]) {
                            source = SOCIUS_AVATAR_MAP[friendAvatar];
                        } else if (friendAvatar && friendAvatar.startsWith('http')) {
                            source = { uri: friendAvatar };
                        } else {
                            source = SOCIUS_AVATAR_MAP['socius-avatar-0'];
                        }

                        return (
                            <View style={{ flexDirection: 'row', alignItems: 'flex-end', margin: 10, marginLeft: 14 }}>
                                <SociusAvatar source={source} />
                                <View style={{
                                    backgroundColor: colors.inputBackground,
                                    marginLeft: 8,
                                    padding: 10,
                                    borderRadius: 15,
                                    borderBottomLeftRadius: 0
                                }}>
                                    <TypingIndicator color={colors.textSecondary} />
                                </View>
                            </View>
                        );
                    }}
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
                    bottomOffset={Platform.OS === 'ios' && !isKeyboardVisible ? insets.bottom : 0}
                    dateFormat={language === 'ko' ? 'D일 M월' : 'MMMM D'}
                    dateFormatCalendar={{
                        sameDay: language === 'ko' ? `[${t('common.today') || '오늘'}]` : '[Today]',
                        lastDay: language === 'ko' ? `[${t('common.yesterday') || '어제'}]` : '[Yesterday]',
                        lastWeek: language === 'ko' ? 'M[월] D[일]' : 'MMMM D',
                        sameElse: language === 'ko' ? 'M[월] D[일]' : 'MMMM D',
                    }}

                    onLongPress={(context, message) => {
                        if (message.text) {
                            Clipboard.setStringAsync(message.text);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            Alert.alert(t('common.success') || 'Success', t('chat.copy_success') || 'Text copied to clipboard');
                        }
                    }}
                    listViewProps={{
                        removeClippedSubviews: Platform.OS === 'android',
                        initialNumToRender: 8,
                        maxToRenderPerBatch: 4,
                        windowSize: 3,
                        updateCellsBatchingPeriod: 150,
                        nestedScrollEnabled: true,
                        scrollEventThrottle: 16,
                    } as any}
                    shouldUpdateMessage={(props, nextProps) =>
                        props.currentMessage._id !== nextProps.currentMessage._id
                    }
                />
            </SafeAreaView>
        </KeyboardAvoidingView>
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
