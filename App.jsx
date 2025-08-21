import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import OtpVerification from './src/screen/OtpVerification';
import EnterOtp from './src/screen/EnterOtp';
import InfoOne from './src/screen/InfoOne';
import InfoTwo from './src/screen/InfoTwo';
import InfoThree from './src/screen/InfoThree';

const Stack = createStackNavigator();

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <Stack.Navigator 
          initialRouteName="OtpVerification"
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
          <Stack.Screen name="OtpVerification" component={OtpVerification} />
          <Stack.Screen name="EnterOtp" component={EnterOtp} />
          {/* <Stack.Screen name="info1" component={InfoOne} />
          <Stack.Screen name="info2" component={InfoTwo} />
          <Stack.Screen name="info3" component={InfoThree} /> */}
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
