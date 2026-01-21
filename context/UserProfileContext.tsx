import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import api from '../services/api';

type UserProfileContextType = {
    displayName: string | null;
    username: string | null;
    displayAvatar: string | null;
    updateProfile: (name: string, avatarId: string, newUsername?: string) => Promise<void>;
    isLoading: boolean;
};

const UserProfileContext = createContext<UserProfileContextType>({
    displayName: null,
    username: null,
    displayAvatar: null,
    updateProfile: async () => { },
    isLoading: true,
});

export const useUserProfile = () => useContext(UserProfileContext);

export const UserProfileProvider = ({ children }: { children: React.ReactNode }) => {
    const [displayName, setDisplayName] = useState<string | null>(null);
    const [username, setUsername] = useState<string | null>(null);
    const [displayAvatar, setDisplayAvatar] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            // 1. Load from cache immediately
            const name = await AsyncStorage.getItem('user_display_name');
            const savedUsername = await AsyncStorage.getItem('user_username');
            const avatar = await AsyncStorage.getItem('user_display_avatar');


            if (name) setDisplayName(name);
            if (savedUsername) setUsername(savedUsername);
            if (avatar) setDisplayAvatar(avatar);


            // If we have data, we can stop loading visually
            if (name || savedUsername) {
                setIsLoading(false);
            }

            try {
                const res = await api.get('/users/me');
                const data = res.data;

                // Determine display name with Google first name fallback
                let resolvedName = data.display_name;
                if (!resolvedName) {
                    try {
                        const googleUser = await GoogleSignin.getCurrentUser();
                        const googleFullName = googleUser?.user?.name;
                        if (googleFullName) {
                            resolvedName = googleFullName.split(' ')[0]; // First name only
                        }
                    } catch {
                        // Google sign-in not available, ignore
                    }
                }
                // Final fallback to username
                if (!resolvedName) {
                    resolvedName = data.username;
                }

                // Update state with fresh data
                setDisplayName(resolvedName);
                setUsername(data.username);
                setDisplayAvatar(data.custom_avatar_url || 'user-1');


                // Sync new data to storage
                await AsyncStorage.setItem('user_display_name', resolvedName || '');
                if (data.username) await AsyncStorage.setItem('user_username', data.username);
                if (data.custom_avatar_url) await AsyncStorage.setItem('user_display_avatar', data.custom_avatar_url);

            } catch {

            }
        } catch (error) {
            console.error('Failed to load user profile', error);
        } finally {
            setIsLoading(false);
        }
    };

    const updateProfile = React.useCallback(async (name: string, avatarId: string, newUsername?: string) => {
        try {
            // Update Backend if username exists (initialized)
            if (username) {
                await api.put('/users/me', {
                    username: newUsername || username,
                    display_name: name,
                    custom_avatar_url: avatarId
                });
            } else {
                console.warn("UserProfileContext: Username missing, skipping API update in updateProfile. (This is expected during initial setup)");
            }

            // Always update local state
            await AsyncStorage.setItem('user_display_name', name);
            await AsyncStorage.setItem('user_display_avatar', avatarId);
            if (newUsername) {
                await AsyncStorage.setItem('user_username', newUsername);
                setUsername(newUsername);
            }
            setDisplayName(name);
            setDisplayAvatar(avatarId);
        } catch (error) {
            console.error('Failed to save user profile', error);
            throw error;
        }
    }, [username]);



    const value = React.useMemo(() => ({
        displayName,
        username,
        displayAvatar,
        updateProfile,
        isLoading
    }), [displayName, username, displayAvatar, updateProfile, isLoading]);

    return (
        <UserProfileContext.Provider value={value}>
            {children}
        </UserProfileContext.Provider>
    );
};
