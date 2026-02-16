import React, { useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Linking,
    ScrollView,
    Platform
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';

const ContactUs = () => {
    const navigation = useNavigation();
    const { theme } = useTheme();
    const styles = useMemo(() => getStyles(theme), [theme]);

    const handleEmail = () => {
        Linking.openURL('mailto:support@nexalert.com');
    };

    const handlePhone = () => {
        Linking.openURL('tel:+1234567890');
    };

    const handleWebsite = () => {
        Linking.openURL('https://nexalert.com');
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Contact Us</Text>
                <View style={{ width: 40 }} /> {/* Spacer for centering */}
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.description}>
                    Have questions or need help? Reach out to us through any of the channels below.
                </Text>

                <TouchableOpacity style={styles.card} onPress={handleEmail}>
                    <Text style={styles.cardTitle}>📧 Email Support</Text>
                    <Text style={styles.cardContent}>support@nexalert.com</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.card} onPress={handlePhone}>
                    <Text style={styles.cardTitle}>📞 Customer Care</Text>
                    <Text style={styles.cardContent}>+1 (234) 567-890</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.card} onPress={handleWebsite}>
                    <Text style={styles.cardTitle}>🌐 Website</Text>
                    <Text style={styles.cardContent}>www.nexalert.com</Text>
                </TouchableOpacity>

                {/* Placeholder for "About" content as requested */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>About NexAlert</Text>
                    <Text style={styles.sectionText}>
                        NexAlert is your intelligent SMS companion, designed to protect you from scams and spam.
                        We use advanced algorithms to filter your messages and keep your inbox clean and safe.
                    </Text>
                    <Text style={styles.sectionText}>
                        Version 1.0.0
                    </Text>
                </View>

            </ScrollView>
        </View>
    );
};

const getStyles = (theme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: theme.colors.headerBackground,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    backButton: {
        padding: 8,
    },
    backButtonText: {
        fontSize: 24,
        color: theme.colors.text,
        fontWeight: 'bold',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: theme.colors.text,
    },
    content: {
        padding: 20,
    },
    description: {
        fontSize: 16,
        color: theme.colors.textSecondary,
        marginBottom: 24,
        textAlign: 'center',
    },
    card: {
        backgroundColor: theme.colors.card,
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: theme.colors.text,
        marginBottom: 8,
    },
    cardContent: {
        fontSize: 16,
        color: theme.colors.primary,
    },
    section: {
        marginTop: 20,
        padding: 20,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 12,
    },
    sectionText: {
        fontSize: 16,
        color: theme.colors.textSecondary,
        marginBottom: 12,
        lineHeight: 24,
    },
});

export default ContactUs;
