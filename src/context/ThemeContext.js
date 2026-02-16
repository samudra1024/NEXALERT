import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'react-native';

const ThemeContext = createContext();

export const lightTheme = {
    dark: false,
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
    },
    statusBarStyle: 'dark-content',
};

export const darkTheme = {
    dark: true,
    colors: {
        background: '#121212',
        text: '#e1e1e1',
        textSecondary: '#a0a0a0',
        primary: '#3b82f6', // Slightly lighter blue for dark mode
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
    },
    statusBarStyle: 'light-content',
};

export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(lightTheme);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadTheme();
    }, []);

    const loadTheme = async () => {
        try {
            const savedTheme = await AsyncStorage.getItem('app_theme');
            if (savedTheme === 'dark') {
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
        } catch (error) {
            console.log('Error saving theme:', error);
        }
    };

    if (loading) {
        return null; // Or a splash screen
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
