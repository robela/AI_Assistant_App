import React, { useState, useEffect, useRef } from 'react';
import { TouchableOpacity, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Audio, AVPlaybackStatus } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { Feather } from '@expo/vector-icons';

interface AudioPlayerProps {
  audioArrayBuffer: ArrayBuffer;
  onComplete?: () => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ audioArrayBuffer, onComplete }) => {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);
  const didFireComplete = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const loadAudio = async () => {
      try {
        setLoading(true);
        setLoadError(false);
        didFireComplete.current = false;

        // ArrayBuffer → base64
        const uint8Array = new Uint8Array(audioArrayBuffer);
        let binary = '';
        for (let i = 0; i < uint8Array.length; i++) {
          binary += String.fromCharCode(uint8Array[i]);
        }
        const base64 = btoa(binary);

        const filename = `${FileSystem.documentDirectory}tts_${Date.now()}.wav`;
        await FileSystem.writeAsStringAsync(filename, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        if (cancelled) return;

        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });

        const { sound } = await Audio.Sound.createAsync(
          { uri: filename },
          { shouldPlay: true },
          (status: AVPlaybackStatus) => {
            if (!status.isLoaded) return;
            setIsPlaying(status.isPlaying);
            setCurrentTime((status.positionMillis ?? 0) / 1000);
            setTotalDuration((status.durationMillis ?? 0) / 1000);
            if (status.didJustFinish && !didFireComplete.current) {
              didFireComplete.current = true;
              onComplete?.();
            }
          },
        );

        if (cancelled) {
          sound.unloadAsync();
          return;
        }

        soundRef.current = sound;
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.error('Error loading audio:', err);
          setLoading(false);
          setLoadError(true);
        }
      }
    };

    loadAudio();

    return () => {
      cancelled = true;
      soundRef.current?.unloadAsync();
      soundRef.current = null;
    };
  }, [audioArrayBuffer]);

  const togglePlayPause = async () => {
    if (!soundRef.current) return;
    if (isPlaying) {
      await soundRef.current.pauseAsync();
    } else {
      await soundRef.current.playAsync();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#A63D33" />
        <Text style={styles.loadingText}>Loading audio...</Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Failed to load audio</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.playButton} onPress={togglePlayPause}>
        <Feather name={isPlaying ? 'pause' : 'play'} size={18} color="#fff" />
      </TouchableOpacity>
      <View style={styles.progressContainer}>
        <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: totalDuration > 0 ? `${(currentTime / totalDuration) * 100}%` : '0%' },
            ]}
          />
        </View>
        <Text style={styles.timeText}>{formatTime(totalDuration)}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F3C6C0',
    borderRadius: 12,
    marginVertical: 8,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#A63D33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#A63D33',
  },
  timeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5C2018',
    minWidth: 28,
  },
  loadingText: {
    fontSize: 12,
    color: '#5C2018',
  },
});

