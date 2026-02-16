import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { CardStyleInterpolators } from '@react-navigation/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

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
import { SettingsProvider } from './src/context/SettingsContext';


const Stack = createStackNavigator();

import { ThemeProvider } from './src/context/ThemeContext';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SettingsProvider>
        <ThemeProvider>
          <NavigationContainer>
            <Stack.Navigator
              initialRouteName="Onboarding"
              screenOptions={{
                headerShown: false,
                gestureEnabled: true,
                cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
                detachInactiveScreens: true,
              }}
            >

              <Stack.Screen name="Onboarding" component={Onboarding} />
              <Stack.Screen name="AuthScreen" component={AuthScreen} />
              <Stack.Screen name="ChatsList" component={ChatList} />
              <Stack.Screen name="Chat" component={ChatScreen} />
              <Stack.Screen name="NewChat" component={NewChat} />
              <Stack.Screen name="YourProfile" component={YourProfile} />
              <Stack.Screen name="Archived" component={Archived} />
              <Stack.Screen name="Settings" component={Settings} />
              <Stack.Screen name="AdvancedSettings" component={AdvancedSettings} />
              <Stack.Screen name="RecycleBin" component={RecycleBin} />
            </Stack.Navigator>
          </NavigationContainer>
        </ThemeProvider>
      </SettingsProvider>
    </GestureHandlerRootView>
  );
}
