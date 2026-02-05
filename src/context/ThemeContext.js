import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'react-native';

const ThemeContext = createContext();

export const lightTheme = {
    mode: 'light',
    background: '#ffffff',
    surface: '#f0f2f5',
    text: '#1a1a1a',
    textSecondary: '#65676b',
    border: '#e1e4e8',
    primary: '#2563eb',
    onPrimary: '#ffffff',
    danger: '#dc3545',
    statusBar: 'dark-content',
    statusBg: '#ffffff',
    inputBg: '#f0f2f5',
    chatMyBubble: '#2563eb',
    chatOtherBubble: '#f0f2f5',
    chatMyText: '#ffffff',
    chatOtherText: '#212529',
};

export const darkTheme = {
    mode: 'dark',
    background: '#18191a',
    surface: '#242526',
    text: '#e4e6eb',
    textSecondary: '#b0b3b8',
    border: '#393a3b',
    primary: '#4e8cff', // Slightly lighter blue for dark mode
    onPrimary: '#ffffff',
    danger: '#ff4d4d',
    statusBar: 'light-content',
    statusBg: '#18191a',
    inputBg: '#3a3b3c',
    chatMyBubble: '#4e8cff',
    chatOtherBubble: '#3e4042',
    chatMyText: '#ffffff',
    chatOtherText: '#e4e6eb',
};

export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(lightTheme);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadTheme();
    }, []);

    const loadTheme = async () => {
        try {
            const savedThemeMode = await AsyncStorage.getItem('userThemeMode');
            if (savedThemeMode === 'dark') {
                setTheme(darkTheme);
            } else {
                setTheme(lightTheme);
            }
        } catch (e) {
            console.log('Failed to load theme:', e);
        } finally {
            setLoading(false);
        }
    };

    const toggleTheme = async () => {
        try {
            const newTheme = theme.mode === 'light' ? darkTheme : lightTheme;
            setTheme(newTheme);
            await AsyncStorage.setItem('userThemeMode', newTheme.mode);
        } catch (e) {
            console.log('Failed to save theme:', e);
        }
    };

    if (loading) {
        return null; // Or a loading spinner
    }

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            <StatusBar
                barStyle={theme.statusBar}
                backgroundColor={theme.statusBg}
            />
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
