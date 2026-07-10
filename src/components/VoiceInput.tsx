import React, { useState, useRef } from 'react';
import { TouchableOpacity, View, Text, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { useAudioRecorder, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import { Feather } from '@expo/vector-icons';

interface VoiceInputProps {
  onRecordingComplete: (audioUri: string, duration: number) => void;
  onBeforeRecord?: () => void;
  disabled?: boolean;
  transcribing?: boolean;
}

// iOS: WAV (linear PCM) — avoids M4A moov-atom finalization issues and the
// server-side ffmpeg conversion failure. uploadAsync sends mimeType 'audio/wav'
// directly so iOS's native 'audio/vnd.wave' report is never seen by the server.
//
// Android: M4A/AAC — Android MediaRecorder doesn't support WAV output natively.
//
// Web: WAV via MediaRecorder.
const IOS_WAV_OPTIONS: any = {
  extension: '.wav',
  sampleRate: 16000,
  numberOfChannels: 1,
  // No bitRate — PCM is uncompressed; bitRate applies only to lossy codecs.
};

const ANDROID_M4A_OPTIONS: any = {
  extension: '.m4a',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 32000,
  audioQuality: 96,
  android: {
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
  },
};

const STT_RECORDING_OPTIONS: any =
  Platform.OS === 'ios'
    ? IOS_WAV_OPTIONS
    : Platform.OS === 'android'
    ? ANDROID_M4A_OPTIONS
    : { extension: '.wav', web: { mimeType: 'audio/wav' } };

export const VoiceInput: React.FC<VoiceInputProps> = ({ onRecordingComplete, onBeforeRecord, disabled = false, transcribing = false }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef(0);

  const recorder = useAudioRecorder(STT_RECORDING_OPTIONS);

  const startRecording = async () => {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        console.error('Microphone permission denied');
        return;
      }

      // Dismiss any active AudioPlayer so its session doesn't block ours
      onBeforeRecord?.();

      // iOS requires both flags; switching session category needs a moment to settle
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await new Promise<void>(resolve => setTimeout(resolve, 120));

      // Pass options explicitly so the native layer creates a fresh AVAudioRecorder
      await recorder.prepareToRecordAsync(STT_RECORDING_OPTIONS);
      recorder.record();

      setIsRecording(true);
      setRecordingTime(0);
      durationRef.current = 0;

      timerRef.current = setInterval(() => {
        durationRef.current += 1;
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    try {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      await recorder.stop();
      // Restore audio session to playback mode
      await setAudioModeAsync({ allowsRecording: false });
      const uri = recorder.uri;

      if (!uri) {
        console.error('No recording URI');
        return;
      }

      if (durationRef.current < 1) {
        console.warn('Recording too short, ignoring');
        return;
      }

      onRecordingComplete(uri, durationRef.current);
    } catch (error) {
      console.error('Error stopping recording:', error);
    } finally {
      setIsRecording(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      {isRecording && (
        <Text style={styles.timerInline}>{formatTime(recordingTime)}</Text>
      )}
      <TouchableOpacity
        style={[styles.button, isRecording && styles.buttonRecording, (disabled || transcribing) && styles.buttonDisabled]}
        onPress={isRecording ? stopRecording : startRecording}
        disabled={disabled || transcribing}
      >
        {transcribing
          ? <ActivityIndicator size="small" color="#fff" />
          : <Feather name={isRecording ? 'square' : 'mic'} size={18} color="#fff" />}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#A63D33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonRecording: {
    backgroundColor: '#ef4444',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  timerInline: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '600',
    marginRight: 2,
  },
});
