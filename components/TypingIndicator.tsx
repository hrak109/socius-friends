
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface TypingIndicatorProps {
    color?: string;
}

export default function TypingIndicator({ color }: TypingIndicatorProps) {
    const { colors } = useTheme();
    const dotColor = color || colors.textSecondary;

    const opacities = [
        useRef(new Animated.Value(0)).current,
        useRef(new Animated.Value(0)).current,
        useRef(new Animated.Value(0)).current,
    ];

    useEffect(() => {
        const animations = opacities.map((opacity, index) => {
            return Animated.loop(
                Animated.sequence([
                    Animated.delay(index * 200),
                    Animated.timing(opacity, {
                        toValue: 1,
                        duration: 400,
                        useNativeDriver: true,
                    }),
                    Animated.timing(opacity, {
                        toValue: 0.3,
                        duration: 400,
                        useNativeDriver: true,
                    }),
                    Animated.delay((2 - index) * 200),
                ])
            );
        });

        Animated.parallel(animations).start();

        return () => {
            animations.forEach(anim => anim.stop());
        };
    }, []);

    return (
        <View style={styles.container}>
            {opacities.map((opacity, index) => (
                <Animated.View
                    key={index}
                    style={[
                        styles.dot,
                        { backgroundColor: dotColor, opacity }
                    ]}
                />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 20,
        paddingHorizontal: 4,
        gap: 4,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
});
