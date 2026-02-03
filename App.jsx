import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import OtpVerification from './src/screen/OtpVerification';
import EnterOtp from './src/screen/EnterOtp';
import InfoOne from './src/screen/InfoOne';
import InfoTwo from './src/screen/InfoTwo';
import InfoThree from './src/screen/InfoThree';
import ChatList from './src/screen/ChatList';
import ChatScreen from './src/screen/ChatScreen';
import NewChat from './src/screen/NewChat';


const Stack = createStackNavigator();

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <Stack.Navigator 
          initialRouteName="InfoOne"
          screenOptions={{
            headerShown: false,
            gestureEnabled: true,
            cardStyleInterpolator: ({ current, layouts }) => {
              return {
                cardStyle: {
                  transform: [
                    {
                      translateX: current.progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [layouts.screen.width, 0],
                      }),
                    },
                  ],
                },
              };
            },
          }}
        >

          <Stack.Screen name="InfoOne" component={InfoOne} />
          <Stack.Screen name="OtpVerification" component={OtpVerification} />
          <Stack.Screen name="EnterOtp" component={EnterOtp} />
          <Stack.Screen name="InfoTwo" component={InfoTwo} />
          <Stack.Screen name="InfoThree" component={InfoThree} />
          <Stack.Screen name="ChatsList" component={ChatList} />
          <Stack.Screen name="Chat" component={ChatScreen} />
          <Stack.Screen name="NewChat" component={NewChat} />
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
