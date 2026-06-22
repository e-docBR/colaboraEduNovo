import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { authApi, DEFAULT_TENANT_SLUG } from '../../lib/api';
import { useAuthStore } from '../../lib/auth.store';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedTenantSlug, setSelectedTenantSlug] = useState(DEFAULT_TENANT_SLUG ?? '');
  const [loading, setLoading] = useState(false);
  const signIn = useAuthStore((s) => s.signIn);
  const signOut = useAuthStore((s) => s.signOut);

  const { data: tenants = [], isLoading: tenantsLoading } = useQuery({
    queryKey: ['public-tenants'],
    queryFn: () => authApi.listTenants().then((r) => r.data),
  });

  useEffect(() => {
    if (selectedTenantSlug || tenants.length === 0) return;

    const defaultTenant = tenants.find((tenant) => tenant.slug === DEFAULT_TENANT_SLUG);
    setSelectedTenantSlug(defaultTenant?.slug ?? tenants[0].slug);
  }, [selectedTenantSlug, tenants]);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Atenção', 'Preencha o usuário e a senha.');
      return;
    }

    if (!selectedTenantSlug) {
      Alert.alert('Atenção', 'Selecione a escola para continuar.');
      return;
    }

    setLoading(true);
    try {
      const { data } = await authApi.login(
        username.trim(),
        password,
        selectedTenantSlug,
      );
      await signIn(data.access_token, data.refresh_token, data.user);
      if (!['aluno', 'responsavel'].includes(data.user.role)) {
        await signOut();
        Alert.alert(
          'App exclusivo para famílias',
          'Este aplicativo é destinado a alunos e responsáveis. A equipe escolar deve acessar pelo painel web.',
        );
        return;
      }
      if (data.user.must_change_password) {
        router.replace('/change-password');
      } else {
        router.replace('/(tabs)');
      }
    } catch (error: unknown) {
      const msg =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Credenciais inválidas. Tente novamente.';
      Alert.alert('Erro ao entrar', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Background gradient overlay */}
      <View style={styles.backgroundTop} />

      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Logo / Brand */}
        <View style={styles.brand}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoEmoji}>🎓</Text>
          </View>
          <Text style={styles.appName}>ColaboraEdu</Text>
          <Text style={styles.appTagline}>Plataforma de Gestão Educacional</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Portal da família</Text>
          <Text style={styles.cardSubtitle}>Acompanhe boletins, ocorrências e recados</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Escola</Text>
            {tenantsLoading ? (
              <View style={styles.tenantLoading}>
                <ActivityIndicator color="#3b82f6" size="small" />
                <Text style={styles.tenantLoadingText}>Carregando escolas...</Text>
              </View>
            ) : (
              <View style={styles.tenantList}>
                {tenants.map((tenant) => {
                  const active = selectedTenantSlug === tenant.slug;
                  return (
                    <TouchableOpacity
                      key={tenant.slug}
                      style={[styles.tenantChip, active && styles.tenantChipActive]}
                      onPress={() => setSelectedTenantSlug(tenant.slug)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[styles.tenantChipText, active && styles.tenantChipTextActive]}
                        numberOfLines={1}
                      >
                        {tenant.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Username */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Usuário</Text>
            <TextInput
              style={styles.input}
              placeholder="resp_12345 ou matrícula"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              keyboardType="default"
              returnKeyType="next"
              value={username}
              onChangeText={setUsername}
            />
          </View>

          {/* Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Senha</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#94a3b8"
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>Entrar</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>ColaboraEdu © {new Date().getFullYear()}</Text>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  backgroundTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '45%',
    backgroundColor: '#1e3a5f',
    borderBottomLeftRadius: 60,
    borderBottomRightRadius: 60,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  brand: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  logoEmoji: {
    fontSize: 40,
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  appTagline: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 24,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#f1f5f9',
  },
  tenantLoading: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  tenantLoadingText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  tenantList: {
    gap: 8,
  },
  tenantChip: {
    minHeight: 48,
    justifyContent: 'center',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  tenantChipActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#172554',
  },
  tenantChipText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  tenantChipTextActive: {
    color: '#f8fafc',
  },
  button: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  footer: {
    textAlign: 'center',
    color: '#334155',
    fontSize: 12,
    marginTop: 24,
  },
});
