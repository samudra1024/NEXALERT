import React from 'react';
import { Platform, StatusBar, StyleSheet, View } from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

export { SafeAreaProvider, useSafeAreaInsets };

function getTopInset(insets) {
  if (Platform.OS === 'android') {
    // Safe-area insets can be 0 on Android when the window draws edge-to-edge.
    return Math.max(insets.top, StatusBar.currentHeight || 0);
  }
  return insets.top;
}

function getBottomInset(insets) {
  return insets.bottom;
}

/**
 * Full-screen wrapper that respects status bar, notch, and navigation bar insets.
 */
export function ScreenContainer({
  children,
  style,
  edges = ['top', 'bottom', 'left', 'right'],
  backgroundColor,
  statusBarStyle,
  statusBarBackgroundColor,
}) {
  const insets = useSafeAreaInsets();
  const barColor = statusBarBackgroundColor || backgroundColor || '#ffffff';

  const paddingStyle = {
    paddingTop: edges.includes('top') ? getTopInset(insets) : 0,
    paddingBottom: edges.includes('bottom') ? getBottomInset(insets) : 0,
    paddingLeft: edges.includes('left') ? insets.left : 0,
    paddingRight: edges.includes('right') ? insets.right : 0,
  };

  return (
    <View style={[styles.container, { backgroundColor: barColor }, paddingStyle, style]}>
      <StatusBar
        barStyle={statusBarStyle || 'dark-content'}
        backgroundColor={barColor}
        translucent={Platform.OS === 'android'}
      />
      <View style={[styles.content, { backgroundColor: backgroundColor || barColor }]}>
        {children}
      </View>
    </View>
  );
}

/**
 * Adds bottom inset padding — useful for FABs and floating controls.
 */
export function BottomInsetSpacer({ min = 0 }) {
  const insets = useSafeAreaInsets();
  return <View style={{ height: Math.max(getBottomInset(insets), min) }} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
