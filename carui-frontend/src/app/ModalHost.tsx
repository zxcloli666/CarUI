import React from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { WeatherScreen, NavigationScreen, SettingsScreen } from '../screens';
import { useUiStore } from './store';
import { BASE_COLORS } from '../theme/constants';

const WeatherModal = React.memo(() => {
  const isOpen = useUiStore((s) => s.isWeatherOpen);
  const close = useUiStore((s) => s.closeWeather);

  if (!isOpen) return null;

  return (
    <Modal
      visible
      animationType="slide"
      transparent={false}
      onRequestClose={close}
      hardwareAccelerated
    >
      <View style={styles.modalContainer}>
        <WeatherScreen />
      </View>
    </Modal>
  );
});

const NavigationModal = React.memo(() => {
  const isOpen = useUiStore((s) => s.isNavigationOpen);
  const close = useUiStore((s) => s.closeNavigation);

  if (!isOpen) return null;

  return (
    <Modal
      visible
      animationType="slide"
      transparent={false}
      onRequestClose={close}
      hardwareAccelerated
    >
      <View style={styles.modalContainer}>
        <NavigationScreen />
      </View>
    </Modal>
  );
});

const SettingsModal = React.memo(() => {
  const isOpen = useUiStore((s) => s.isSettingsOpen);
  const close = useUiStore((s) => s.closeSettings);

  if (!isOpen) return null;

  return (
    <Modal
      visible
      animationType="slide"
      transparent={false}
      onRequestClose={close}
      hardwareAccelerated
    >
      <View style={styles.modalContainer}>
        <SettingsScreen />
      </View>
    </Modal>
  );
});

export const ModalHost = React.memo(() => (
  <>
    <WeatherModal />
    <NavigationModal />
    <SettingsModal />
  </>
));

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: BASE_COLORS.background.primary,
  },
});
