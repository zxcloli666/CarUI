import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, StyleSheet, StatusBar, AppState } from 'react-native';
import { useScreenActive } from '../hooks';
import { useAccentColor } from '../hooks/useTheme';
import { BASE_COLORS, SPACING } from '../theme/constants';
import { FrozenScreen } from '../components/common';
import {
  getActiveMediaSession,
  getMusicApps,
  play,
  pause,
  skipNext,
  skipPrevious,
  seekTo,
  performMediaAction,
  subscribeToMediaSessionUpdates,
  startPolling,
  stopPolling,
  launchApp,
  showBackToCarUIButton,
} from '../services/native';
import { MediaSession, MusicApp } from '../types';

// Components
import { AlbumArt } from '../components/media/AlbumArt';
import { TrackDetails } from '../components/media/TrackDetails';
import { ProgressBar } from '../components/media/ProgressBar';
import { PlayerControls } from '../components/media/PlayerControls';
import { MusicAppsList } from '../components/media/MusicAppsList';
import { NoMediaState } from '../components/media/NoMediaState';

export function MediaScreen() {
  const isActive = useScreenActive();
  const accent = useAccentColor();

  const [mediaSession, setMediaSession] = useState<MediaSession | null>(null);
  const [musicApps, setMusicApps] = useState<MusicApp[]>([]);
  // Храним позицию и длительность отдельно для частого обновления
  const [playbackInfo, setPlaybackInfo] = useState({ position: 0, duration: 0 });

  // 1. Загрузка приложений (один раз)
  useEffect(() => {
    getMusicApps().then(setMusicApps);
  }, []);

  // 2. ЖЕСТКАЯ СИНХРОНИЗАЦИЯ
  useEffect(() => {
    if (!isActive) {
      stopPolling();
      return;
    }

    // Запускаем нативный поллинг (чтобы эвенты вообще начали ходить)
    startPolling(500);

    const updateData = async () => {
      try {
        const session = await getActiveMediaSession();
        if (session) {
          // Всегда обновляем стейт, React сам разберется с диффом.
          // Важно для смены трека.
          setMediaSession(session);
          setPlaybackInfo({
            position: session.metadata.position,
            duration: session.metadata.duration
          });
        }
      } catch (e) {
        console.warn('Media sync error:', e);
      }
    };

    // 1. Вызываем сразу
    updateData();

    // 2. Ставим интервал JS (Бэкап, если эвенты отвалились)
    const intervalId = setInterval(updateData, 800);

    // 3. Слушаем эвенты (для плавной реакции, если работают)
    const subSession = subscribeToMediaSessionUpdates((session) => {
      if (session) {
        setMediaSession(session);
        setPlaybackInfo(prev => ({ ...prev, duration: session.metadata.duration }));
      }
    });

    return () => {
      clearInterval(intervalId);
      stopPolling();
      subSession?.remove();
    };
  }, [isActive]);

  // Хендлеры
  const handlePlayPause = () => {
    if (!mediaSession) return;
    mediaSession.playbackState === 'playing'
        ? pause(mediaSession.packageName)
        : play(mediaSession.packageName);

    // Сразу дергаем обновление, чтобы UI отреагировал быстрее
    setTimeout(() => getActiveMediaSession().then(setMediaSession), 100);
  };

  const handleSeek = (pos: number) => {
    if (mediaSession) {
      setPlaybackInfo(prev => ({ ...prev, position: pos }));
      seekTo(mediaSession.packageName, pos);
    }
  };

  const handleAppLaunch = async (app: MusicApp) => {
    await showBackToCarUIButton();
    await launchApp(app.packageName);
  };

  const hasActiveSession = mediaSession && mediaSession.isActive;
  const isPlaying = mediaSession?.playbackState === 'playing';

  // Ключ для форса перерисовки при смене трека
  // Если название изменилось - компоненты внутри пересоздадутся с нуля
  const trackKey = mediaSession ? `${mediaSession.packageName}-${mediaSession.metadata.title}` : 'empty';

  return (
      <FrozenScreen active={isActive} style={styles.screen}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

        {hasActiveSession && (
            <View style={[styles.ambientGlow, { backgroundColor: accent.primary }]} />
        )}

        <View style={styles.mainContent}>
          {hasActiveSession ? (
              <View style={styles.playerLayout}>

                <View style={styles.artColumn}>
                  <AlbumArt
                      key={`art-${trackKey}`}
                      uri={mediaSession.metadata.albumArt}
                      isPlaying={isPlaying}
                      accentColor={accent.primary}
                      size={280}
                  />
                </View>

                <View style={styles.controlsColumn}>
                  <TrackDetails
                      key={`details-${trackKey}`}
                      title={mediaSession.metadata.title}
                      artist={mediaSession.metadata.artist}
                      album={mediaSession.metadata.album}
                      accentColor={accent.primary}
                  />

                  <ProgressBar
                      key={`progress-${trackKey}`} // Новый трек = новый прогресс бар
                      position={playbackInfo.position}
                      duration={playbackInfo.duration}
                      onSeek={handleSeek}
                      accentColor={accent.primary}
                      disabled={!mediaSession.supportsSeek}
                  />

                  <PlayerControls
                      playbackState={mediaSession.playbackState}
                      actions={mediaSession.actions}
                      onPlay={handlePlayPause}
                      onPause={handlePlayPause}
                      onSkipNext={() => skipNext(mediaSession.packageName)}
                      onSkipPrevious={() => skipPrevious(mediaSession.packageName)}
                      onAction={(id) => performMediaAction(mediaSession.packageName, id)}
                      accentColor={accent.primary}
                  />
                </View>
              </View>
          ) : (
              <NoMediaState accentColor={accent.primary} />
          )}
        </View>

        <View style={styles.footer}>
          <MusicAppsList
              apps={musicApps}
              activePackage={mediaSession?.packageName}
              onAppPress={handleAppLaunch}
              accentColor={accent.primary}
          />
        </View>
      </FrozenScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BASE_COLORS.background.primary,
  },
  ambientGlow: {
    position: 'absolute',
    top: '20%',
    left: '10%',
    width: '40%',
    height: '60%',
    borderRadius: 300,
    opacity: 0.1,
    transform: [{ scale: 1.5 }],
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxl,
  },
  playerLayout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xxl,
  },
  artColumn: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: SPACING.lg,
  },
  controlsColumn: {
    flex: 1.2,
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: SPACING.lg,
    paddingLeft: SPACING.lg,
    maxWidth: 500,
  },
  footer: {
    paddingBottom: SPACING.lg,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderTopWidth: 1,
    borderTopColor: BASE_COLORS.glass.border,
  },
});