import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useFocusEffect } from 'expo-router';
import { GiftedChat, IMessage, User } from 'react-native-gifted-chat';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { useUserProfile } from '@/context/UserProfileContext';
import { useLanguage } from '@/context/LanguageContext';
import api from '@/services/api';
import { fixTimestamp } from '@/utils/date';
import { getCachedMessages, cacheMessages, CachedMessage } from '@/services/ChatCache';
import { PROFILE_AVATAR_MAP } from '@/constants/avatars';

export function useChat({
    topic = 'global',
    friendId,
    companionId,
    friendName,
    friendAvatar,
    initialMessage
}: {
    topic?: string;
    friendId?: number;
    companionId?: number;
    friendName?: string;
    friendAvatar?: string;
    initialMessage?: string;
}) {
    const { user } = useAuth();
    const { displayName, displayAvatar } = useUserProfile();
    const { t } = useLanguage();
    const { refreshNotifications, lastMessage, lastDM, lastNotificationTime, setTyping, typingThreads } = useNotifications();

    const [messages, setMessages] = useState<IMessage[]>([]);
    const [text, setText] = useState(initialMessage || '');
    const [isTyping, setIsTyping] = useState(false);
    const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);

    const responseTimeoutRef = useRef<any>(null);
    const processedMessageIds = useRef<Set<number>>(new Set());
    const lastUserMessageTime = useRef<number>(0);

    const threadId = friendId ? `user-${friendId}` : (companionId ? `socius-${companionId}` : topic);

    // Bot User Definition
    const botUser: User = useMemo(() => ({
        _id: 2,
        name: friendName || t('chat.socius'),
        avatar: friendAvatar,
    }), [friendName, friendAvatar, t]);

    // Current User Definition
    const currentUser: User = useMemo(() => {
        let avatarSource;
        if (displayAvatar === 'google') {
            avatarSource = user?.photo ? { uri: user.photo } : undefined;
        } else if (displayAvatar && PROFILE_AVATAR_MAP[displayAvatar]) {
            avatarSource = PROFILE_AVATAR_MAP[displayAvatar];
        } else if (displayAvatar && displayAvatar.startsWith('http')) {
            avatarSource = { uri: displayAvatar };
        } else {
            avatarSource = user?.photo ? { uri: user.photo } : undefined;
        }

        return {
            _id: 1,
            name: displayName || user?.name || 'Me',
            avatar: avatarSource,
        };
    }, [displayName, user, displayAvatar]);

    // --- Effects ---

    // Sync waiting state with global typing state
    const isGlobalTyping = typingThreads.has(threadId) || typingThreads.has(topic);
    useEffect(() => {
        setIsWaitingForResponse(isGlobalTyping);
        setIsTyping(isGlobalTyping);
    }, [isGlobalTyping]);

    // SSE Listener
    useEffect(() => {
        const matchesTopic = lastMessage?.topic === topic || lastMessage?.topic === threadId;
        if (lastMessage && lastMessage.content && matchesTopic) {
            if (processedMessageIds.current.has(lastMessage.id)) return;
            processedMessageIds.current.add(lastMessage.id);

            const newMsg: IMessage = {
                _id: lastMessage.id,
                text: lastMessage.content,
                createdAt: new Date(),
                user: botUser,
            };
            setMessages((prev) => GiftedChat.append(prev, [newMsg]));

            setIsTyping(false);
            setIsWaitingForResponse(false);
            setTyping(threadId, false);
            setTyping(topic, false);
            if (responseTimeoutRef.current) clearTimeout(responseTimeoutRef.current);
        }
    }, [lastMessage, topic, threadId, botUser, setTyping]);

    // DM Listener
    useEffect(() => {
        if (friendId && lastDM && lastDM.senderId === friendId) {
            setTyping(`user-${friendId}`, false);
        }
    }, [lastDM, friendId, setTyping]);

    // Initial Message hydration
    useEffect(() => {
        if (initialMessage) {
            setText(initialMessage);
            // Small delay to ensure input is ready logic handled in UI component
        }
    }, [initialMessage]);

    // History Fetching
    useFocusEffect(
        useCallback(() => {
            let isActive = true;

            const fetchHistory = async () => {
                const cacheKey = friendId ? `user-${friendId}` : (companionId ? `socius-${companionId}` : topic);
                const cached = await getCachedMessages(cacheKey);

                if (cached.length > 0 && isActive) {
                    const restored = cached.map((m) => {
                        if (typeof m._id === 'number') processedMessageIds.current.add(m._id);
                        return { ...m, createdAt: new Date(m.createdAt) } as IMessage;
                    });
                    setMessages(restored);
                }

                try {
                    let history: any[] = [];
                    if (friendId) {
                        const res = await api.get(`/messages/${friendId}`);
                        history = res.data || [];
                    } else {
                        const res = await api.get('/history', { params: { topic } });
                        history = res.data || [];
                    }

                    if (!isActive) return;

                    const formatted: IMessage[] = history.map((msg: any) => {
                        if (msg.id) processedMessageIds.current.add(msg.id);
                        const isFromMe = friendId ? msg.is_me : (msg.message_author === 'user' || msg.role === 'user');
                        return {
                            _id: msg.id || Math.random(),
                            text: String(msg.content || ''),
                            createdAt: fixTimestamp(msg.created_at),
                            user: isFromMe ? currentUser : botUser,
                        };
                    });

                    if (formatted.length === 0 && !friendId) {
                        // Welcome message only for Socius
                        setMessages([{ _id: 1, text: t('chat.welcome') || 'Hello!', createdAt: new Date(), user: botUser }]);
                    } else {
                        const reversed = formatted.reverse();
                        setMessages(reversed);

                        // Resume typing state logic
                        const lastMsg = reversed[0];
                        if (lastMsg?.user._id === 1 && !friendId) {
                            // Last was user, should be waiting
                            setTyping(threadId, true);
                            setTyping(topic, true);
                            setIsTyping(true);
                            setIsWaitingForResponse(true);
                        } else {
                            // Clear if bot replied
                            setTyping(threadId, false);
                            setTyping(topic, false);
                            setIsTyping(false);
                            setIsWaitingForResponse(false);
                        }

                        // Cache update
                        const toCache: CachedMessage[] = reversed.map(m => ({
                            _id: m._id,
                            text: m.text,
                            createdAt: (m.createdAt instanceof Date ? m.createdAt : new Date(m.createdAt)).toISOString(),
                            user: { _id: m.user._id, name: m.user.name, avatar: typeof m.user.avatar === 'string' ? m.user.avatar : undefined }
                        }));
                        await cacheMessages(cacheKey, toCache);
                    }
                    refreshNotifications();
                } catch (e) {
                    console.error('History fetch failed', e);
                }
            };

            fetchHistory();
            return () => { isActive = false; };
        }, [topic, friendId, lastNotificationTime, currentUser, botUser])
    );

    // Sending Logic
    const sendMessage = useCallback(async (msgText: string) => {
        const TYPING_TIMEOUT = 20 * 60 * 1000;

        if (friendId) {
            try {
                await api.post('/messages', { receiver_id: friendId, content: msgText });
            } catch (e) {
                console.error('DM Send Error', e);
                setTyping(threadId, false);
            }
        } else {
            setIsTyping(true);
            setTyping(threadId, true);

            if (responseTimeoutRef.current) clearTimeout(responseTimeoutRef.current);
            responseTimeoutRef.current = setTimeout(() => {
                setIsTyping(false);
                setIsWaitingForResponse(false);
                setTyping(threadId, false);
            }, TYPING_TIMEOUT);

            try {
                await api.post('/ask', {
                    q_text: msgText,
                    topic,
                    companion_id: companionId
                });
            } catch (e) {
                console.error('Ask Error', e);
                setIsTyping(false);
                setTyping(threadId, false);
                setMessages(prev => GiftedChat.append(prev, [{
                    _id: Math.random(),
                    text: 'Error sending message.',
                    createdAt: new Date(),
                    user: botUser
                }]));
            }
        }
    }, [friendId, threadId, topic, companionId, botUser]);

    const onSend = useCallback((newMessages: IMessage[] = []) => {
        setMessages(prev => GiftedChat.append(prev, newMessages));
        const msgText = newMessages[0].text;
        lastUserMessageTime.current = Date.now();
        sendMessage(msgText);
        setText('');
    }, [sendMessage]);

    return {
        messages,
        text,
        setText,
        onSend,
        isTyping,
        isWaitingForResponse,
        currentUser,
        botUser
    };
}
