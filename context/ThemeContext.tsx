import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Theme = 'light' | 'dark';

interface ThemeColors {
    background: string;
    text: string;
    textSecondary: string;
    card: string;
    border: string;
    primary: string;
    success: string;
    danger: string;
    warning: string;
    tabBar: string;
    tabBarActive: string;
    tabBarInactive: string;
    inputBackground: string;
    overlay: string;
    shadow: string;
    error: string;
    disabled: string;
    buttonText: string;
}

export const lightColors: ThemeColors = {
    background: '#f0f2f5',
    text: '#1a1a1a',
    textSecondary: '#666666',
    primary: '#1a73e8',
    card: '#ffffff',
    border: '#e0e0e0',
    success: '#34a853',
    danger: '#dc3545',
    warning: '#fbbc04',
    tabBar: '#ffffff',
    tabBarActive: '#1a73e8',
    tabBarInactive: '#999999',
    inputBackground: '#f5f5f5',
    overlay: 'rgba(0,0,0,0.5)',
    shadow: '#000000',
    error: '#d93025',
    disabled: '#cccccc',
    buttonText: '#ffffff',
};

export const darkColors: ThemeColors = {
    background: '#3a3a3a',
    text: '#ececec',
    textSecondary: '#b8b8b8',
    primary: '#8ab4f8',
    card: '#454545',
    border: '#5a5a5a',
    success: '#34a853',
    danger: '#ef5350',
    warning: '#fbbc04',
    tabBar: '#454545',
    tabBarActive: '#4285f4',
    tabBarInactive: '#909090',
    inputBackground: '#4a4a4a',
    overlay: 'rgba(0,0,0,0.5)',
    shadow: '#000000',
    error: '#f28b82',
    disabled: '#808080',
    buttonText: '#2a2a2a',
};

interface ThemeContextType {
    theme: Theme;
    colors: ThemeColors;
    toggleTheme: () => void;
    isDark: boolean;
    avatarId: string;
    setAvatar: (id: string) => void;
    accentColor: string;
    setAccentColor: (color: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const systemScheme = useColorScheme();
    const [theme, setTheme] = useState<Theme>(systemScheme === 'dark' ? 'dark' : 'light');
    const [avatarId, setAvatarId] = useState<string>('socius-icon');
    const [accentColor, setAccentColorState] = useState<string>('#1a73e8');

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const savedTheme = await AsyncStorage.getItem('app_theme');
                if (savedTheme === 'dark' || savedTheme === 'light') {
                    setTheme(savedTheme);
                }
                const savedAvatar = await AsyncStorage.getItem('socius_avatar_preference');
                if (savedAvatar) {
                    setAvatarId(savedAvatar);
                }
                const savedAccent = await AsyncStorage.getItem('app_accent_color');
                if (savedAccent) {
                    setAccentColorState(savedAccent);
                }
            } catch {
                console.log('Failed to load settings');
            }
        };
        loadSettings();
    }, []);

    const toggleTheme = async () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        try {
            await AsyncStorage.setItem('app_theme', newTheme);
        } catch {
            console.log('Failed to save theme preference');
        }
    };

    const setAvatar = async (id: string) => {
        setAvatarId(id);
        try {
            await AsyncStorage.setItem('socius_avatar_preference', id);
        } catch {
            console.log('Failed to save avatar preference');
        }
    };

    const setAccentColor = async (color: string) => {
        setAccentColorState(color);
        try {
            await AsyncStorage.setItem('app_accent_color', color);
        } catch {
            console.log('Failed to save accent color');
        }
    };

    const baseColors = theme === 'dark' ? darkColors : lightColors;
    const colors = {
        ...baseColors,
        primary: accentColor,
        tabBarActive: accentColor,
    };

    return (
        <ThemeContext.Provider value={{
            theme,
            colors,
            toggleTheme,
            isDark: theme === 'dark',
            avatarId,
            setAvatar,
            accentColor,
            setAccentColor
        }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
