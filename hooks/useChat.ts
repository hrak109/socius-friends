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
    message_group_id = 'default',
    friendId,
    companionId,
    friendName,
    friendAvatar,
    initialMessage
}: {
    message_group_id?: string;
    friendId?: number;
    companionId?: number;
    friendName?: string;
    friendAvatar?: string;
    initialMessage?: string;
}) {
    const { user } = useAuth();
    const { displayName, displayAvatar, googlePhotoUrl } = useUserProfile();
    const { t } = useLanguage();
    const { refreshNotifications, lastMessage, lastDM, lastNotificationTime, setTyping, typingThreads } = useNotifications();

    const [messages, setMessages] = useState<IMessage[]>([]);
    const [text, setText] = useState(initialMessage || '');
    const [isTyping, setIsTyping] = useState(false);
    const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
    const [isLoadingEarlier, setIsLoadingEarlier] = useState(false);
    const [canLoadMore, setCanLoadMore] = useState(true);

    const responseTimeoutRef = useRef<any>(null);

    useEffect(() => {
        return () => {
            if (responseTimeoutRef.current) clearTimeout(responseTimeoutRef.current);
        };
    }, []);
    const processedMessageIds = useRef<Set<number>>(new Set());
    const lastUserMessageTime = useRef<number>(0);
    const lastProcessedSseId = useRef<number | null>(null); // Track last processed SSE to avoid re-processing on remount
    const mountTime = useRef<number>(Date.now());

    const threadId = friendId ? `user-${friendId}` : (companionId ? `socius-${companionId}` : message_group_id);

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
            const uri = googlePhotoUrl || user?.photo;
            if (uri) avatarSource = { uri };
        } else if (displayAvatar && PROFILE_AVATAR_MAP[displayAvatar]) {
            avatarSource = PROFILE_AVATAR_MAP[displayAvatar];
        } else if (displayAvatar && displayAvatar.startsWith('http')) {
            avatarSource = { uri: displayAvatar };
        } else {
            // Fallback: prioritize googlePhotoUrl, then user.photo
            const uri = googlePhotoUrl || user?.photo;
            if (uri) avatarSource = { uri };
        }

        return {
            _id: 1,
            name: displayName || user?.name || 'Me',
            avatar: avatarSource,
        };
    }, [displayName, user, displayAvatar]);

    // --- Effects ---

    // Sync waiting state with global typing state
    const isGlobalTyping = typingThreads.has(threadId) || typingThreads.has(message_group_id);
    useEffect(() => {
        setIsWaitingForResponse(isGlobalTyping);
        setIsTyping(isGlobalTyping);
    }, [isGlobalTyping]);

    // SSE Listener
    useEffect(() => {
        const matchesTopic = (lastMessage?.message_group_id === message_group_id || lastMessage?.message_group_id === threadId);
        // And it hasn't been processed by this instance yet
        if (lastMessage && lastMessage.content && matchesTopic && lastMessage.timestamp > mountTime.current) {
            if (lastMessage.id === lastProcessedSseId.current) return;
            lastProcessedSseId.current = lastMessage.id;

            if (processedMessageIds.current.has(lastMessage.id)) return;
            processedMessageIds.current.add(lastMessage.id);

            const newMsg: IMessage = {
                _id: String(lastMessage.id),
                text: lastMessage.content,
                createdAt: new Date(),
                user: botUser,
            };
            setMessages((prev) => {
                if (prev.some(m => m._id === newMsg._id)) return prev;
                return GiftedChat.append(prev, [newMsg]);
            });

            // ... same clean-up ...
            setIsTyping(false);
            setIsWaitingForResponse(false);
            setTyping(threadId, false);
            setTyping(message_group_id, false);
            if (responseTimeoutRef.current) clearTimeout(responseTimeoutRef.current);
        }
    }, [lastMessage, message_group_id, threadId, botUser, setTyping]);

    // DM Listener
    useEffect(() => {
        if (friendId && lastDM && lastDM.senderId === friendId) {
            setTyping(`user-${friendId}`, false);
        }
    }, [lastDM, friendId, setTyping]);

    // Initial Message hydration
    useEffect(() => {
        if (initialMessage) {
            setTimeout(() => {
                setText(initialMessage);
            }, 100);
        }
    }, [initialMessage]);

    // History Fetching
    useFocusEffect(
        useCallback(() => {
            let isActive = true;

            const fetchHistory = async () => {
                const cacheKey = friendId ? `user-${friendId}` : (companionId ? `socius-${companionId}` : message_group_id);
                const cached = await getCachedMessages(cacheKey);

                if (cached.length > 0 && isActive) {
                    const restored = cached.map((m) => {
                        if (m._id) processedMessageIds.current.add(Number(m._id)); // Add to processed set as number for future checks if API returns numbers
                        return { ...m, _id: String(m._id), createdAt: new Date(m.createdAt) } as IMessage;
                    });
                    setMessages(restored);
                }

                try {
                    let history: any[] = [];
                    if (friendId) {
                        const res = await api.get(`/messages/${friendId}`);
                        history = res.data || [];
                    } else {
                        const res = await api.get('/history', { params: { message_group_id } });
                        history = res.data || [];
                    }

                    if (!isActive) return;

                    const formatted: IMessage[] = history.map((msg: any) => {
                        if (msg.id) processedMessageIds.current.add(msg.id);
                        const isFromMe = friendId ? msg.is_me : (msg.message_author === 'user' || msg.role === 'user');
                        return {
                            _id: msg.id ? String(msg.id) : String(Math.random()),
                            text: String(msg.content || ''),
                            createdAt: fixTimestamp(msg.created_at),
                            user: isFromMe ? currentUser : botUser,
                        };
                    });

                    if (formatted.length === 0 && !friendId) {
                        // Welcome message only for Socius
                        setMessages([{ _id: 'welcome', text: t('chat.welcome') || 'Hello!', createdAt: new Date(), user: botUser }]);
                    } else {
                        const reversed = formatted.reverse();
                        // Deduplicate against what might have arrived via SSE while fetching
                        setMessages(prev => {
                            const prevIds = new Set(prev.map(m => m._id));
                            const uniqueNew = reversed.filter(m => !prevIds.has(m._id));
                            return GiftedChat.append(prev, uniqueNew);
                        });
                        // ... same logic for typing and caching ...

                        // Resume typing state logic
                        const lastMsg = reversed[0];
                        if (lastMsg?.user._id === 1 && !friendId) {
                            // Last was user, should be waiting
                            setTyping(threadId, true);
                            setTyping(message_group_id, true);
                            setIsTyping(true);
                            setIsWaitingForResponse(true);
                        } else {
                            // Clear if bot replied
                            setTyping(threadId, false);
                            setTyping(message_group_id, false);
                            setIsTyping(false);
                            setIsWaitingForResponse(false);
                        }

                        // Cache update
                        const toCache: CachedMessage[] = reversed.map(m => ({
                            _id: String(m._id),
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
        }, [message_group_id, friendId, lastNotificationTime, currentUser, botUser, companionId, setTyping, refreshNotifications, t])
    );
    // Load Earlier Messages (Pagination)
    const loadEarlierMessages = useCallback(async () => {
        if (isLoadingEarlier || !canLoadMore) return;
        setIsLoadingEarlier(true);

        try {
            // Find the oldest message ID
            const oldestId = messages[messages.length - 1]?._id;
            if (!oldestId || typeof oldestId !== 'number') {
                setCanLoadMore(false);
                return;
            }

            let history: any[] = [];
            if (friendId) {
                const res = await api.get(`/messages/${friendId}`, { params: { before_id: oldestId } });
                history = res.data || [];
            } else {
                const res = await api.get('/history', { params: { message_group_id, before_id: oldestId } });
                history = res.data || [];
            }

            if (history.length === 0) {
                setCanLoadMore(false);
                return;
            }

            const formatted: IMessage[] = history.map((msg: any) => {
                if (msg.id) processedMessageIds.current.add(msg.id);
                const isFromMe = friendId ? msg.is_me : (msg.message_author === 'user' || msg.role === 'user');
                return {
                    _id: String(msg.id), // String ID
                    text: String(msg.content || ''),
                    createdAt: fixTimestamp(msg.created_at),
                    user: isFromMe ? currentUser : botUser,
                };
            });

            // GiftedChat messages are newest first. Earlier messages go to the end of the array.
            const reversed = formatted.reverse();
            setMessages(prev => {
                const existingIds = new Set(prev.map(m => m._id));
                const uniqueEarlier = reversed.filter(m => !existingIds.has(m._id));
                return [...prev, ...uniqueEarlier];
            });

            if (history.length < 50) {
                setCanLoadMore(false);
            }
        } catch (e) {
            console.error('Failed to load earlier messages', e);
        } finally {
            setIsLoadingEarlier(false);
        }
    }, [isLoadingEarlier, canLoadMore, messages, friendId, message_group_id, currentUser, botUser]);

    // Sending Logic
    const sendMessage = useCallback(async (msgText: string) => {
        const TYPING_TIMEOUT = 5 * 60 * 1000;

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
                setMessages(prev => GiftedChat.append(prev, [{
                    _id: String(Math.random()),
                    text: t('chat.error_not_sent'),
                    createdAt: new Date(),
                    user: botUser
                }]));
            }, TYPING_TIMEOUT);

            try {
                const response = await api.post('/ask', {
                    q_text: msgText,
                    message_group_id
                });
            } catch (e) {
                console.error('Ask Error', e);
                setIsTyping(false);
                setTyping(threadId, false);
                setMessages(prev => GiftedChat.append(prev, [{
                    _id: String(Math.random()),
                    text: 'Error sending message.',
                    createdAt: new Date(),
                    user: botUser
                }]));
            }
        }
    }, [friendId, threadId, message_group_id, companionId, botUser, t]);

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
        isLoadingEarlier,
        canLoadMore,
        loadEarlierMessages,
        currentUser,
        botUser
    };
}
