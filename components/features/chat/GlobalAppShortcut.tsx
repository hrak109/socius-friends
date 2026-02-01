import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
    StyleSheet,
    View,
    TouchableOpacity,
    Text,
    Modal,
    Dimensions,
    Animated,
    PanResponder,
    Platform,
    TouchableWithoutFeedback
} from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { BlurView } from 'expo-blur';
import { DEFAULT_APPS } from '@/constants/apps';

const { width, height } = Dimensions.get('window');
const BUBBLE_SIZE = 48;
const TUCK_MARGIN = -10;
const STORAGE_KEY = 'global_app_shortcut_pos';

export default function GlobalAppShortcut() {
    const segments = useSegments();
    const router = useRouter();
    const { colors, isDark } = useTheme();
    const { t } = useLanguage();

    // -- All Hooks at the top --
    const [showModal, setShowModal] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const [modalPos, setModalPos] = useState({ top: 0, left: 0 });

    const pan = useRef(new Animated.ValueXY()).current;
    const isDragging = useRef(false);

    const isVisible = useMemo(() => {
        const segs = segments as string[];
        if (!segs.length || segs.includes('onboarding')) return false;
        const firstSegment = segs[0];
        if (firstSegment === 'index' || firstSegment === 'socius-setup') return false;
        return true;
    }, [segments]);

    // -- Logic Functions --
    const handleAppPress = useCallback((route: string) => {
        setShowModal(false);
        setTimeout(() => {
            router.push(route as any);
        }, 100);
    }, [router]);

    const openModal = useCallback(() => {
        // @ts-ignore
        const x = pan.x._value;
        // @ts-ignore
        const y = pan.y._value;

        let mLeft = x;
        let mTop = y;

        // Horizontal positioning: Left or Right of bubble
        const menuWidth = 180;
        if (x > width / 2) {
            mLeft = x - menuWidth + 10;
        } else {
            mLeft = x + BUBBLE_SIZE - 10;
        }

        // Vertical positioning: Above or Below bubble
        // 10 apps / 3 columns = 4 rows. 4 rows * ~60px = 240px + padding
        const menuHeight = 250;
        if (y > height - 300) {
            // If near bottom, show above the bubble
            mTop = y - menuHeight - 10;
        } else {
            // Otherwise show near the bubble top
            mTop = y;
        }

        // Boundary checks
        if (mLeft < 10) mLeft = 10;
        if (mLeft > width - menuWidth - 10) mLeft = width - menuWidth - 10;
        if (mTop < 40) mTop = 40;
        if (mTop > height - menuHeight - 40) mTop = height - menuHeight - 40;

        setModalPos({ top: mTop, left: mLeft });
        setShowModal(true);
    }, [pan.x, pan.y]);

    // Stable ref for openModal to be used in PanResponder
    const openModalRef = useRef(openModal);
    useEffect(() => {
        openModalRef.current = openModal;
    }, [openModal]);

    useEffect(() => {
        const loadPosition = async () => {
            try {
                const savedPos = await AsyncStorage.getItem(STORAGE_KEY);
                if (savedPos) {
                    const { x, y } = JSON.parse(savedPos);
                    pan.setValue({ x, y });
                } else {
                    const defaultX = width - BUBBLE_SIZE - 20;
                    const defaultY = height - 150;
                    pan.setValue({ x: defaultX, y: defaultY });
                }
            } catch {
                const defaultX = width - BUBBLE_SIZE - 20;
                pan.setValue({ x: defaultX, y: height - 150 });
            }
            setIsLoaded(true);
        };
        loadPosition();
    }, [pan]);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
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
                    openModalRef.current();
                    return;
                }

                // @ts-ignore
                const currentX = pan.x._value;
                // @ts-ignore
                const currentY = pan.y._value;

                let finalX = currentX;
                let finalY = currentY;

                if (finalY < 60) finalY = 60;
                if (finalY > height - 100) finalY = height - 100;

                const centerX = currentX + BUBBLE_SIZE / 2;
                if (centerX < width / 2) {
                    finalX = TUCK_MARGIN;
                } else {
                    finalX = width - BUBBLE_SIZE - TUCK_MARGIN;
                }

                Animated.spring(pan, {
                    toValue: { x: finalX, y: finalY },
                    useNativeDriver: false,
                    friction: 7,
                    tension: 40
                }).start();

                try {
                    await AsyncStorage.setItem(
                        STORAGE_KEY,
                        JSON.stringify({ x: finalX, y: finalY })
                    );
                } catch { /* ignore */ }
                isDragging.current = false;
            }
        })
    ).current;

    // -- Conditional Return --
    if (!isLoaded || !isVisible) return null;

    return (
        <>
            <Animated.View
                testID="shortcut-bubble"
                style={[
                    styles.chatHead,
                    { transform: pan.getTranslateTransform() }
                ]}
                {...panResponder.panHandlers}
            >
                <View style={[styles.bubble, { backgroundColor: colors.primary, opacity: 0.9 }]}>
                    <Ionicons name="apps" size={24} color="#fff" />
                </View>
            </Animated.View>

            <Modal
                visible={showModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowModal(false)}
            >
                <TouchableWithoutFeedback onPress={() => setShowModal(false)}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback>
                            <View style={[styles.glassContainer, { top: modalPos.top, left: modalPos.left, backgroundColor: isDark ? 'rgba(30,30,30,0.85)' : 'rgba(255,255,255,0.85)' }]}>
                                <BlurView
                                    intensity={Platform.OS === 'ios' ? 40 : 80}
                                    tint={isDark ? 'dark' : 'light'}
                                    style={styles.modalContent}
                                >
                                    <View style={styles.appsGrid}>
                                        {DEFAULT_APPS
                                            .filter(app => {
                                                if (segments[0] === 'messages' && app.id === 'messages') return false;
                                                return true;
                                            })
                                            .map((app) => (
                                                <TouchableOpacity
                                                    key={app.id}
                                                    style={styles.appItem}
                                                    onPress={() => handleAppPress(app.route)}
                                                >
                                                    <View style={[styles.appIcon, { backgroundColor: app.color, opacity: 0.9 }]}>
                                                        <Ionicons name={app.icon as any} size={20} color="#fff" />
                                                    </View>
                                                    <Text style={[styles.appLabel, { color: colors.text }]} numberOfLines={1}>
                                                        {t(app.label)}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                    </View>
                                </BlurView>
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    chatHead: {
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 9999,
    },
    bubble: {
        width: BUBBLE_SIZE,
        height: BUBBLE_SIZE,
        borderRadius: BUBBLE_SIZE / 2,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.15)',
    },
    glassContainer: {
        position: 'absolute',
        width: 190, // Slightly wider for 3 columns
        borderRadius: 20,
        overflow: 'hidden',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 15,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    modalContent: {
        paddingVertical: 14,
        paddingHorizontal: 12,
        alignItems: 'center',
    },
    appsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        width: '100%',
        columnGap: 4,
    },
    appItem: {
        width: '30%', // 3 columns
        alignItems: 'center',
        marginBottom: 12,
    },
    appIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    appLabel: {
        fontSize: 8.5,
        textAlign: 'center',
        fontWeight: '600',
    }
});
