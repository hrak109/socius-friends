import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View, Alert, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bubble, GiftedChat } from 'react-native-gifted-chat';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import TypingIndicator from '@/components/features/chat/widgets/TypingIndicator';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { PROFILE_AVATAR_MAP, SOCIUS_AVATAR_MAP } from '@/constants/avatars';
import { renderMessageWidgets } from '@/components/features/chat/MessageWidgets';
import { useChat } from '@/hooks/useChat';

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
    message_group_id?: string; // NEW: message_group_id/Context support
    friendId?: number; // NEW: For DM chats with users
    companionId?: number; // NEW: For specific Socius companions

    friendName?: string; // NEW: Name of friend/bot
    friendAvatar?: string; // NEW: Avatar key/url of friend/bot
    showHeader?: boolean; // NEW: Should show header
}

export default function ChatInterface({ onClose, isModal = false, initialMessage = '', message_group_id = 'default', friendId, companionId, friendName, friendAvatar, showHeader = true }: ChatInterfaceProps) {
    const { colors } = useTheme();
    const { t, language } = useLanguage();
    const {
        messages, text, setText, onSend, isTyping,
        isLoadingEarlier, canLoadMore, loadEarlierMessages, currentUser
    } = useChat({
        message_group_id, friendId, companionId, friendName, friendAvatar, initialMessage
    });
    const textInputRef = useRef<any>(null);

    // UI Layout State
    const [, setKeyboardVisible] = useState(false);
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







    const renderCustomView = useCallback(() => {
        return null; // Moved to renderMessageText to ensure bottom position
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
            renderMessageText={renderMessageWidgets}
        />
    ), [colors, renderCustomView]);

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
    }, [t, language]);

    // Custom input toolbar to fix iOS 26 keyboard input issues
    const renderInputToolbar = () => (
        <View style={[
            styles.customInputToolbar,
            { backgroundColor: colors.card, borderTopColor: colors.border },
            Platform.OS === 'ios' && { paddingBottom: 25 }
        ]}>
            <TextInput
                ref={textInputRef}
                style={[styles.customTextInput, {
                    backgroundColor: colors.inputBackground,
                    color: colors.text
                }]}
                placeholder={t('chat.placeholder')}
                placeholderTextColor={colors.textSecondary}
                value={text}
                onChangeText={setText}
                multiline
                textAlignVertical="center"
                returnKeyType="default"
                blurOnSubmit={false}
                editable={true}
                autoFocus={!!initialMessage}
            />
            <TouchableOpacity
                testID="send-button"
                style={[styles.customSendButton, { backgroundColor: !text.trim() ? colors.border : '#007AFF' }]}
                onPress={() => {
                    if (text.trim()) {
                        onSend([{
                            _id: String(Math.round(Math.random() * 1000000)),
                            text: text.trim(),
                            createdAt: new Date(),
                            user: currentUser
                        }]);
                    }
                }}
                disabled={!text.trim()}
            >
                <Ionicons name="send" size={20} color={!text.trim() ? colors.textSecondary : '#FFFFFF'} />
            </TouchableOpacity>
        </View>
    );

    const renderAvatar = (props: any) => {
        // FOR THE CURRENT USER (Me)
        if (props.currentMessage?.user?._id === 1) {
            // Use the live currentUser avatar from the useChat hook 
            // instead of the static props.currentMessage.user.avatar
            return <SociusAvatar source={currentUser.avatar} />;
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
        <View
            style={[styles.container, { backgroundColor: colors.background }]}
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
                        {message_group_id && message_group_id !== 'default'
                            ? `${t('chat.title')} (${message_group_id.charAt(0).toUpperCase() + message_group_id.slice(1)})`
                            : t('chat.title')}
                    </Text>
                    <View style={{ width: 40 }} />
                </View>
            )}

            {Platform.OS === 'ios' ? (
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior="padding"
                    keyboardVerticalOffset={100}
                >
                    <GiftedChat
                        messages={messages}
                        text={text}
                        textInputRef={textInputRef}
                        onInputTextChanged={setText}
                        onSend={(messages) => onSend(messages)}
                        user={currentUser}
                        isTyping={isTyping}
                        locale={language}
                        {...{ isDayAnimationEnabled: false } as any}
                        renderBubble={renderBubble}
                        renderAvatar={renderAvatar}
                        renderDay={renderDay}
                        loadEarlier={canLoadMore}
                        infiniteScroll
                        onLoadEarlier={loadEarlierMessages}
                        loadEarlierLabel={t('chat.load_earlier')}
                        isLoadingEarlier={isLoadingEarlier}
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
                        bottomOffset={insets.bottom}
                        messagesContainerStyle={{ flex: 1 }}
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
                            removeClippedSubviews: false,
                            initialNumToRender: 8,
                            maxToRenderPerBatch: 4,
                            windowSize: 3,
                            updateCellsBatchingPeriod: 150,
                            nestedScrollEnabled: true,
                            scrollEventThrottle: 16,
                            keyboardDismissMode: 'none',
                            keyboardShouldPersistTaps: 'handled',
                        } as any}
                        shouldUpdateMessage={(props, nextProps) =>
                            props.currentMessage._id !== nextProps.currentMessage._id
                        }
                        {...(Platform.OS === 'ios' ? { isKeyboardInternallyHandled: false } : {})}
                    />
                </KeyboardAvoidingView>
            ) : (
                <GiftedChat
                    messages={messages}
                    text={text}
                    textInputRef={textInputRef}
                    onInputTextChanged={setText}
                    onSend={(messages) => onSend(messages)}
                    user={currentUser}
                    isTyping={isTyping}
                    locale={language}
                    {...{ isDayAnimationEnabled: false } as any}
                    renderBubble={renderBubble}
                    renderAvatar={renderAvatar}
                    renderDay={renderDay}
                    loadEarlier={canLoadMore}
                    infiniteScroll
                    onLoadEarlier={loadEarlierMessages}
                    loadEarlierLabel={t('chat.load_earlier')}
                    isLoadingEarlier={isLoadingEarlier}
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
                    isScrollToBottomEnabled={false}
                    renderUsernameOnMessage={true}
                    timeTextStyle={{
                        left: { color: colors.textSecondary },
                        right: { color: 'rgba(255, 255, 255, 0.7)' }
                    }}
                    keyboardShouldPersistTaps="handled"
                    bottomOffset={0}
                    messagesContainerStyle={{ flex: 1 }}
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
                        removeClippedSubviews: true,
                        initialNumToRender: 20,
                        maxToRenderPerBatch: 20,
                        windowSize: 20,
                        keyboardDismissMode: 'none',
                        keyboardShouldPersistTaps: 'handled',
                    } as any}
                    shouldUpdateMessage={(props, nextProps) =>
                        props.currentMessage._id !== nextProps.currentMessage._id
                    }
                />
            )}
        </View>
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
