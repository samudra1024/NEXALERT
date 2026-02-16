import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ScrollView,
    StatusBar,
    Alert
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { ArrowLeft, Send } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function HelpandFeedback() {
    const { theme } = useTheme();
    const navigation = useNavigation();
    const [feedback, setFeedback] = useState('');

    const handleSubmit = () => {
        if (feedback.trim()) {
            Alert.alert("Thank You", "Your feedback has been received!");
            setFeedback('');
            navigation.goBack();
        }
    };

    const FAQItem = ({ question, answer, delay }) => (
        <Animated.View
            entering={FadeInDown.delay(delay).duration(500)}
            style={[styles.faqItem, { backgroundColor: theme.surface }]}
        >
            <Text style={[styles.question, { color: theme.text }]}>{question}</Text>
            <Text style={[styles.answer, { color: theme.textSecondary }]}>{answer}</Text>
        </Animated.View>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.statusBg} />

            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ArrowLeft size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Help & Feedback</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={[styles.sectionTitle, { color: theme.primary }]}>Frequently Asked Questions</Text>

                <FAQItem
                    delay={100}
                    question="How do I block a contact?"
                    answer="Go to the chat, tap the menu (⋮), and select 'Block Contact'."
                />
                <FAQItem
                    delay={200}
                    question="Is my data secure?"
                    answer="Yes, all your messages are processed locally on your device for maximum privacy."
                />
                <FAQItem
                    delay={300}
                    question="How do I change the theme?"
                    answer="Go to Settings or toggle Dark Mode directly from the profile menu."
                />

                <Text style={[styles.sectionTitle, { color: theme.primary, marginTop: 24 }]}>Send Feedback</Text>
                <View style={[styles.feedbackContainer, { backgroundColor: theme.surface }]}>
                    <TextInput
                        style={[styles.input, { color: theme.text }]}
                        placeholder="Tell us what you think..."
                        placeholderTextColor={theme.textSecondary}
                        multiline
                        numberOfLines={4}
                        value={feedback}
                        onChangeText={setFeedback}
                    />
                    <TouchableOpacity
                        style={[styles.submitButton, { backgroundColor: theme.primary }]}
                        onPress={handleSubmit}
                    >
                        <Text style={styles.submitText}>Submit</Text>
                        <Send size={16} color="#FFF" style={{ marginLeft: 8 }} />
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
    },
    backButton: {
        padding: 8,
        marginLeft: -8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    content: {
        padding: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    faqItem: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
    },
    question: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    answer: {
        fontSize: 14,
        lineHeight: 20,
    },
    feedbackContainer: {
        borderRadius: 12,
        padding: 16,
    },
    input: {
        textAlignVertical: 'top',
        minHeight: 100,
        fontSize: 16,
    },
    submitButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 8,
        marginTop: 12,
    },
    submitText: {
        color: '#FFF',
        fontWeight: '600',
        fontSize: 16,
    },
});
