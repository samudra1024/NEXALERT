import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'react-native';

const ThemeContext = createContext();

export const lightTheme = {
    // Legacy Properties (HEAD)
    mode: 'light',

    // New Properties (Main)
    dark: false,
    statusBarStyle: 'dark-content', // Main
    statusBar: 'dark-content',      // HEAD
    statusBg: '#ffffff',            // HEAD

    // Shared / Duplicate values for compatibility
    background: '#ffffff',
    surface: '#f0f2f5',
    text: '#1a1a1a',
    textSecondary: '#65676b',
    border: '#e1e4e8',
    primary: '#2563eb',
    onPrimary: '#ffffff',
    danger: '#dc3545',
    inputBg: '#f0f2f5',
    chatMyBubble: '#2563eb',
    chatOtherBubble: '#f0f2f5',
    chatMyText: '#ffffff',
    chatOtherText: '#212529',

    // New Structure (Main)
    colors: {
        background: '#ffffff',
        text: '#1a1a1a',
        textSecondary: '#65676b',
        primary: '#2563eb',
        secondary: '#f0f2f5',
        border: '#e1e4e8',
        card: '#ffffff',
        notification: '#ff3b30',
        inputBackground: '#f1f3f4',
        inputText: '#202124',
        placeholder: '#5f6368',
        myMessage: '#2563eb',
        myMessageText: '#ffffff',
        otherMessage: '#ffffff',
        otherMessageText: '#212529',
        headerBackground: '#ffffff',
        modalOverlay: 'rgba(0,0,0,0.2)',
        menuBackground: '#ffffff',
        iconColor: '#333333',
        divider: '#eeeeee',
        success: '#28a745',

        // Mapped from legacy if needed
        surface: '#f0f2f5',
        danger: '#dc3545',
    },
};

export const darkTheme = {
    // Legacy Properties (HEAD)
    mode: 'dark',

    // New Properties (Main)
    dark: true,
    statusBarStyle: 'light-content', // Main
    statusBar: 'light-content',      // HEAD
    statusBg: '#18191a',             // HEAD

    // Shared / Duplicate values for compatibility
    background: '#18191a',
    surface: '#242526',
    text: '#e4e6eb',
    textSecondary: '#b0b3b8',
    border: '#393a3b',
    primary: '#2563eb',
    onPrimary: '#ffffff',
    danger: '#ff4d4d',
    inputBg: '#3a3b3c',
    chatMyBubble: '#2563eb',
    chatOtherBubble: '#3e4042',
    chatMyText: '#ffffff',
    chatOtherText: '#e4e6eb',

    // New Structure (Main)
    colors: {
        background: '#121212',
        text: '#e1e1e1',
        textSecondary: '#a0a0a0',
        primary: '#3b82f6',
        secondary: '#1e1e1e',
        border: '#333333',
        card: '#1e1e1e',
        notification: '#ff453a',
        inputBackground: '#2c2c2c',
        inputText: '#e1e1e1',
        placeholder: '#9ca3af',
        myMessage: '#3b82f6',
        myMessageText: '#ffffff',
        otherMessage: '#2c2c2c',
        otherMessageText: '#e1e1e1',
        headerBackground: '#1e1e1e',
        modalOverlay: 'rgba(0,0,0,0.6)',
        menuBackground: '#2c2c2c',
        iconColor: '#e1e1e1',
        divider: '#333333',
        success: '#4ade80',

        // Mapped from legacy
        surface: '#242526',
        danger: '#ff4d4d',
    },
};

export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(lightTheme);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadTheme();
    }, []);

    const loadTheme = async () => {
        try {
            // Try both keys for safety
            const savedThemeMode = await AsyncStorage.getItem('userThemeMode');
            const savedTheme = await AsyncStorage.getItem('app_theme');

            if (savedTheme === 'dark' || savedThemeMode === 'dark') {
                setTheme(darkTheme);
            } else {
                setTheme(lightTheme);
            }
        } catch (error) {
            console.log('Error loading theme:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleTheme = async () => {
        const newTheme = theme.dark ? lightTheme : darkTheme;
        setTheme(newTheme);
        try {
            await AsyncStorage.setItem('app_theme', newTheme.dark ? 'dark' : 'light');
            await AsyncStorage.setItem('userThemeMode', newTheme.mode);
        } catch (error) {
            console.log('Error saving theme:', error);
        }
    };

    if (loading) {
        return null;
    }

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            <StatusBar
                barStyle={theme.statusBarStyle}
                backgroundColor={theme.colors.headerBackground}
            />
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
