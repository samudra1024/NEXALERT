import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    Alert,
    StatusBar,
    Dimensions
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import ScalePressable from '../components/animations/ScalePressable';

const { width } = Dimensions.get('window');

// Placeholder avatars for simulation
const AVATARS = [
    'https://ui-avatars.com/api/?name=User&background=random&size=200',
    'https://ui-avatars.com/api/?name=Alex&background=2563eb&color=fff&size=200',
    'https://ui-avatars.com/api/?name=Sam&background=fd79a8&color=fff&size=200',
    'https://ui-avatars.com/api/?name=Jordan&background=fdcb6e&color=fff&size=200'
];

export default function YourProfile() {
    const { theme } = useTheme();
    const navigation = useNavigation();
    const [profileImage, setProfileImage] = useState(AVATARS[0]);
    const [clickCount, setClickCount] = useState(0);
    const [showTerms, setShowTerms] = useState(false);

    const handleCameraPress = () => {
        Alert.alert(
            "Update Profile Photo",
            "Choose an option",
            [
                {
                    text: "Camera",
                    onPress: () => simulateImageSelection()
                },
                {
                    text: "Gallery",
                    onPress: () => simulateImageSelection()
                },
                {
                    text: "Cancel",
                    style: "cancel"
                }
            ]
        );
    };

    const simulateImageSelection = () => {
        // Simulate picking a new image by cycling through avatars
        const nextIndex = (clickCount + 1) % AVATARS.length;
        setProfileImage(AVATARS[nextIndex]);
        setClickCount(prev => prev + 1);
        Alert.alert("Success", "Profile photo updated successfully!");
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.statusBg} />

            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <ScalePressable onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={[styles.backButtonText, { color: theme.text }]}>←</Text>
                </ScalePressable>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Profile</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.content}>
                {/* Animated Heading */}
                <Animated.Text
                    entering={FadeInDown.duration(800).springify()}
                    style={[styles.heading, { color: theme.text }]}
                >
                    Customize how you’re seen
                </Animated.Text>

                <Animated.Text
                    entering={FadeInDown.delay(200).duration(800).springify()}
                    style={[styles.subHeading, { color: theme.textSecondary }]}
                >
                    Your profile connects you with your contacts.
                </Animated.Text>

                {/* Profile Photo Section */}
                <Animated.View
                    entering={FadeInDown.delay(400).duration(800).springify()}
                    style={styles.avatarContainer}
                >
                    <View style={[styles.avatarWrapper, { borderColor: theme.border }]}>
                        <Image
                            source={{ uri: profileImage }}
                            style={styles.avatar}
                        />
                    </View>

                    {/* Camera Button */}
                    <TouchableOpacity
                        style={[styles.cameraButton, { backgroundColor: theme.primary, borderColor: theme.background }]}
                        onPress={handleCameraPress}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.cameraIcon}>📷</Text>
                    </TouchableOpacity>
                </Animated.View>

                {/* Profile Details (Enhancement) */}
                <Animated.View
                    entering={FadeInDown.delay(600).duration(800).springify()}
                    style={styles.infoContainer}
                >
                    <View style={[styles.infoItem, { backgroundColor: theme.surface }]}>
                        <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Display Name</Text>
                        <Text style={[styles.infoValue, { color: theme.text }]}>User</Text>
                    </View>

                    <View style={[styles.infoItem, { backgroundColor: theme.surface }]}>
                        <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Phone Number</Text>
                        <Text style={[styles.infoValue, { color: theme.text }]}>+1 234 567 8900</Text>
                    </View>
                </Animated.View>

                {/* About Section */}
                <Animated.View
                    entering={FadeInDown.delay(800).duration(800).springify()}
                    style={styles.aboutContainer}
                >
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>About App</Text>
                    <View style={[styles.aboutCard, { backgroundColor: theme.surface }]}>
                        <Text style={[styles.appName, { color: theme.primary }]}>NEXALERT</Text>
                        <Text style={[styles.appTagline, { color: theme.textSecondary }]}>Your Shield Against SMS Scams</Text>

                        <Text style={[styles.appDescription, { color: theme.text }]}>
                            NEXALERT protects you from fraudulent SMS messages while providing a reliable messaging experience.
                        </Text>

                        <TouchableOpacity onPress={() => setShowTerms(!showTerms)} style={{ marginBottom: 16 }}>
                            <Text style={{ color: theme.primary, fontWeight: '600' }}>
                                {showTerms ? "Hide Terms & Conditions" : "Read Terms & Conditions"}
                            </Text>
                        </TouchableOpacity>

                        {showTerms && (
                            <Animated.View entering={FadeInDown.duration(300)} style={{ marginBottom: 16 }}>
                                <Text style={{ color: theme.text, fontSize: 13, lineHeight: 18 }}>
                                    1. <Text style={{ fontWeight: 'bold' }}>Usage:</Text> Use this app responsibly.{'\n'}
                                    2. <Text style={{ fontWeight: 'bold' }}>Privacy:</Text> Your messages are processed locally.{'\n'}
                                    3. <Text style={{ fontWeight: 'bold' }}>Liability:</Text> We are not liable for lost data.
                                </Text>
                            </Animated.View>
                        )}

                        <View style={styles.valueItem}>
                            <Text style={[styles.valueTitle, { color: theme.text }]}>⚡ Speed & Security</Text>
                            <Text style={[styles.valueDesc, { color: theme.textSecondary }]}>Real-time analysis without compromising speed.</Text>
                        </View>

                        <View style={styles.valueItem}>
                            <Text style={[styles.valueTitle, { color: theme.text }]}>🔒 Privacy First</Text>
                            <Text style={[styles.valueDesc, { color: theme.textSecondary }]}>Your data stays on your device.</Text>
                        </View>

                        <View style={styles.valueItem}>
                            <Text style={[styles.valueTitle, { color: theme.text }]}>✨ Simplicity</Text>
                            <Text style={[styles.valueDesc, { color: theme.textSecondary }]}>A clean, distraction-free interface.</Text>
                        </View>
                    </View>
                </Animated.View>

            </View>
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
    backButtonText: {
        fontSize: 24,
        fontWeight: '300',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    content: {
        flex: 1,
        alignItems: 'center',
        paddingTop: 40,
        paddingHorizontal: 24,
    },
    heading: {
        fontSize: 28,
        fontWeight: '800', // Bold and prominent
        textAlign: 'center',
        marginBottom: 8,
        letterSpacing: 0.5,
    },
    subHeading: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 48,
        lineHeight: 24,
    },
    avatarContainer: {
        position: 'relative',
        marginBottom: 48,
    },
    avatarWrapper: {
        padding: 4,
        borderRadius: 75, // Half of size + padding
        borderWidth: 2,
        borderStyle: 'dashed',
    },
    avatar: {
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: '#eee',
    },
    cameraButton: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 4,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    cameraIcon: {
        fontSize: 20,
    },
    infoContainer: {
        width: '100%',
    },
    infoItem: {
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
    },
    infoLabel: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    infoValue: {
        fontSize: 18,
        fontWeight: '500',
    },
    aboutContainer: {
        width: '100%',
        marginTop: 24,
        marginBottom: 40,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 12,
        paddingHorizontal: 4,
    },
    aboutCard: {
        padding: 20,
        borderRadius: 20,
    },
    appName: {
        fontSize: 18,
        fontWeight: '800',
        marginBottom: 4,
        letterSpacing: 1,
    },
    appTagline: {
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 16,
        fontStyle: 'italic',
    },
    appDescription: {
        fontSize: 14,
        lineHeight: 22,
        marginBottom: 20,
    },
    valueItem: {
        marginBottom: 16,
    },
    valueTitle: {
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 4,
    },
    valueDesc: {
        fontSize: 13,
        lineHeight: 18,
    },
});
