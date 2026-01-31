import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { View } from 'react-native';
import WorkoutScreen from '../workout';

// Mock expo-router
jest.mock('expo-router', () => {
    const MockStack = ({ children }: any) => children;
    MockStack.displayName = 'Stack';
    const MockStackScreen = () => null;
    MockStackScreen.displayName = 'StackScreen';
    MockStack.Screen = MockStackScreen;
    return {
        Stack: MockStack,
        useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
        useFocusEffect: jest.fn(),
        useLocalSearchParams: () => ({}),
        useRoute: () => ({ params: {} }),
    };
});

// Mock react-native
jest.mock('react-native', () => {
    const rn = jest.requireActual('react-native');
    rn.Platform.OS = 'ios';
    rn.Platform.select = (dict: any) => dict.ios || dict.default;
    return rn;
});

// Mock Ionicons
jest.mock('@expo/vector-icons', () => {
    const MockIonicons = (props: any) => React.createElement(View, props);
    MockIonicons.displayName = 'Ionicons';
    return {
        Ionicons: MockIonicons,
    };
});

// Mock other dependencies
jest.mock('@/hooks/useWorkouts', () => ({
    useWorkouts: () => ({
        activities: [],
        loading: false,
        stats: { weight: 70, height: 175, age: 30, gender: 'male', activityLevel: 'moderate' },
        addActivity: jest.fn(),
        deleteActivity: jest.fn(),
        saveStats: jest.fn(),
        refresh: jest.fn(),
    }),
}));

jest.mock('@/context/ThemeContext', () => ({
    useTheme: () => ({
        colors: {
            background: '#fff',
            text: '#000',
            primary: 'blue',
            card: '#f8f8f8',
            inputBackground: '#eee',
            border: '#ddd',
            textSecondary: '#666',
            surface: '#fff',
        },
        isDark: false
    }),
}));

jest.mock('@/context/LanguageContext', () => ({
    useLanguage: () => ({
        t: (key: string) => {
            const translations: any = {
                'workout.title': 'Workout Tracker',
                'workout.add_activity': 'Add Activity',
                'workout.placeholder_name': 'e.g. Running, Gym',
                'workout.placeholder_duration': 'e.g. 30',
                'workout.placeholder_calories': 'e.g. 200',
                'common.date': 'Date',
                'common.year': 'Year',
                'common.month': 'Month',
                'common.day': 'Day',
                'common.set_date': 'Set Date',
            };
            return translations[key] || key;
        },
        language: 'en'
    }),
}));

jest.mock('@/components/features/chat/AppSpecificChatHead', () => {
    const MockChatHead = (props: any) => React.createElement(View, { testID: 'chat-head', ...props });
    MockChatHead.displayName = 'AppSpecificChatHead';
    return MockChatHead;
});

describe('WorkoutScreen', () => {
    it('renders localized placeholders correctly', () => {
        const { getByPlaceholderText, getByText } = render(<WorkoutScreen />);

        // Open the modal
        const addButton = getByText('Add Activity');
        fireEvent.press(addButton);

        expect(getByPlaceholderText('e.g. Running, Gym')).toBeTruthy();
        expect(getByPlaceholderText('e.g. 30')).toBeTruthy();
        expect(getByPlaceholderText('e.g. 200')).toBeTruthy();
    });

    it('shows localized JSDatePicker on iOS', () => {
        const { getByText } = render(<WorkoutScreen />);

        // Open modal
        fireEvent.press(getByText('Add Activity'));

        // Open date picker
        const dateButton = getByText(new Date().toLocaleDateString());
        fireEvent.press(dateButton);

        // Verify JSDatePicker elements
        expect(getByText('Year')).toBeTruthy();
        expect(getByText('Month')).toBeTruthy();
        expect(getByText('Day')).toBeTruthy();
        expect(getByText('Set Date')).toBeTruthy();
    });
});
