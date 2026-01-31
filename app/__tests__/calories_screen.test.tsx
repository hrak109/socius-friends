import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { View } from 'react-native';
import CaloriesScreen from '../calories';

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

// Mock other dependencies
jest.mock('@/hooks/useCalories', () => ({
    useCalories: () => ({
        entries: [],
        loading: false,
        addEntry: jest.fn(),
        deleteEntry: jest.fn(),
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
        },
        isDark: false
    }),
}));

jest.mock('@/context/LanguageContext', () => ({
    useLanguage: () => ({
        t: (key: string) => {
            const translations: any = {
                'calories.title': 'Calorie Tracker',
                'calories.add_entry': 'Add Entry',
                'calories.food_name': 'Food Name',
                'calories.placeholder_name': 'e.g. Banana',
                'calories.placeholder_calories': 'e.g. 105',
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

describe('CaloriesScreen', () => {
    it('renders localized placeholders correctly', () => {
        const { getByPlaceholderText, getByText } = render(<CaloriesScreen />);

        // Open the modal
        const addButton = getByText('Add Entry');
        fireEvent.press(addButton);

        expect(getByPlaceholderText('e.g. Banana')).toBeTruthy();
        expect(getByPlaceholderText('e.g. 105')).toBeTruthy();
    });

    it('shows localized JSDatePicker on iOS', () => {
        const { getByText } = render(<CaloriesScreen />);

        // Open modal
        fireEvent.press(getByText('Add Entry'));

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
