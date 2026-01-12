/**
 * Reusable Card component with consistent styling from design system.
 */
import React from 'react';
import { View, ViewStyle, Pressable } from 'react-native';
import { SPACING, RADIUS, SHADOWS } from '../../constants/design';
import { useTheme } from '../../context/ThemeContext';

interface CardProps {
    children: React.ReactNode;
    style?: ViewStyle;
    variant?: 'default' | 'elevated' | 'outlined';
    onPress?: () => void;
    padding?: 'none' | 'sm' | 'md' | 'lg';
}

export default function Card({
    children,
    style,
    variant = 'default',
    onPress,
    padding = 'md'
}: CardProps) {
    const { colors } = useTheme();

    const getPadding = () => {
        switch (padding) {
            case 'none': return 0;
            case 'sm': return SPACING.sm;
            case 'lg': return SPACING.xl;
            case 'md':
            default: return SPACING.lg;
        }
    };

    const getVariantStyle = (): ViewStyle => {
        switch (variant) {
            case 'elevated':
                return {
                    backgroundColor: colors.card,
                    ...SHADOWS.lg,
                };
            case 'outlined':
                return {
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    borderColor: colors.border,
                };
            case 'default':
            default:
                return {
                    backgroundColor: colors.card,
                    ...SHADOWS.sm,
                };
        }
    };

    const cardStyle: ViewStyle = {
        borderRadius: RADIUS.lg,
        padding: getPadding(),
        ...getVariantStyle(),
    };

    if (onPress) {
        return (
            <Pressable
                onPress={onPress}
                style={({ pressed }) => [
                    cardStyle,
                    pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
                    style,
                ]}
            >
                {children}
            </Pressable>
        );
    }

    return (
        <View style={[cardStyle, style]}>
            {children}
        </View>
    );
}
