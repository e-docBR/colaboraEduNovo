/**
 * Home / Dashboard tab screen.
 * Shows summary cards with key metrics from the backend.
 */
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../lib/auth.store';
import { dashboardApi } from '../../lib/api';

interface MetricCardProps {
  label: string;
  value: string | number;
  emoji: string;
  color: string;
}

function MetricCard({ label, value, emoji, color }: MetricCardProps) {
  return (
    <View style={[styles.card, { borderLeftColor: color }]}>
      <Text style={styles.cardEmoji}>{emoji}</Text>
      <Text style={[styles.cardValue, { color }]}>{value}</Text>
      <Text style={styles.cardLabel}>{label}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => dashboardApi.summary().then((r) => r.data),
    enabled: true,
  });

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
    >
      {/* Header greeting */}
      <View style={styles.header}>
        <Text style={styles.greeting}>
          {greeting()}, {user?.username?.split(' ')[0] ?? 'colega'} 👋
        </Text>
        <Text style={styles.institution}>{user?.tenant_name ?? 'ColaboraEdu'}</Text>
      </View>

      {/* Metrics */}
      {isLoading && (
        <ActivityIndicator color="#3b82f6" size="large" style={{ marginTop: 40 }} />
      )}

      {isError && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            Não foi possível carregar o dashboard. Verifique a conexão.
          </Text>
        </View>
      )}

      {data && (
        <View style={styles.grid}>
          <MetricCard
            label="Total de Alunos"
            value={data.total_alunos ?? '—'}
            emoji="👥"
            color="#3b82f6"
          />
          <MetricCard
            label="Turmas Ativas"
            value={data.total_turmas ?? '—'}
            emoji="🏫"
            color="#10b981"
          />
          <MetricCard
            label="Média Geral"
            value={data.media_geral ? data.media_geral.toFixed(1) : '—'}
            emoji="📊"
            color="#f59e0b"
          />
          <MetricCard
            label="Alunos em Risco"
            value={data.alunos_em_risco ?? '—'}
            emoji="⚠️"
            color="#ef4444"
          />
        </View>
      )}

      {/* Quick access */}
      <Text style={styles.sectionTitle}>Acesso Rápido</Text>
      <View style={styles.quickActions}>
        {[
          { emoji: '📋', label: 'Ver Relatórios' },
          { emoji: '🤖', label: 'Perguntar à IA' },
          { emoji: '📢', label: 'Comunicados' },
        ].map((item) => (
          <View key={item.label} style={styles.quickItem}>
            <Text style={styles.quickEmoji}>{item.emoji}</Text>
            <Text style={styles.quickLabel}>{item.label}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { padding: 24, paddingBottom: 8 },
  greeting: { fontSize: 22, fontWeight: '700', color: '#f1f5f9' },
  institution: { fontSize: 13, color: '#64748b', marginTop: 2 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    width: '47%',
    borderLeftWidth: 4,
    alignItems: 'flex-start',
  },
  cardEmoji: { fontSize: 24, marginBottom: 8 },
  cardValue: { fontSize: 28, fontWeight: '800' },
  cardLabel: { fontSize: 12, color: '#94a3b8', marginTop: 4, fontWeight: '500' },
  errorBox: {
    margin: 24,
    padding: 16,
    backgroundColor: '#7f1d1d',
    borderRadius: 12,
  },
  errorText: { color: '#fca5a5', fontSize: 14 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#94a3b8',
    paddingHorizontal: 24,
    paddingTop: 24,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    paddingBottom: 32,
  },
  quickItem: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  quickEmoji: { fontSize: 26, marginBottom: 6 },
  quickLabel: { fontSize: 11, color: '#94a3b8', textAlign: 'center', fontWeight: '500' },
});
