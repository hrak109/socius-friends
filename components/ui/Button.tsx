/**
 * Reusable Button component with multiple variants and sizes.
 */
import React from 'react';
import {
    Text,
    Pressable,
    ActivityIndicator,
    ViewStyle,
    TextStyle
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../constants/design';
import { useTheme } from '../../context/ThemeContext';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ButtonProps {
    title: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    icon?: keyof typeof Ionicons.glyphMap;
    iconPosition?: 'left' | 'right';
    loading?: boolean;
    disabled?: boolean;
    fullWidth?: boolean;
    style?: ViewStyle;
}

export default function Button({
    title,
    onPress,
    variant = 'primary',
    size = 'md',
    icon,
    iconPosition = 'left',
    loading = false,
    disabled = false,
    fullWidth = false,
    style,
}: ButtonProps) {
    const { colors } = useTheme();
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const handlePressIn = () => {
        scale.value = withSpring(0.96, { damping: 15, stiffness: 400 });
    };

    const handlePressOut = () => {
        scale.value = withSpring(1, { damping: 15, stiffness: 400 });
    };

    const getSizeStyles = (): { container: ViewStyle; text: TextStyle; iconSize: number } => {
        switch (size) {
            case 'sm':
                return {
                    container: { paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md },
                    text: { fontSize: FONT_SIZE.sm },
                    iconSize: 16,
                };
            case 'lg':
                return {
                    container: { paddingVertical: SPACING.lg, paddingHorizontal: SPACING.xxl },
                    text: { fontSize: FONT_SIZE.lg },
                    iconSize: 24,
                };
            case 'md':
            default:
                return {
                    container: { paddingVertical: SPACING.md, paddingHorizontal: SPACING.xl },
                    text: { fontSize: FONT_SIZE.md },
                    iconSize: 20,
                };
        }
    };

    const getVariantStyles = (): { container: ViewStyle; text: TextStyle } => {
        switch (variant) {
            case 'secondary':
                return {
                    container: { backgroundColor: colors.inputBackground },
                    text: { color: colors.text },
                };
            case 'outline':
                return {
                    container: {
                        backgroundColor: 'transparent',
                        borderWidth: 1.5,
                        borderColor: colors.primary
                    },
                    text: { color: colors.primary },
                };
            case 'ghost':
                return {
                    container: { backgroundColor: 'transparent' },
                    text: { color: colors.primary },
                };
            case 'danger':
                return {
                    container: { backgroundColor: '#d93025' },
                    text: { color: '#fff' },
                };
            case 'primary':
            default:
                return {
                    container: { backgroundColor: colors.primary },
                    text: { color: colors.buttonText },
                };
        }
    };

    const sizeStyles = getSizeStyles();
    const variantStyles = getVariantStyles();

    const containerStyle: ViewStyle = {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: RADIUS.lg,
        gap: SPACING.sm,
        opacity: disabled ? 0.5 : 1,
        ...sizeStyles.container,
        ...variantStyles.container,
        ...(fullWidth && { width: '100%' }),
    };

    const textStyle: TextStyle = {
        fontWeight: FONT_WEIGHT.semibold,
        ...sizeStyles.text,
        ...variantStyles.text,
    };

    const iconColor = variantStyles.text.color as string;

    return (
        <AnimatedPressable
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={disabled || loading}
            style={[animatedStyle, containerStyle, style]}
        >
            {loading ? (
                <ActivityIndicator color={iconColor} size="small" />
            ) : (
                <>
                    {icon && iconPosition === 'left' && (
                        <Ionicons name={icon} size={sizeStyles.iconSize} color={iconColor} />
                    )}
                    <Text style={textStyle}>{title}</Text>
                    {icon && iconPosition === 'right' && (
                        <Ionicons name={icon} size={sizeStyles.iconSize} color={iconColor} />
                    )}
                </>
            )}
        </AnimatedPressable>
    );
}
