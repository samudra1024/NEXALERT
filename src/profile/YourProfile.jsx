import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    Alert,
    TextInput,
    ScrollView,
    Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AuthService from '../services/authService';
import useAppStore from '../store/useAppStore';
import { formatPhoneNumber } from '../utils/contactUtils';
import { ScreenContainer } from '../components/ScreenContainer';
import { ArrowLeft, Camera, Edit2, Check } from 'lucide-react-native';

const PROFILE_IMAGE_KEY = 'user_profile_image';
const PROFILE_NAME_KEY = 'user_display_name';

export default function YourProfile() {
    const { theme } = useTheme();
    const navigation = useNavigation();
    const userPhone = useAppStore(state => state.userPhone);
    const [profileImage, setProfileImage] = useState(null);
    const [displayName, setDisplayName] = useState('User');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [isEditingName, setIsEditingName] = useState(false);
    const [tempName, setTempName] = useState('');

    // Load saved profile data on mount
    useEffect(() => {
        loadProfileData();
    }, [userPhone]);

    const loadProfileData = async () => {
        try {
            const savedImage = await AsyncStorage.getItem(PROFILE_IMAGE_KEY);
            const savedName = await AsyncStorage.getItem(PROFILE_NAME_KEY);
            const authPhone = userPhone || await AuthService.getUserPhone();
            if (savedImage) setProfileImage(savedImage);
            if (savedName) setDisplayName(savedName);
            if (authPhone) setPhoneNumber(formatPhoneNumber(authPhone));
        } catch (e) {
            console.error('Error loading profile data:', e);
        }
    };

    const saveProfileImage = async (uri) => {
        try {
            await AsyncStorage.setItem(PROFILE_IMAGE_KEY, uri);
            setProfileImage(uri);
        } catch (e) {
            console.error('Error saving profile image:', e);
        }
    };

    const saveDisplayName = async (name) => {
        try {
            const trimmed = name.trim();
            if (!trimmed) {
                Alert.alert('Error', 'Display name cannot be empty.');
                return;
            }
            await AsyncStorage.setItem(PROFILE_NAME_KEY, trimmed);
            setDisplayName(trimmed);
            setIsEditingName(false);
        } catch (e) {
            console.error('Error saving display name:', e);
        }
    };

    const handleCameraPress = () => {
        Alert.alert(
            "Update Profile Photo",
            "Choose an option",
            [
                {
                    text: "Camera",
                    onPress: () => pickImage('camera'),
                },
                {
                    text: "Gallery",
                    onPress: () => pickImage('gallery'),
                },
                ...(profileImage ? [{
                    text: "Remove Photo",
                    style: "destructive",
                    onPress: async () => {
                        await AsyncStorage.removeItem(PROFILE_IMAGE_KEY);
                        setProfileImage(null);
                    },
                }] : []),
                {
                    text: "Cancel",
                    style: "cancel",
                },
            ]
        );
    };

    const pickImage = async (source) => {
        const options = {
            mediaType: 'photo',
            quality: 0.8,
            maxWidth: 600,
            maxHeight: 600,
        };

        try {
            let result;
            if (source === 'camera') {
                result = await launchCamera(options);
            } else {
                result = await launchImageLibrary(options);
            }

            if (result.didCancel) return;
            if (result.errorCode) {
                Alert.alert('Error', result.errorMessage || 'Something went wrong.');
                return;
            }

            const asset = result.assets?.[0];
            if (asset?.uri) {
                await saveProfileImage(asset.uri);
            }
        } catch (error) {
            console.error('Image picker error:', error);
            Alert.alert('Error', 'Failed to pick image. Please try again.');
        }
    };

    const getInitial = () => {
        return displayName ? displayName.charAt(0).toUpperCase() : 'U';
    };

    const startEditName = () => {
        setTempName(displayName);
        setIsEditingName(true);
    };

    return (
        <ScreenContainer
            backgroundColor={theme.background}
            statusBarStyle={theme.statusBar}
            statusBarBackgroundColor={theme.statusBg}
        >
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ArrowLeft size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Profile</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Animated Heading */}
                <Animated.Text
                    entering={FadeInDown.duration(800).springify()}
                    style={[styles.heading, { color: theme.text }]}
                >
                    Customize how you're seen
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
                    <View style={[styles.avatarWrapper, { borderColor: theme.primary + '40' }]}>
                        {profileImage ? (
                            <Image
                                source={{ uri: profileImage }}
                                style={styles.avatar}
                            />
                        ) : (
                            <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: theme.primary }]}>
                                <Text style={styles.avatarInitial}>{getInitial()}</Text>
                            </View>
                        )}
                    </View>

                    {/* Camera Button */}
                    <TouchableOpacity
                        style={[styles.cameraButton, { backgroundColor: theme.primary, borderColor: theme.background }]}
                        onPress={handleCameraPress}
                        activeOpacity={0.8}
                    >
                        <Camera size={20} color="#fff" />
                    </TouchableOpacity>
                </Animated.View>

                {/* Profile Details */}
                <Animated.View
                    entering={FadeInDown.delay(600).duration(800).springify()}
                    style={styles.infoContainer}
                >
                    {/* Display Name - Editable */}
                    <View style={[styles.infoItem, { backgroundColor: theme.surface }]}>
                        <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Display Name</Text>
                        <View style={styles.editableRow}>
                            {isEditingName ? (
                                <>
                                    <TextInput
                                        style={[styles.nameInput, {
                                            color: theme.text,
                                            borderBottomColor: theme.primary,
                                        }]}
                                        value={tempName}
                                        onChangeText={setTempName}
                                        autoFocus
                                        maxLength={30}
                                        placeholder="Enter your name"
                                        placeholderTextColor={theme.textSecondary}
                                        onSubmitEditing={() => saveDisplayName(tempName)}
                                    />
                                    <TouchableOpacity
                                        style={[styles.editButton, { backgroundColor: theme.primary }]}
                                        onPress={() => saveDisplayName(tempName)}
                                    >
                                        <Check size={18} color="#fff" />
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <>
                                    <Text style={[styles.infoValue, { color: theme.text }]}>{displayName}</Text>
                                    <TouchableOpacity
                                        style={[styles.editButton, { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }]}
                                        onPress={startEditName}
                                    >
                                        <Edit2 size={16} color={theme.primary} />
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    </View>

                    {/* Phone Number - Read Only */}
                    <View style={[styles.infoItem, { backgroundColor: theme.surface }]}>
                        <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Phone Number</Text>
                        <Text style={[styles.infoValue, { color: theme.text }]}>
                            {phoneNumber || 'Not available'}
                        </Text>
                    </View>
                </Animated.View>

            </ScrollView>
        </ScreenContainer>
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
        fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
    },
    content: {
        alignItems: 'center',
        paddingTop: 40,
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
    heading: {
        fontSize: 28,
        fontWeight: '800',
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
        borderRadius: 75,
        borderWidth: 2,
        borderStyle: 'dashed',
    },
    avatar: {
        width: 140,
        height: 140,
        borderRadius: 70,
    },
    avatarPlaceholder: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarInitial: {
        fontSize: 56,
        fontWeight: '700',
        color: '#FFFFFF',
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
        flex: 1,
    },
    editableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    nameInput: {
        fontSize: 18,
        fontWeight: '500',
        flex: 1,
        borderBottomWidth: 2,
        paddingVertical: 4,
        marginRight: 12,
    },
    editButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
