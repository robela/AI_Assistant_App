import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../auth';

const ACCENT = '#A63D33';
const TITLE_COLOR = '#92190c';

export default function LoginScreen() {
  const { signIn, backendUrl, setBackendUrl, subscriptionKey, setSubscriptionKey } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showServer, setShowServer] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password || loading) return;
    setError('');
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (e: any) {
      const status = e?.status;
      if (status === 401 || status === 404) {
        setError('Username or password are incorrect');
      } else if (status === 403) {
        setError('This user is deactivated. Please contact the administrator.');
      } else {
        setError(e?.message || 'An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#FFF5F3', '#FCE4E0', '#F3C6C0']} style={styles.gradient}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.center}>
          <View style={styles.card}>
            <Text style={styles.title}>Login</Text>
            <Text style={styles.subtitle}>Please enter your details</Text>

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="name@example.com"
              placeholderTextColor="#C99"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />

            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInput}
                placeholder="••••••••"
                placeholderTextColor="#C99"
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={handleLogin}
                returnKeyType="go"
              />
              <TouchableOpacity onPress={() => setShowPassword((p) => !p)} style={styles.eyeBtn}>
                <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color={ACCENT} />
              </TouchableOpacity>
            </View>

            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.button, (loading || !email || !password) && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading || !email || !password}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Login</Text>
              )}
            </TouchableOpacity>

            {/* Advanced: change the backend server URL */}
            <TouchableOpacity onPress={() => setShowServer((s) => !s)} style={styles.serverToggle}>
              <Feather name="server" size={13} color="#B07A70" />
              <Text style={styles.serverToggleText}>Server settings</Text>
            </TouchableOpacity>
            {showServer && (
              <>
                <TextInput
                  style={styles.serverInput}
                  value={backendUrl}
                  onChangeText={setBackendUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="http://192.168.1.6:8000"
                  placeholderTextColor="#C99"
                />
                <TextInput
                  style={styles.serverInput}
                  value={subscriptionKey}
                  onChangeText={setSubscriptionKey}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                  placeholder="APIM Subscription Key (if required)"
                  placeholderTextColor="#C99"
                />
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    gap: 6,
    shadowColor: '#A63D33',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  title: { fontSize: 26, fontWeight: '700', color: TITLE_COLOR },
  subtitle: { fontSize: 14, color: '#8a6a64', marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: ACCENT, marginTop: 10, marginBottom: 6 },
  input: {
    backgroundColor: '#FFF7F5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: '#3A1410',
    borderWidth: 1,
    borderColor: '#F3C6C0',
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7F5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3C6C0',
    paddingRight: 8,
  },
  passwordInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: '#3A1410' },
  eyeBtn: { padding: 8 },
  errorBox: { backgroundColor: '#FFE3DE', borderRadius: 10, padding: 12, marginTop: 12 },
  errorText: { color: '#A1271A', fontSize: 13 },
  button: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 18,
  },
  buttonDisabled: { backgroundColor: '#E0A89F' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  serverToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 16 },
  serverToggleText: { color: '#B07A70', fontSize: 12 },
  serverInput: {
    backgroundColor: '#FFF7F5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#3A1410',
    borderWidth: 1,
    borderColor: '#F3C6C0',
    marginTop: 8,
  },
});
