import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    runOnJS,
    useAnimatedReaction,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

const ITEM_WIDTH = 70;
const ITEM_HEIGHT = 80;
const MARGIN_RIGHT = 12;
const MARGIN_BOTTOM = 8;
const FULL_ITEM_WIDTH = ITEM_WIDTH + MARGIN_RIGHT;

// We assume the list is processed in column-major order for the "Split" layout? 
// No, the user wants 2 rows. 
// Standard flow:
// 0 2 4 6
// 1 3 5 7
// This corresponds to Column-Major filling if we view it as columns [0,1], [2,3]...
// Or Row-Major:
// 0 1 2 3
// 4 5 6 7
// The split list implementation used: 0,2,4... on top and 1,3,5... on bottom.
// Let's stick to that "Column Flow" Logic where index 0 is top-left, index 1 is bottom-left.

interface AppItem {
    id: string;
    label: string;
    icon: string;
    color: string;
    route: string;
}

interface DraggableAppsGridProps {
    apps: AppItem[];
    onOrderChange: (newApps: AppItem[]) => void;
    onAppPress: (app: AppItem) => void;
}

const SortableItem = ({
    id,
    index,
    app,
    positions,
    onDragEnd,
    onPress,
    scrollViewPadding = 16
}: {
    id: string;
    index: number;
    app: AppItem;
    positions: any;
    onDragEnd: (from: number, to: number) => void;
    onPress: () => void;
    scrollViewPadding?: number;
}) => {
    const { colors } = useTheme();
    const { t } = useLanguage();
    const isGestureActive = useSharedValue(false);

    // Calculate position based on "Column Flow":
    // Index i:
    // col = floor(i / 2)
    // row = i % 2
    const getPosition = (i: number) => {
        'worklet';
        return {
            x: Math.floor(i / 2) * FULL_ITEM_WIDTH + scrollViewPadding,
            y: (i % 2) * (ITEM_HEIGHT + MARGIN_BOTTOM)
        };
    };

    const position = getPosition(index);
    const translateX = useSharedValue(position.x);
    const translateY = useSharedValue(position.y);

    // Track start positions for gesture
    const startX = useSharedValue(0);
    const startY = useSharedValue(0);

    useAnimatedReaction(
        () => positions.value[id],
        (newOrder) => {
            if (!isGestureActive.value && newOrder !== undefined) {
                const newPos = getPosition(newOrder);
                translateX.value = withSpring(newPos.x);
                translateY.value = withSpring(newPos.y);
            }
        },
        [positions, id]
    );

    const panGesture = Gesture.Pan()
        .activateAfterLongPress(300)
        .onStart(() => {
            startX.value = translateX.value;
            startY.value = translateY.value;
            isGestureActive.value = true;
        })
        .onUpdate((event) => {
            translateX.value = startX.value + event.translationX;
            translateY.value = startY.value + event.translationY;

            const relativeX = translateX.value - scrollViewPadding + (ITEM_WIDTH / 2);
            const relativeY = translateY.value + (ITEM_HEIGHT / 2);

            let col = Math.floor(relativeX / FULL_ITEM_WIDTH);
            if (col < 0) col = 0;

            let row = Math.floor(relativeY / (ITEM_HEIGHT + MARGIN_BOTTOM));
            if (row < 0) row = 0;
            if (row > 1) row = 1;

            const targetIndex = col * 2 + row;
            // We need to access the total count from positions keys length?
            // Since positions is shared value, Object.keys works if it's a JS object?
            // SharedValue holding object: we can access it.
            const maxIndex = Object.keys(positions.value).length - 1;
            const clampedIndex = Math.min(targetIndex, maxIndex);

            const oldOrder = positions.value[id];
            if (oldOrder !== clampedIndex) {
                const newPositions = { ...positions.value };
                if (oldOrder < clampedIndex) {
                    for (const key in newPositions) {
                        const val = newPositions[key];
                        if (val > oldOrder && val <= clampedIndex) {
                            newPositions[key] = val - 1;
                        }
                    }
                } else {
                    for (const key in newPositions) {
                        const val = newPositions[key];
                        if (val >= clampedIndex && val < oldOrder) {
                            newPositions[key] = val + 1;
                        }
                    }
                }
                newPositions[id] = clampedIndex;
                positions.value = newPositions;
            }
        })
        .onFinalize(() => {
            isGestureActive.value = false;
            const finalOrder = positions.value[id];
            const finalPos = getPosition(finalOrder);
            translateX.value = withSpring(finalPos.x);
            translateY.value = withSpring(finalPos.y);
            runOnJS(onDragEnd)(0, 0);
        });

    const animatedStyle = useAnimatedStyle(() => {
        return {
            position: 'absolute',
            top: 0,
            left: 0,
            width: ITEM_WIDTH,
            height: ITEM_HEIGHT,
            transform: [
                { translateX: translateX.value },
                { translateY: translateY.value },
                { scale: withSpring(isGestureActive.value ? 1.1 : 1) },
            ],
            zIndex: isGestureActive.value ? 100 : 1,
        };
    });

    return (
        <GestureDetector gesture={panGesture}>
            <Animated.View style={animatedStyle}>
                <TouchableOpacity
                    onPress={onPress}
                    onLongPress={() => { }}
                    delayLongPress={200}
                    activeOpacity={0.8}
                    style={styles.appItem}
                >
                    {id === 'socius' ? (
                        <View style={[styles.appIcon, { backgroundColor: 'transparent', shadowColor: app.color, overflow: 'hidden' }]}>
                            <Image source={require('../assets/images/socius-rainbow.png')} style={{ width: 48, height: 48, position: 'absolute' }} />
                            <Ionicons name={app.icon as any} size={24} color="#fff" />
                        </View>
                    ) : (
                        <View style={[styles.appIcon, { backgroundColor: app.color, shadowColor: app.color }]}>
                            <Ionicons name={app.icon as any} size={24} color="#fff" />
                        </View>
                    )}
                    <Text style={[styles.appLabel, { color: colors.text }]} numberOfLines={1}>{t(app.label)}</Text>
                </TouchableOpacity>
            </Animated.View>
        </GestureDetector>
    );
};

export const DraggableAppsGrid = ({ apps, onOrderChange, onAppPress }: DraggableAppsGridProps) => {
    // Shared value for current positions: { [id]: index }
    const positions = useSharedValue<{ [key: string]: number }>({});

    useEffect(() => {
        const initialPositions: { [key: string]: number } = {};
        apps.forEach((app, index) => {
            initialPositions[app.id] = index;
        });
        positions.value = initialPositions;
    }, [apps]); // Reset when external apps prop changes significantly?
    // Actually we only want to init once or when mode changes.

    // We need to keep a ref to current apps to reorder them based on positions on drop
    const appsRef = useRef(apps);
    appsRef.current = apps;

    const handleDragEnd = () => {
        const newOrderIndex = positions.value;
        const newApps = [...appsRef.current];
        newApps.sort((a, b) => newOrderIndex[a.id] - newOrderIndex[b.id]);
        onOrderChange(newApps);
    };

    const containerWidth = Math.ceil(apps.length / 2) * FULL_ITEM_WIDTH + 32; // + padding

    return (
        <View style={{ height: 180 }}>
            <Animated.ScrollView
                horizontal
                contentContainerStyle={{ width: containerWidth, height: 180 }}
                showsHorizontalScrollIndicator={false}
            >
                {apps.map((app, index) => (
                    <SortableItem
                        key={app.id}
                        id={app.id}
                        index={index}
                        app={app}
                        positions={positions}
                        onDragEnd={handleDragEnd}
                        onPress={() => onAppPress(app)}
                    />
                ))}
            </Animated.ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    appItem: {
        alignItems: 'center',
        width: ITEM_WIDTH,
        height: ITEM_HEIGHT,
        justifyContent: 'center',
    },
    appIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    appLabel: {
        fontSize: 10,
        fontWeight: '500',
        textAlign: 'center',
    },
});
