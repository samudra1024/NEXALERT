import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { CardStyleInterpolators } from '@react-navigation/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AuthScreen from './src/screen/AuthScreen';
import Onboarding from './src/screen/Onboarding';
import ChatList from './src/screen/ChatList';
import ChatScreen from './src/screen/ChatScreen';
import NewChat from './src/screen/NewChat';
import YourProfile from './src/profile/YourProfile';
import Archived from './src/profile/Archived';
import Settings from './src/profile/Settings';
import AdvancedSettings from './src/profile/AdvancedSettings';
import RecycleBin from './src/screen/RecycleBin';
import Blocked from './src/screen/Blocked';
import Spam from './src/screen/Spam';
import { SettingsProvider } from './src/context/SettingsContext';
import { ThemeProvider } from './src/context/ThemeContext';
import SmsController from './Controller/SmsController';
import AuthService from './src/services/authService';
import useAppStore from './src/store/useAppStore';

const Stack = createStackNavigator();

export default function App() {
  const navigationRef = useRef(null);
  const [initialRoute, setInitialRoute] = useState(null);
  const bootstrap = useAppStore(state => state.bootstrap);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await bootstrap();
      SmsController.preloadContacts().catch(() => {});
      try {
        await AuthService.getAccessToken();
      } catch {
        // Token refresh failed — user will re-auth
      }
      const route = await AuthService.getInitialRoute();
      if (mounted) setInitialRoute(route);
    })();
    return () => { mounted = false; };
  }, [bootstrap]);

  const handleNavigationReady = useCallback(async () => {
    try {
      const data = await SmsController.getInitialIntentData();
      if (data?.contactId && navigationRef.current) {
        navigationRef.current.navigate('Chat', {
          contactId: data.contactId,
          name: data.contactId,
          initialBody: data.body || '',
        });
      }
    } catch (error) {
      console.warn('Intent navigation failed:', error);
    }
  }, []);

  if (!initialRoute) {
    return (
      <SafeAreaProvider>
        <View style={styles.bootContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SettingsProvider>
          <ThemeProvider>
            <NavigationContainer ref={navigationRef} onReady={handleNavigationReady}>
            <Stack.Navigator
              initialRouteName={initialRoute}
              screenOptions={{
                headerShown: false,
                gestureEnabled: true,
                cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
                detachInactiveScreens: true,
              }}
            >
              <Stack.Screen name="Onboarding" component={Onboarding} />
              <Stack.Screen
                name="AuthScreen"
                component={AuthScreen}
                options={{ gestureEnabled: false }}
              />
              <Stack.Screen
                name="ChatsList"
                component={ChatList}
                options={{ gestureEnabled: false }}
              />
              <Stack.Screen name="Chat" component={ChatScreen} />
              <Stack.Screen name="NewChat" component={NewChat} />
              <Stack.Screen name="YourProfile" component={YourProfile} />
              <Stack.Screen name="Archived" component={Archived} />
              <Stack.Screen name="Settings" component={Settings} />
              <Stack.Screen name="AdvancedSettings" component={AdvancedSettings} />
              <Stack.Screen name="RecycleBin" component={RecycleBin} />
              <Stack.Screen name="Blocked" component={Blocked} />
              <Stack.Screen name="Spam" component={Spam} />
            </Stack.Navigator>
          </NavigationContainer>
        </ThemeProvider>
      </SettingsProvider>
    </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  bootContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
  },
});
