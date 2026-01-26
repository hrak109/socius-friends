import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    StyleSheet,
    View,
    Image,
    TouchableOpacity,
    Text,
    Modal,
    Dimensions,
    Animated,
    PanResponder
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { SOCIUS_AVATAR_MAP } from '../constants/avatars';
import api from '../services/api';

const { width, height } = Dimensions.get('window');
const BUBBLE_SIZE = 56;
const TUCK_MARGIN = -15; // Negative to tuck in slightly

// Role information for create prompts
const ROLE_INFO: Record<string, { icon: string; color: string }> = {
    christian: { icon: 'book', color: '#8D6E63' },
    cal_tracker: { icon: 'nutrition', color: '#34C759' },
    secrets: { icon: 'key', color: '#5856D6' },
    workout: { icon: 'fitness', color: '#FF3B30' },
};

interface SociusFriend {
    id: string;
    name: string;
    avatar: string;
    role: string;
}

interface AppSpecificChatHeadProps {
    roleType: 'christian' | 'cal_tracker' | 'secrets' | 'workout';
    appContext: string;
}

export default function AppSpecificChatHead({ roleType, appContext }: AppSpecificChatHeadProps) {
    const router = useRouter();
    const { colors } = useTheme();
    const { t } = useLanguage();
    const [friend, setFriend] = useState<SociusFriend | null>(null);
    const [showModal, setShowModal] = useState(false);

    // Position State
    const pan = useRef(new Animated.ValueXY()).current;
    const [isLoaded, setIsLoaded] = useState(false);
    const isDragging = useRef(false);
    const friendRef = useRef<SociusFriend | null>(null);

    // Load Friend Data
    // Load Friend Data
    // Load Friend Data
    const loadFriend = useCallback(async () => {
        try {
            // Add timestamp to prevent caching
            const response = await api.get(`/friends/socius?_t=${Date.now()}`);
            const companions = response.data || [];


            const matchingFriend = companions.find((c: SociusFriend) => {
                if (roleType === 'cal_tracker') {
                    return c.role === 'cal_tracker' || c.role === 'tracker';
                }
                return c.role === roleType;
            });

            setFriend(matchingFriend || null);
            friendRef.current = matchingFriend || null;
        } catch (error) {

            setFriend(null);
        } finally {
        }
    }, [roleType]);

    useFocusEffect(
        useCallback(() => {
            loadFriend();
        }, [loadFriend])
    );

    // Position Handling
    // Note: Removed panValue ref to avoid Reanimated worklet warnings
    // Use pan.__getValue() directly when needed

    // Load Initial Position
    useEffect(() => {
        const loadPosition = async () => {
            try {
                const savedPos = await AsyncStorage.getItem(`chat_head_pos_${appContext}`);
                if (savedPos) {
                    const { x, y } = JSON.parse(savedPos);
                    pan.setValue({ x, y });
                } else {
                    const defaultX = width - BUBBLE_SIZE - TUCK_MARGIN;
                    const defaultY = 90;
                    pan.setValue({ x: defaultX, y: defaultY });
                }
            } catch {
                const defaultX = width - BUBBLE_SIZE - TUCK_MARGIN;
                pan.setValue({ x: defaultX, y: 90 });
            }
            setIsLoaded(true);
        };
        loadPosition();
    }, [appContext]);

    // Pan Responder with Standard Pattern
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                // extractOffset() atomically moves the current animated value into the offset
                // This prevents any visual jump - it's synchronous and doesn't require a callback
                pan.extractOffset();
                isDragging.current = false;
            },
            onPanResponderMove: (e, gestureState) => {
                if (Math.abs(gestureState.dx) > 6 || Math.abs(gestureState.dy) > 6) {
                    isDragging.current = true;
                }
                return Animated.event(
                    [null, { dx: pan.x, dy: pan.y }],
                    { useNativeDriver: false }
                )(e, gestureState);
            },
            onPanResponderRelease: async () => {
                pan.flattenOffset();

                if (!isDragging.current) {
                    handlePress();
                    return;
                }

                // Get current position using internal access
                // @ts-ignore - Animated.ValueXY internal property
                const currentX = pan.x._value;
                // @ts-ignore
                const currentY = pan.y._value;

                let finalX = currentX;
                let finalY = currentY;

                // Vertical bounds (safe area approx)
                if (finalY < 60) finalY = 60;
                if (finalY > height - 100) finalY = height - 100;

                // Horizontal Snap to Edge
                // Center of bubble
                const centerX = currentX + BUBBLE_SIZE / 2;
                if (centerX < width / 2) {
                    // Snap Left
                    finalX = TUCK_MARGIN;
                } else {
                    // Snap Right
                    finalX = width - BUBBLE_SIZE - TUCK_MARGIN;
                }

                Animated.spring(pan, {
                    toValue: { x: finalX, y: finalY },
                    useNativeDriver: false,
                    friction: 6,
                    tension: 40
                }).start();

                // Save persistence
                try {
                    await AsyncStorage.setItem(
                        `chat_head_pos_${appContext}`,
                        JSON.stringify({ x: finalX, y: finalY })
                    );
                } catch {
                    console.warn('Failed to save chat head pos');
                }
                isDragging.current = false;
            }
        })
    ).current;

    const handlePress = () => {
        const currentFriend = friendRef.current;
        if (currentFriend) {
            router.push({
                pathname: '/chat/[id]',
                params: {
                    id: `socius-${currentFriend.id}`,
                    type: 'socius',
                    name: currentFriend.name,
                    avatar: currentFriend.avatar,
                    sociusRole: currentFriend.role
                }
            } as any);
        } else {
            setShowModal(true);
        }
    };

    const handleCreateFriend = () => {
        setShowModal(false);
        router.push(`/socius-setup?preselectedRole=${roleType}` as any);
    };

    const getPromptTitle = () => {
        const key = `socius.create_prompt_${roleType}` as any;
        return t(key) || t('socius.create_prompt_title') || 'Create Your AI Friend';
    };

    const getPromptDescription = () => {
        const descKey = `socius.${roleType}_description` as any;
        return t(descKey) || '';
    };

    if (!isLoaded) return null;

    const roleInfo = ROLE_INFO[roleType];

    return (
        <>
            {/* Draggable Chat Head */}
            <Animated.View
                style={[
                    styles.chatHead,
                    { transform: pan.getTranslateTransform() }
                ]}
                {...panResponder.panHandlers}
            >
                <View style={[styles.avatarContainer, { borderColor: roleInfo.color }]}>
                    {friend ? (
                        <Image
                            source={SOCIUS_AVATAR_MAP[friend.avatar] || SOCIUS_AVATAR_MAP['socius-avatar-0']}
                            style={styles.avatarImage}
                        />
                    ) : (
                        <View style={[styles.createPrompt, { backgroundColor: roleInfo.color }]}>
                            <Ionicons name={roleInfo.icon as any} size={24} color="#fff" />
                            <View style={styles.plusBadge}>
                                <Ionicons name="add" size={12} color="#fff" />
                            </View>
                        </View>
                    )}
                </View>
            </Animated.View>

            {/* Create Prompt Modal */}
            <Modal
                visible={showModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowModal(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowModal(false)}
                >
                    <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                        <View style={[styles.iconCircle, { backgroundColor: roleInfo.color }]}>
                            <Ionicons name={roleInfo.icon as any} size={40} color="#fff" />
                        </View>

                        <Text style={[styles.modalTitle, { color: colors.text }]}>
                            {getPromptTitle()}
                        </Text>

                        <Text style={[styles.modalDescription, { color: colors.textSecondary }]}>
                            {getPromptDescription()}
                        </Text>

                        <TouchableOpacity
                            style={[styles.createButton, { backgroundColor: roleInfo.color }]}
                            onPress={handleCreateFriend}
                        >
                            <Text style={styles.createButtonText}>
                                {t('socius.create_button') || 'Create Friend'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={() => setShowModal(false)}
                        >
                            <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>
                                {t('common.cancel') || 'Cancel'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    chatHead: {
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 1000,
    },
    avatarContainer: {
        width: BUBBLE_SIZE,
        height: BUBBLE_SIZE,
        borderRadius: BUBBLE_SIZE / 2,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        borderWidth: 2,
    },
    avatarImage: {
        width: BUBBLE_SIZE - 8,
        height: BUBBLE_SIZE - 8,
        borderRadius: (BUBBLE_SIZE - 8) / 2,
    },
    createPrompt: {
        width: BUBBLE_SIZE - 8,
        height: BUBBLE_SIZE - 8,
        borderRadius: (BUBBLE_SIZE - 8) / 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    plusBadge: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        backgroundColor: '#4285f4',
        borderRadius: 8,
        width: 16,
        height: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#fff',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        width: width * 0.85,
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 12,
    },
    modalDescription: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24,
    },
    createButton: {
        width: '100%',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 12,
    },
    createButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    cancelButton: {
        paddingVertical: 8,
    },
    cancelButtonText: {
        fontSize: 14,
    },
});
