import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { authApi, DEFAULT_TENANT_SLUG } from '../../lib/api';
import { useAuthStore } from '../../lib/auth.store';
import { getApiErrorMessage } from '../../lib/errors';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedTenantSlug, setSelectedTenantSlug] = useState(DEFAULT_TENANT_SLUG ?? '');
  const [tenantModalVisible, setTenantModalVisible] = useState(false);
  const [tenantSearch, setTenantSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const signIn = useAuthStore((s) => s.signIn);
  const signOut = useAuthStore((s) => s.signOut);

  const {
    data: tenants = [],
    isLoading: tenantsLoading,
    isError: tenantsError,
    error: tenantsQueryError,
  } = useQuery({
    queryKey: ['public-tenants'],
    queryFn: () => authApi.listTenants().then((r) => r.data),
  });

  const fallbackTenants = selectedTenantSlug
    ? [{ id: 0, name: selectedTenantSlug, slug: selectedTenantSlug }]
    : [];
  const visibleTenants = tenants.length > 0 ? tenants : fallbackTenants;
  const selectedTenant = visibleTenants.find((tenant) => tenant.slug === selectedTenantSlug);
  const filteredTenants = visibleTenants.filter((tenant) => {
    const term = tenantSearch.trim().toLowerCase();
    if (!term) return true;
    return tenant.name.toLowerCase().includes(term) || tenant.slug.toLowerCase().includes(term);
  });
  const tenantErrorMessage = tenantsError
    ? getApiErrorMessage(
        tenantsQueryError,
        'Não foi possível carregar as escolas. Usando a escola configurada neste ambiente.',
      )
    : null;

  useEffect(() => {
    if (selectedTenantSlug || tenants.length === 0) return;

    const defaultTenant = tenants.find((tenant) => tenant.slug === DEFAULT_TENANT_SLUG);
    setSelectedTenantSlug(defaultTenant?.slug ?? tenants[0].slug);
  }, [selectedTenantSlug, tenants]);

  const handleSelectTenant = (slug: string) => {
    setSelectedTenantSlug(slug);
    setTenantSearch('');
    setTenantModalVisible(false);
  };

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
      const msg = getApiErrorMessage(error, 'Credenciais inválidas. Tente novamente.');
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
          <View style={styles.logoPlate}>
            <Image
              source={require('../../assets/images/colaboraedu-logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
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
              <View>
                {tenantErrorMessage ? (
                  <Text style={styles.tenantErrorText}>{tenantErrorMessage}</Text>
                ) : null}
                <TouchableOpacity
                  style={styles.tenantSelect}
                  onPress={() => setTenantModalVisible(true)}
                  activeOpacity={0.85}
                  disabled={visibleTenants.length === 0}
                >
                  <View style={styles.tenantSelectTextWrap}>
                    <Text style={styles.tenantSelectName} numberOfLines={1}>
                      {selectedTenant?.name ?? 'Selecionar escola'}
                    </Text>
                    {visibleTenants.length > 1 ? (
                      <Text style={styles.tenantSelectHint}>
                        {visibleTenants.length} escolas disponíveis
                      </Text>
                    ) : null}
                  </View>
                  <MaterialIcons name="expand-more" size={24} color="#94a3b8" />
                </TouchableOpacity>
                {visibleTenants.length === 0 ? (
                  <Text style={styles.tenantErrorText}>
                    Nenhuma escola disponível. Confira a URL da API do app.
                  </Text>
                ) : null}
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

      <Modal
        animationType="slide"
        transparent
        visible={tenantModalVisible}
        onRequestClose={() => setTenantModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setTenantModalVisible(false)}>
          <Pressable style={styles.tenantModal} onPress={(event) => event.stopPropagation()}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Escolha a escola</Text>
              <TouchableOpacity onPress={() => setTenantModalVisible(false)} style={styles.modalCloseBtn}>
                <MaterialIcons name="close" size={22} color="#cbd5e1" />
              </TouchableOpacity>
            </View>
            <View style={styles.searchBox}>
              <MaterialIcons name="search" size={20} color="#94a3b8" />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar por nome da escola"
                placeholderTextColor="#64748b"
                value={tenantSearch}
                onChangeText={setTenantSearch}
                autoCapitalize="none"
              />
            </View>
            <ScrollView style={styles.tenantOptions} keyboardShouldPersistTaps="handled">
              {filteredTenants.map((tenant) => {
                const active = selectedTenantSlug === tenant.slug;
                return (
                  <TouchableOpacity
                    key={tenant.slug}
                    style={[styles.tenantOption, active && styles.tenantOptionActive]}
                    onPress={() => handleSelectTenant(tenant.slug)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.tenantIcon}>
                      <MaterialIcons name="school" size={19} color={active ? '#bfdbfe' : '#94a3b8'} />
                    </View>
                    <View style={styles.tenantOptionTextWrap}>
                      <Text style={[styles.tenantOptionName, active && styles.tenantOptionNameActive]}>
                        {tenant.name}
                      </Text>
                      <Text style={styles.tenantOptionSlug}>{tenant.slug}</Text>
                    </View>
                    {active ? <MaterialIcons name="check" size={22} color="#60a5fa" /> : null}
                  </TouchableOpacity>
                );
              })}
              {filteredTenants.length === 0 ? (
                <Text style={styles.noTenantText}>Nenhuma escola encontrada.</Text>
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
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
    marginBottom: 28,
  },
  logoPlate: {
    width: 250,
    height: 82,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    paddingHorizontal: 18,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 12,
  },
  logoImage: {
    width: '100%',
    height: '100%',
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
  tenantErrorText: {
    color: '#fca5a5',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  tenantSelect: {
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 12,
    flexDirection: 'row',
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  tenantSelectTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  tenantSelectName: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '800',
  },
  tenantSelectHint: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
    justifyContent: 'flex-end',
  },
  tenantModal: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderColor: '#334155',
    borderWidth: 1,
    maxHeight: '78%',
    paddingBottom: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  modalHandle: {
    alignSelf: 'center',
    backgroundColor: '#475569',
    borderRadius: 999,
    height: 4,
    marginBottom: 16,
    width: 44,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '900',
  },
  modalCloseBtn: {
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderColor: '#334155',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  searchInput: {
    color: '#f8fafc',
    flex: 1,
    fontSize: 15,
  },
  tenantOptions: {
    marginTop: 12,
  },
  tenantOption: {
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderColor: '#334155',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
    minHeight: 62,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tenantOptionActive: {
    backgroundColor: '#172554',
    borderColor: '#3b82f6',
  },
  tenantIcon: {
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  tenantOptionTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  tenantOptionName: {
    color: '#cbd5e1',
    fontSize: 15,
    fontWeight: '800',
  },
  tenantOptionNameActive: {
    color: '#ffffff',
  },
  tenantOptionSlug: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  noTenantText: {
    color: '#94a3b8',
    fontSize: 14,
    paddingVertical: 24,
    textAlign: 'center',
  },
});
