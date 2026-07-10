import React from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthProvider, useAuth } from './src/auth';
import LoginScreen from './src/screens/LoginScreen';
import ChatScreen from './src/screens/ChatScreen';
import { DEFAULT_BACKEND_URL } from './config';

function Root() {
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return (
      <LinearGradient colors={['#FFF5F3', '#FCE4E0', '#F3C6C0']} style={styles.center}>
        <ActivityIndicator size="large" color="#A63D33" />
      </LinearGradient>
    );
  }

  return token ? <ChatScreen /> : <LoginScreen />;
}

export default function App() {
  return (
    <AuthProvider defaultBackendUrl={DEFAULT_BACKEND_URL}>
      <Root />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
