import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { authApi } from '../lib/api';
import { useAuthStore } from '../lib/auth.store';
import { getApiErrorMessage } from '../lib/errors';

function passwordError(password: string) {
  if (password.length < 8) return 'A senha deve ter pelo menos 8 caracteres.';
  if (!/[A-Z]/.test(password)) return 'Inclua pelo menos uma letra maiúscula.';
  if (!/[0-9]/.test(password)) return 'Inclua pelo menos um número.';
  if (!/[!@#$%^&*()\-_=+\[\]{};:'",.<>?/\\|`~]/.test(password)) {
    return 'Inclua pelo menos um caractere especial.';
  }
  return null;
}

export default function ChangePasswordScreen() {
  const user = useAuthStore((s) => s.user);
  const signIn = useAuthStore((s) => s.signIn);
  const signOut = useAuthStore((s) => s.signOut);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    const validationError = passwordError(newPassword);
    if (!currentPassword.trim()) {
      Alert.alert('Atenção', 'Informe a senha temporária atual.');
      return;
    }
    if (validationError) {
      Alert.alert('Senha inválida', validationError);
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Atenção', 'A nova senha e a confirmação não conferem.');
      return;
    }

    setLoading(true);
    try {
      const { data } = await authApi.changePassword(currentPassword, newPassword);
      await signIn(data.access_token, data.refresh_token, data.user);
      router.replace('/(tabs)');
    } catch (error: unknown) {
      const msg = getApiErrorMessage(
        error,
        'Não foi possível alterar a senha. Confira a senha atual e tente novamente.',
      );
      Alert.alert('Erro ao alterar senha', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleExit = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Crie sua nova senha</Text>
          <Text style={styles.subtitle}>
            {user?.username ? `${user.username}, ` : ''}
            no primeiro acesso é necessário trocar a senha temporária.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Senha temporária</Text>
            <TextInput
              style={styles.input}
              secureTextEntry
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Senha atual"
              placeholderTextColor="#64748b"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nova senha</Text>
            <TextInput
              style={styles.input}
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Mín. 8, maiúscula, número e especial"
              placeholderTextColor="#64748b"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirmar nova senha</Text>
            <TextInput
              style={styles.input}
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Repita a nova senha"
              placeholderTextColor="#64748b"
              onSubmitEditing={handleSave}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Salvar senha</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.exitButton} onPress={handleExit}>
            <Text style={styles.exitText}>Sair e voltar ao login</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  inner: { flex: 1, justifyContent: 'center', padding: 24 },
  header: { marginBottom: 24 },
  title: { color: '#f8fafc', fontSize: 28, fontWeight: '800' },
  subtitle: { color: '#94a3b8', fontSize: 15, lineHeight: 22, marginTop: 8 },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: '#334155',
  },
  inputGroup: { marginBottom: 16 },
  label: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#0f172a',
    borderColor: '#334155',
    borderRadius: 12,
    borderWidth: 1,
    color: '#f8fafc',
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 14,
    marginTop: 8,
    paddingVertical: 15,
  },
  buttonDisabled: { opacity: 0.65 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  exitButton: { alignItems: 'center', paddingVertical: 16 },
  exitText: { color: '#93c5fd', fontSize: 14, fontWeight: '700' },
});
