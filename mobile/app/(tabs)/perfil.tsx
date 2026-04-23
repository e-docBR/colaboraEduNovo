/**
 * Profile tab — shows user info and sign-out button.
 */
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../lib/auth.store';

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export default function PerfilScreen() {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  const handleSignOut = () => {
    Alert.alert('Sair', 'Deseja encerrar sua sessão?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const initials = (user?.nome ?? 'U')
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  const roleLabel: Record<string, string> = {
    admin: 'Administrador',
    coordenador: 'Coordenador Pedagógico',
    professor: 'Professor',
    aluno: 'Aluno',
    super_admin: 'Super Admin',
  };

  const primaryRole = user?.roles?.[0] ?? 'usuario';

  return (
    <View style={styles.container}>
      {/* Avatar */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.name}>{user?.nome ?? '—'}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{roleLabel[primaryRole] ?? primaryRole}</Text>
        </View>
      </View>

      {/* Info */}
      <View style={styles.card}>
        <ProfileRow label="E-mail" value={user?.email ?? '—'} />
        <View style={styles.divider} />
        <ProfileRow label="Instituição" value={user?.tenant_name ?? '—'} />
        <View style={styles.divider} />
        <ProfileRow
          label="Permissões"
          value={(user?.roles ?? []).join(', ') || '—'}
        />
      </View>

      {/* Sign out */}
      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Text style={styles.signOutText}>🚪  Sair da conta</Text>
      </TouchableOpacity>

      <Text style={styles.version}>ColaboraEdu v1.0 · Mobile</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 24 },
  avatarSection: { alignItems: 'center', marginBottom: 32, marginTop: 8 },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#1d4ed8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 3,
    borderColor: '#3b82f6',
  },
  avatarText: { color: '#ffffff', fontSize: 32, fontWeight: '800' },
  name: { fontSize: 22, fontWeight: '700', color: '#f1f5f9', marginBottom: 8 },
  roleBadge: {
    backgroundColor: '#1e3a5f',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  roleText: { color: '#60a5fa', fontSize: 13, fontWeight: '600' },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  rowLabel: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  rowValue: { fontSize: 14, color: '#e2e8f0', fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
  divider: { height: 1, backgroundColor: '#334155', marginHorizontal: 16 },
  signOutBtn: {
    backgroundColor: '#7f1d1d',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#991b1b',
  },
  signOutText: { color: '#fca5a5', fontSize: 16, fontWeight: '700' },
  version: {
    textAlign: 'center',
    color: '#334155',
    fontSize: 12,
    marginTop: 24,
  },
});
