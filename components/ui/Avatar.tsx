/**
 * Reusable Avatar component with fallback initials.
 */
import React from 'react';
import { View, Image, Text, ViewStyle } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { PROFILE_AVATAR_MAP } from '../../constants/avatars';

interface AvatarProps {
    source?: string | number; // URL string or local require
    name?: string;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    style?: ViewStyle;
}

const SIZE_MAP = {
    xs: 24,
    sm: 32,
    md: 40,
    lg: 56,
    xl: 80,
};

const FONT_SIZE_MAP = {
    xs: 10,
    sm: 12,
    md: 16,
    lg: 22,
    xl: 32,
};

export default function Avatar({ source, name, size = 'md', style }: AvatarProps) {
    const { colors } = useTheme();
    const dimension = SIZE_MAP[size];
    const fontSize = FONT_SIZE_MAP[size];

    const getInitials = (name?: string): string => {
        if (!name) return '?';
        const parts = name.trim().split(' ');
        if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    };

    const containerStyle: ViewStyle = {
        width: dimension,
        height: dimension,
        borderRadius: dimension / 2,
        overflow: 'hidden',
    };

    // Handle local avatar IDs (from PROFILE_AVATAR_MAP)
    const resolvedSource = typeof source === 'string' && source.startsWith('user-')
        ? PROFILE_AVATAR_MAP[source]
        : source;

    if (resolvedSource) {
        return (
            <View style={[containerStyle, style]}>
                <Image
                    source={typeof resolvedSource === 'string'
                        ? { uri: resolvedSource }
                        : resolvedSource
                    }
                    style={{ width: dimension, height: dimension }}
                />
            </View>
        );
    }

    // Fallback to initials
    return (
        <View
            style={[
                containerStyle,
                {
                    backgroundColor: colors.primary,
                    justifyContent: 'center',
                    alignItems: 'center'
                },
                style
            ]}
        >
            <Text style={{ color: '#fff', fontSize, fontWeight: 'bold' }}>
                {getInitials(name)}
            </Text>
        </View>
    );
}
