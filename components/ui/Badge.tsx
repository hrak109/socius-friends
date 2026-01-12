/**
 * Reusable Badge component for notifications and counts.
 */
import React, { useEffect } from 'react';
import { Text, StyleSheet, ViewStyle } from 'react-native';
import { RADIUS } from '../../constants/design';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withSequence,
} from 'react-native-reanimated';

interface BadgeProps {
    count?: number;
    max?: number;
    variant?: 'primary' | 'secondary' | 'error' | 'success';
    size?: 'sm' | 'md' | 'lg';
    dot?: boolean;
    style?: ViewStyle;
    animated?: boolean;
}

const COLORS = {
    primary: '#1a73e8',
    secondary: '#607d8b',
    error: '#d93025',
    success: '#34a853',
};

export default function Badge({
    count,
    max = 99,
    variant = 'error',
    size = 'md',
    dot = false,
    style,
    animated = true,
}: BadgeProps) {
    const scale = useSharedValue(1);

    useEffect(() => {
        if (animated && count && count > 0) {
            scale.value = withSequence(
                withSpring(1.3, { damping: 4, stiffness: 400 }),
                withSpring(1, { damping: 6, stiffness: 300 })
            );
        }
    }, [count, animated, scale]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    if (!dot && (count === undefined || count <= 0)) {
        return null;
    }

    const getSizeStyles = () => {
        if (dot) {
            switch (size) {
                case 'sm': return { width: 8, height: 8, minWidth: 8 };
                case 'lg': return { width: 14, height: 14, minWidth: 14 };
                default: return { width: 10, height: 10, minWidth: 10 };
            }
        }

        switch (size) {
            case 'sm':
                return {
                    minWidth: 16,
                    height: 16,
                    paddingHorizontal: 4,
                    fontSize: 10,
                };
            case 'lg':
                return {
                    minWidth: 24,
                    height: 24,
                    paddingHorizontal: 8,
                    fontSize: 14,
                };
            default:
                return {
                    minWidth: 20,
                    height: 20,
                    paddingHorizontal: 6,
                    fontSize: 11,
                };
        }
    };

    const sizeStyles = getSizeStyles();
    const displayText = count && count > max ? `${max}+` : String(count);

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    backgroundColor: COLORS[variant],
                    minWidth: sizeStyles.minWidth,
                    height: sizeStyles.height,
                    paddingHorizontal: dot ? 0 : sizeStyles.paddingHorizontal,
                },
                animatedStyle,
                style,
            ]}
        >
            {!dot && (
                <Text style={[styles.text, { fontSize: sizeStyles.fontSize }]}>
                    {displayText}
                </Text>
            )}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: RADIUS.full,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#fff',
    },
    text: {
        color: '#fff',
        fontWeight: 'bold',
        textAlign: 'center',
    },
});
