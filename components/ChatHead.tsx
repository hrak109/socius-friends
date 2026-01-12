import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Image, Animated, PanResponder, Dimensions, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, usePathname } from 'expo-router';
import { SOCIUS_AVATAR_MAP } from '../constants/avatars';

import { useTheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationContext';

const { width, height } = Dimensions.get('window');

export default function ChatHead() {
    const router = useRouter();
    const pan = useRef(new Animated.ValueXY()).current;
    const [isLoaded, setIsLoaded] = useState(false);
    const isDragging = useRef(false);
    const pathname = usePathname();
    const pathnameRef = useRef(pathname);
    const { avatarId } = useTheme();
    const { sociusUnreadCount } = useNotifications();

    // Keep pathname ref updated for PanResponder
    useEffect(() => {
        pathnameRef.current = pathname;
    }, [pathname]);

    const getContext = () => {
        const currentPath = pathnameRef.current;
        if (currentPath.startsWith('/bible')) return 'bible';
        if (currentPath.startsWith('/notes')) return 'notes';
        if (currentPath.startsWith('/diary')) return 'diary';
        return 'global';
    };

    useEffect(() => {
        const loadState = async () => {
            // Load Position
            try {
                const saved = await AsyncStorage.getItem('chat_head_pos');
                if (saved) {
                    const pos = JSON.parse(saved);
                    pan.setValue({ x: 0, y: 0 });
                    pan.setOffset({ x: pos.x, y: pos.y });
                } else {
                    pan.setValue({ x: 0, y: 0 });
                    pan.setOffset({ x: width - 80, y: height - 150 });
                }
            } catch {
                pan.setValue({ x: 0, y: 0 });
                pan.setOffset({ x: width - 80, y: height - 150 });
            }
            setIsLoaded(true);
        };
        loadState();
    }, [pan]);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                isDragging.current = false;
                pan.setOffset({
                    x: (pan.x as any)._value + (pan.x as any)._offset,
                    y: (pan.y as any)._value + (pan.y as any)._offset
                });
                pan.setValue({ x: 0, y: 0 });
            },
            onPanResponderMove: (e, gestureState) => {
                // Increased threshold from 2 to 6 to handle taps better
                if (Math.abs(gestureState.dx) > 6 || Math.abs(gestureState.dy) > 6) {
                    isDragging.current = true;
                }
                return Animated.event(
                    [null, { dx: pan.x, dy: pan.y }],
                    { useNativeDriver: false }
                )(e, gestureState);
            },
            onPanResponderRelease: async () => {
                const currentX = (pan.x as any)._value + (pan.x as any)._offset;
                const currentY = (pan.y as any)._value + (pan.y as any)._offset;

                const bubbleSize = 60;
                const margin = 5;

                // Enforce boundaries
                let finalX = currentX;
                let finalY = currentY;

                if (currentX < margin) finalX = margin;
                if (currentX > width - bubbleSize - margin) finalX = width - bubbleSize - margin;
                if (currentY < margin + 30) finalY = margin + 30; // Top margin + status bar approx
                if (currentY > height - bubbleSize - margin - 20) finalY = height - bubbleSize - margin - 20;

                pan.flattenOffset();

                // Animate to bound if needed
                if (finalX !== currentX || finalY !== currentY) {
                    Animated.spring(pan, {
                        toValue: { x: finalX, y: finalY },
                        useNativeDriver: false,
                        friction: 5
                    }).start();
                }

                if (!isDragging.current) {
                    const context = getContext();
                    router.push(`/chat?context=${context}` as any);
                }

                try {
                    await AsyncStorage.setItem('chat_head_pos', JSON.stringify({ x: finalX, y: finalY }));
                } catch {
                    console.log('Failed to save chat head pos');
                }
                isDragging.current = false;
            },
        })
    ).current;

    if (!isLoaded) return null;

    // Hide chat head on specific screens
    if (pathname === '/home' || pathname === '/chat' || pathname === '/') {
        return null;
    }

    return (
        <>
            <Animated.View
                {...panResponder.panHandlers}
                style={[
                    styles.chatHeadContainer,
                    {
                        transform: [{ translateX: pan.x }, { translateY: pan.y }]
                    }
                ]}
            >
                <View style={styles.avatarContainer}>
                    <Image
                        source={SOCIUS_AVATAR_MAP[avatarId] || SOCIUS_AVATAR_MAP['socius-icon']}
                        style={styles.avatarImage}
                    />
                    {sociusUnreadCount > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>
                                {sociusUnreadCount > 99 ? '99+' : sociusUnreadCount}
                            </Text>
                        </View>
                    )}
                </View>
            </Animated.View>
        </>
    );
}

const styles = StyleSheet.create({
    chatHeadContainer: {
        position: 'absolute',
        zIndex: 9999, // High z-index to sit on top
        top: 0,
        left: 0,
    },
    avatarContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        borderWidth: 2,
        borderColor: '#1a73e8',
    },
    avatarImage: {
        width: 50,
        height: 50,
        borderRadius: 25,
    },
    badge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#FF3B30',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
        borderWidth: 1.5,
        borderColor: '#fff',
    },
    badgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    modalKeyboardContainer: {
        flex: 1,
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'center', // Or flex-end if we want bottom-sheet style, but center is requested "fill screen more"
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.4)',
        paddingVertical: 50, // space from top/bottom
    },
    modalBackdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    protrudingChatContainer: {
        width: width * 0.9,
        height: '85%', // Increased height
        backgroundColor: '#fff',
        borderRadius: 20,
        overflow: 'hidden',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        borderWidth: 1,
        borderColor: '#eee',
    }
});
