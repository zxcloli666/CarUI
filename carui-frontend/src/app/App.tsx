import React, { useEffect } from 'react';
import { StatusBar, View, StyleSheet, LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigation } from './Navigation';
import { PermissionsScreen } from '../screens/PermissionsScreen';
import {
  useGateway,
  useAudioEvents,
  useLauncherMode,
  useLocation,
  useSpeedEngine,
} from '../hooks';
import { useSettingsStore } from './store';
import { colors } from '../theme';

// Disable LogBox completely in production
if (!__DEV__) {
  LogBox.ignoreAllLogs();
}

function AppContent() {
  // Initialize launcher mode (fullscreen, keep screen on)
  useLauncherMode();

  // Initialize gateway connection (includes GPS polling)
  useGateway();

  // Initialize audio event handling
  useAudioEvents();

  // Initialize GPS + local speed engine (standalone, no backend needed)
  useLocation();
  useSpeedEngine();

  // Load settings on startup
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  useEffect(() => {
    loadSettings();
  }, []);

  return <AppNavigation />;
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <StatusBar
          backgroundColor={colors.background.primary}
          barStyle="light-content"
          hidden
        />
        <View style={styles.container}>
          <AppContent />
          <PermissionsScreen />
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
});
