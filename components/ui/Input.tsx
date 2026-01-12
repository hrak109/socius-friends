/**
 * Reusable Input component with consistent styling and validation.
 */
import React, { useState } from 'react';
import {
    View,
    TextInput,
    Text,
    StyleSheet,
    TextInputProps,
    ViewStyle,
    Pressable
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, RADIUS, FONT_SIZE } from '../../constants/design';
import { useTheme } from '../../context/ThemeContext';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
    interpolateColor
} from 'react-native-reanimated';

const AnimatedView = Animated.createAnimatedComponent(View);

interface InputProps extends TextInputProps {
    label?: string;
    error?: string;
    hint?: string;
    icon?: keyof typeof Ionicons.glyphMap;
    rightIcon?: keyof typeof Ionicons.glyphMap;
    onRightIconPress?: () => void;
    containerStyle?: ViewStyle;
}

export default function Input({
    label,
    error,
    hint,
    icon,
    rightIcon,
    onRightIconPress,
    containerStyle,
    ...textInputProps
}: InputProps) {
    const { colors } = useTheme();
    const [isFocused, setIsFocused] = useState(false);
    const focus = useSharedValue(0);

    const handleFocus = () => {
        setIsFocused(true);
        focus.value = withTiming(1, { duration: 200 });
    };

    const handleBlur = () => {
        setIsFocused(false);
        focus.value = withTiming(0, { duration: 200 });
    };

    const animatedContainerStyle = useAnimatedStyle(() => {
        const borderColor = error
            ? '#d93025'
            : interpolateColor(
                focus.value,
                [0, 1],
                [colors.border, colors.primary]
            );

        return {
            borderColor,
            borderWidth: focus.value === 1 ? 2 : 1,
        };
    });

    const inputContainerStyle: ViewStyle = {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.inputBackground,
        borderRadius: RADIUS.lg,
        paddingHorizontal: SPACING.md,
        minHeight: 48,
    };

    return (
        <View style={[styles.container, containerStyle]}>
            {label && (
                <Text style={[styles.label, { color: colors.text }]}>
                    {label}
                </Text>
            )}

            <AnimatedView style={[inputContainerStyle, animatedContainerStyle]}>
                {icon && (
                    <Ionicons
                        name={icon}
                        size={20}
                        color={isFocused ? colors.primary : colors.textSecondary}
                        style={{ marginRight: SPACING.sm }}
                    />
                )}

                <TextInput
                    {...textInputProps}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    style={[
                        styles.input,
                        {
                            color: colors.text,
                            flex: 1,
                        }
                    ]}
                    placeholderTextColor={colors.textSecondary}
                />

                {rightIcon && (
                    <Pressable onPress={onRightIconPress}>
                        <Ionicons
                            name={rightIcon}
                            size={20}
                            color={colors.textSecondary}
                        />
                    </Pressable>
                )}
            </AnimatedView>

            {(error || hint) && (
                <Text
                    style={[
                        styles.helperText,
                        { color: error ? '#d93025' : colors.textSecondary }
                    ]}
                >
                    {error || hint}
                </Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: SPACING.lg,
    },
    label: {
        fontSize: FONT_SIZE.sm,
        fontWeight: '600',
        marginBottom: SPACING.sm,
    },
    input: {
        fontSize: FONT_SIZE.md,
        paddingVertical: SPACING.md,
    },
    helperText: {
        fontSize: FONT_SIZE.xs,
        marginTop: SPACING.xs,
        marginLeft: SPACING.xs,
    },
});
