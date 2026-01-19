import AsyncStorage from '@react-native-async-storage/async-storage';

const THREADS_KEY = 'chat_threads_v1';
const MESSAGES_KEY_PREFIX = 'chat_messages_';

export interface CachedThread {
    id: string;
    type: 'user' | 'socius';
    name: string;
    avatar?: string;
    lastMessage?: string;
    lastMessageTime?: string;
    unread?: number;
    sociusRole?: string;
    multilingual_selection?: string;
}

export interface CachedMessage {
    _id: string | number;
    text: string;
    createdAt: string; // ISO string for serialization
    user: {
        _id: string | number;
        name?: string;
        avatar?: string;
    };
}

// Thread caching
export const getCachedThreads = async (): Promise<CachedThread[]> => {
    try {
        const data = await AsyncStorage.getItem(THREADS_KEY);
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error('Failed to get cached threads:', error);
        return [];
    }
};

export const cacheThreads = async (threads: CachedThread[]): Promise<void> => {
    try {
        await AsyncStorage.setItem(THREADS_KEY, JSON.stringify(threads));
    } catch (error) {
        console.error('Failed to cache threads:', error);
    }
};

// Message caching
export const getCachedMessages = async (threadId: string): Promise<CachedMessage[]> => {
    try {
        const key = `${MESSAGES_KEY_PREFIX}${threadId}_v1`;
        const data = await AsyncStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error('Failed to get cached messages:', error);
        return [];
    }
};

export const cacheMessages = async (threadId: string, messages: CachedMessage[]): Promise<void> => {
    try {
        const key = `${MESSAGES_KEY_PREFIX}${threadId}_v1`;
        // Keep only the most recent 100 messages to limit storage
        const toCache = messages.slice(0, 100);
        await AsyncStorage.setItem(key, JSON.stringify(toCache));
    } catch (error) {
        console.error('Failed to cache messages:', error);
    }
};

// Append a single message to cache (optimistic update)
export const appendMessageToCache = async (threadId: string, message: CachedMessage): Promise<void> => {
    try {
        const existing = await getCachedMessages(threadId);
        const updated = [message, ...existing].slice(0, 100);
        await cacheMessages(threadId, updated);
    } catch (error) {
        console.error('Failed to append message to cache:', error);
    }
};

// Clear all chat cache
export const clearChatCache = async (): Promise<void> => {
    try {
        const keys = await AsyncStorage.getAllKeys();
        const chatKeys = keys.filter(k => k.startsWith(THREADS_KEY) || k.startsWith(MESSAGES_KEY_PREFIX));
        await AsyncStorage.multiRemove(chatKeys);
    } catch (error) {
        console.error('Failed to clear chat cache:', error);
    }
};
