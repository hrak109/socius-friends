import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import * as Device from 'expo-device';
import api from '../services/api';
import { useSession } from './AuthContext';
import * as Notifications from 'expo-notifications';
import { createNotificationStream, closeNotificationStream } from '../services/eventSource';
import { router } from 'expo-router';

interface NotificationContextType {
    unreadCount: number;
    sociusUnreadCount: number;
    unreadDirectMessages: number;
    friendRequests: number;
    lastNotificationTime: Date | null;
    lastMessage: { id: number; message_group_id: string; content: string; timestamp: number } | null;
    lastDM: { id: number; senderId: number; content: string; timestamp: number } | null;
    refreshNotifications: () => Promise<void>;
    setRouteSegments: (segments: string[]) => void;
    typingThreads: Set<string>;
    setTyping: (id: string, isTyping: boolean) => void;
}

const NotificationContext = createContext<NotificationContextType>({
    unreadCount: 0,
    sociusUnreadCount: 0,
    unreadDirectMessages: 0,
    friendRequests: 0,
    lastNotificationTime: null,
    lastMessage: null,
    lastDM: null,
    refreshNotifications: async () => { },
    setRouteSegments: () => { },
    typingThreads: new Set(),
    setTyping: () => { },
});

export const useNotifications = () => useContext(NotificationContext);

export function NotificationProvider({ children }: { children: ReactNode }) {
    const { session, signOut } = useSession();
    const [unreadCount, setUnreadCount] = useState(0);
    const [sociusUnreadCount, setSociusUnreadCount] = useState(0);
    const [unreadDirectMessages, setUnreadDirectMessages] = useState(0);
    const [friendRequests, setFriendRequests] = useState(0);
    const [lastNotificationTime, setLastNotificationTime] = useState<Date | null>(null);
    const [lastMessage, setLastMessage] = useState<{ id: number; message_group_id: string; content: string; timestamp: number } | null>(null);
    const [lastDM, setLastDM] = useState<{ id: number; senderId: number; content: string; timestamp: number } | null>(null);
    const [typingThreads, setTypingThreads] = useState<Set<string>>(new Set());
    const typingTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
    const sseCleanupRef = useRef<(() => void) | null>(null);
    const segmentsRef = useRef<string[]>([]);

    const setRouteSegments = useCallback((segments: string[]) => {
        segmentsRef.current = segments;
    }, []);

    const setTyping = useCallback((id: string, isTyping: boolean) => {
        if (isTyping) {
            // Prevent resetting the timer if it's already running (e.g. component reload)
            if (typingTimeoutsRef.current.has(id)) {
                return;
            }

            // Set 5-minute auto-clear timeout
            const timeout = setTimeout(() => {
                setTypingThreads(p => {
                    const s = new Set(p);
                    s.delete(id);
                    return s;
                });
                typingTimeoutsRef.current.delete(id);
            }, 5 * 60 * 1000); // 5 minutes

            typingTimeoutsRef.current.set(id, timeout);

            setTypingThreads(prev => {
                const newSet = new Set(prev);
                newSet.add(id);
                return newSet;
            });
        } else {
            // Clear any existing timeout for this id
            const existingTimeout = typingTimeoutsRef.current.get(id);
            if (existingTimeout) {
                clearTimeout(existingTimeout);
                typingTimeoutsRef.current.delete(id);
            }

            setTypingThreads(prev => {
                const newSet = new Set(prev);
                newSet.delete(id);
                return newSet;
            });
        }
    }, []);

    const refreshNotifications = useCallback(async () => {
        if (!session) return;
        try {
            const res = await api.get('/notifications/unread');
            const total = res.data.total;
            const socius = res.data.socius_unread || 0;
            const messages = res.data.unread_messages || 0;
            const friends = res.data.friend_requests || 0;

            setUnreadCount(total);
            setSociusUnreadCount(socius);
            setUnreadDirectMessages(messages);
            setFriendRequests(friends);

            // Fix: sum all notifications for the badge count to match what user sees
            // total from API might be just unread_notifications, but we want the red badge to reflect everything
            const badgeCount = socius + messages + friends;
            // Use Math.max to ensure we don't set negative, and prefer our calculated sum
            await Notifications.setBadgeCountAsync(Math.max(total, badgeCount));
        } catch (error: any) {

            if (error.response?.status === 401) {

                signOut();
            }
        }
    }, [session, signOut]);

    const registerForPushNotifications = useCallback(async () => {
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
            });
        }

        if (!Device.isDevice) {

            return;
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        if (finalStatus !== 'granted') {

            return;
        }

        try {
            const pushTokenString = (await Notifications.getDevicePushTokenAsync()).data;


            // Send to backend
            if (pushTokenString) {
                await api.post('/notifications/token', { token: pushTokenString, app_id: 'socius-friends' });

            }
        } catch (e: any) {
            console.error('Error fetching push token:', e);
        }
    }, []);

    const handleNotificationResponse = useCallback((response: Notifications.NotificationResponse) => {
        const url = response.notification.request.content.data?.url as string | undefined;
        if (url && url.startsWith('socius-friends://')) {

            try {
                const path = url.replace('socius-friends://', '');
                const route = path.startsWith('/') ? path : `/${path}`;

                // Parse params
                const pathParts = route.split('?')[0].split('/').filter(Boolean);
                const targetId = pathParts[pathParts.length - 1]; // chat, [id] or just chat
                const currentSegments = segmentsRef.current; // access via ref to be fresh

                const isOnChat = currentSegments.some(s => s === 'chat');
                const isSameId = currentSegments.some(s => s === targetId);

                if (isOnChat && isSameId) {

                    return;
                }

                setTimeout(() => {
                    router.push(route as any);
                }, 500);
            } catch (e) {
                console.error('Failed to handle deep link:', e);
            }
        }
    }, []);

    useEffect(() => {
        if (session) {
            refreshNotifications();

            // Set up SSE stream for real-time updates
            const setupSSE = async () => {
                const cleanup = await createNotificationStream(
                    (event) => {
                        if (event.type === 'message') {
                            // New Socius message arrived
                            const groupId = event.data?.message_group_id;
                            if (groupId) {
                                // Clear typing status for this thread
                                setTyping(groupId, false);

                                // Also handle full ID if it starts with socius-
                                if (event.data?.sender_id) {
                                    setTyping(`socius-${event.data.sender_id}`, false);
                                }
                            }

                            setLastNotificationTime(new Date());
                            setLastMessage({
                                id: event.data?.id || Date.now(),
                                message_group_id: groupId || 'default',
                                content: event.data?.content || '',
                                timestamp: Date.now()
                            });
                            refreshNotifications();
                        } else if (event.type === 'dm') {
                            // New direct message arrived - clear typing for sender
                            const senderId = event.data?.sender_id;
                            if (senderId) {
                                setTyping(`user-${senderId}`, false);
                            }
                            setLastNotificationTime(new Date());
                            setLastDM({
                                id: event.data?.id || Date.now(),
                                senderId: senderId || 0,
                                content: event.data?.content || '',
                                timestamp: Date.now()
                            });
                            refreshNotifications();
                        } else if (event.type === 'connected') {

                        }
                    },
                    (error: any) => {
                        const errorMsg = error?.message || String(error);
                        const xhrStatus = error?.xhrStatus;

                        // Check for 401 Unauthorized
                        if (xhrStatus === 401 || errorMsg.includes('401')) {

                            signOut();
                            return; // Stop reconnection
                        }

                        const isConnectionAbort = errorMsg.includes('Software caused connection abort') ||
                            errorMsg.includes('Network request failed') ||
                            errorMsg.includes('closed');

                        if (isConnectionAbort) {

                        } else {
                            console.error('SSE error, will attempt reconnect:', error);
                        }
                        // Attempt to reconnect after 5 seconds
                        setTimeout(setupSSE, 5000);
                    }
                );
                sseCleanupRef.current = cleanup;
            };

            setupSSE();
            registerForPushNotifications();

            // App state handling for reconnection
            const handleAppStateChange = (nextAppState: AppStateStatus) => {
                if (nextAppState === 'active') {

                    // Clear all typing indicators on resume - SSE events may have been missed
                    // Fresh history fetch will accurately show message state
                    setTypingThreads(new Set());
                    typingTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
                    typingTimeoutsRef.current.clear();

                    // Reconnect SSE when app becomes active
                    if (sseCleanupRef.current) {
                        sseCleanupRef.current();
                    }
                    setupSSE();
                    refreshNotifications();
                    // Force a global refresh of components
                    setLastNotificationTime(new Date());
                } else if (nextAppState === 'background') {
                    // Close SSE when app goes to background to save resources
                    if (sseCleanupRef.current) {
                        sseCleanupRef.current();
                        sseCleanupRef.current = null;
                    }
                }
            };
            const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

            // Push notification listeners (for when FCM delivers)
            const subscription = Notifications.addNotificationReceivedListener(_notification => {
                refreshNotifications();
                setLastNotificationTime(new Date());
            });
            const backgroundSubscription = Notifications.addNotificationResponseReceivedListener(async (response) => {
                refreshNotifications();
                setLastNotificationTime(new Date());
                handleNotificationResponse(response);
            });

            // Check for initial notification (Cold Start)
            Notifications.getLastNotificationResponseAsync().then(response => {
                if (response) {

                    handleNotificationResponse(response);
                }
            });



            return () => {
                appStateSubscription.remove();
                subscription.remove();
                backgroundSubscription.remove();
                if (sseCleanupRef.current) {
                    sseCleanupRef.current();
                    sseCleanupRef.current = null;
                }
                closeNotificationStream();
            };
        }
    }, [session, refreshNotifications, handleNotificationResponse, registerForPushNotifications]);

    return (
        <NotificationContext.Provider value={{
            unreadCount,
            sociusUnreadCount,
            unreadDirectMessages,
            friendRequests,
            lastNotificationTime,
            lastMessage,
            lastDM,
            refreshNotifications,
            setRouteSegments,
            typingThreads,
            setTyping
        }}>
            {children}
        </NotificationContext.Provider>
    );
}
