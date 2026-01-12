import EventSource from 'react-native-sse';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../constants/env';

type NotificationEvent = {
    type: 'connected' | 'message' | 'dm' | 'error';
    data?: {
        id?: number;
        content?: string;
        context?: string;
        sender_id?: number;
        created_at?: string;
    };
    timestamp?: string;
    message?: string;
};

type NotificationCallback = (event: NotificationEvent) => void;

let eventSource: EventSource | null = null;

/**
 * Creates a connection to the notification stream.
 * Returns a cleanup function to close the connection.
 */
export async function createNotificationStream(
    onMessage: NotificationCallback,
    onError?: (error: any) => void
): Promise<() => void> {
    // Close existing connection if any
    if (eventSource) {
        eventSource.close();
        eventSource = null;
    }

    const token = await SecureStore.getItemAsync('session_token');
    if (!token) {
        console.warn('No session token, cannot connect to notification stream');
        return () => { };
    }

    const streamUrl = `${API_URL}/notifications/stream`;

    eventSource = new EventSource(streamUrl, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    eventSource.addEventListener('message', (event: any) => {
        try {
            const data = JSON.parse(event.data) as NotificationEvent;
            onMessage(data);
        } catch (e) {
            console.error('Failed to parse SSE event:', e);
        }
    });

    eventSource.addEventListener('error', (error: any) => {
        console.error('SSE connection error:', error);
        if (onError) {
            onError(error);
        }
    });

    eventSource.addEventListener('open', () => {
        console.log('SSE connection opened');
    });

    // Return cleanup function
    return () => {
        if (eventSource) {
            eventSource.close();
            eventSource = null;
        }
    };
}

/**
 * Closes any active notification stream.
 */
export function closeNotificationStream(): void {
    if (eventSource) {
        eventSource.close();
        eventSource = null;
    }
}
