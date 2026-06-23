import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import {
  comunicadosApi,
  familyApi,
  ocorrenciasApi,
  type AlunoDetail,
  type Comunicado,
  type Ocorrencia,
  type ResponsavelComunicado,
  type ResponsavelOcorrencia,
} from '../../lib/api';
import { useAuthStore } from '../../lib/auth.store';

function fmtNota(value?: number | null) {
  return typeof value === 'number' ? value.toFixed(1) : '—';
}

function totalFaltas(aluno?: AlunoDetail | null) {
  if (!aluno?.notas?.length) return aluno?.faltas ?? 0;
  return aluno.notas.reduce((sum, nota) => sum + (nota.faltas ?? 0), 0);
}

function MetricCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <View style={[styles.metricCard, { borderTopColor: color }]}>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  const isResponsavel = role === 'responsavel';
  const isAluno = role === 'aluno';

  const responsavelQuery = useQuery({
    queryKey: ['family-home', 'responsavel'],
    queryFn: () => familyApi.getMeuFilho().then((r) => r.data),
    enabled: isResponsavel,
  });

  const alunoQuery = useQuery({
    queryKey: ['family-home', 'aluno'],
    queryFn: () => familyApi.getMeuAluno().then((r) => r.data),
    enabled: isAluno,
  });

  const alunoOcorrenciasQuery = useQuery({
    queryKey: ['family-home', 'aluno-ocorrencias', user?.aluno_id],
    queryFn: () => ocorrenciasApi.listByAluno(Number(user?.aluno_id)).then((r) => r.data.items),
    enabled: isAluno && !!user?.aluno_id,
  });

  const alunoComunicadosQuery = useQuery({
    queryKey: ['family-home', 'aluno-comunicados'],
    queryFn: () => comunicadosApi.list({ per_page: 20 }).then((r) => r.data.items),
    enabled: isAluno,
  });

  const familyQueries = isResponsavel
    ? [responsavelQuery]
    : [alunoQuery, alunoOcorrenciasQuery, alunoComunicadosQuery];

  const isLoading = familyQueries.some((query) => query.isLoading);
  const isError = familyQueries.some((query) => query.isError);

  const aluno = isResponsavel ? responsavelQuery.data?.aluno : alunoQuery.data;
  const ocorrencias: Array<Ocorrencia | ResponsavelOcorrencia> =
    isResponsavel ? responsavelQuery.data?.ocorrencias ?? [] : alunoOcorrenciasQuery.data ?? [];
  const comunicados: Array<Comunicado | ResponsavelComunicado> =
    isResponsavel ? responsavelQuery.data?.comunicados ?? [] : alunoComunicadosQuery.data ?? [];

  const refetch = () => {
    familyQueries.forEach((query) => query.refetch());
  };

  const isRefetching = familyQueries.some((query) => query.isRefetching);

  const unreadCount = comunicados.filter((item) =>
    'lido' in item ? !item.lido : !item.is_read,
  ).length;
  const openOcorrencias = ocorrencias.filter((item) => !item.resolvida).length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
    >
      <View style={styles.header}>
        <Text style={styles.overline}>{role === 'responsavel' ? 'Portal do responsável' : 'Portal do aluno'}</Text>
        <Text style={styles.title}>Acompanhamento escolar</Text>
        <Text style={styles.subtitle}>{user?.tenant_name ?? 'ColaboraEdu'}</Text>
      </View>

      {isLoading && <ActivityIndicator color="#3b82f6" size="large" style={styles.loader} />}

      {isError && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>Não foi possível carregar os dados. Puxe para atualizar.</Text>
        </View>
      )}

      {aluno && (
        <>
          <View style={styles.studentCard}>
            <Text style={styles.studentName}>{aluno.nome}</Text>
            <Text style={styles.studentMeta}>
              Matrícula {aluno.matricula ?? '—'} · {aluno.turma} · {aluno.turno}
            </Text>
          </View>

          <View style={styles.metrics}>
            <MetricCard label="Média geral" value={fmtNota(aluno.media)} color="#22c55e" />
            <MetricCard label="Faltas" value={totalFaltas(aluno)} color="#f59e0b" />
            <MetricCard label="Ocorrências abertas" value={openOcorrencias} color="#ef4444" />
            <MetricCard label="Recados não lidos" value={unreadCount} color="#3b82f6" />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Últimas atualizações</Text>
            {ocorrencias.slice(0, 2).map((item) => (
              <View key={`oc-${item.id}`} style={styles.updateItem}>
                <Text style={styles.updateType}>Ocorrência · {item.tipo}</Text>
                <Text style={styles.updateText} numberOfLines={2}>{item.descricao}</Text>
              </View>
            ))}
            {comunicados.slice(0, 2).map((item) => (
              <View key={`co-${item.id}`} style={styles.updateItem}>
                <Text style={styles.updateType}>Recado</Text>
                <Text style={styles.updateText} numberOfLines={2}>{item.titulo}</Text>
              </View>
            ))}
            {ocorrencias.length === 0 && comunicados.length === 0 && (
              <Text style={styles.emptyText}>Nenhuma atualização recente.</Text>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 20, paddingBottom: 36 },
  header: { marginBottom: 20 },
  overline: { color: '#60a5fa', fontSize: 12, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  title: { color: '#f8fafc', fontSize: 26, fontWeight: '800', marginTop: 6 },
  subtitle: { color: '#94a3b8', fontSize: 14, marginTop: 4 },
  loader: { marginTop: 40 },
  errorBox: { backgroundColor: '#7f1d1d', borderRadius: 14, marginTop: 20, padding: 16 },
  errorText: { color: '#fecaca', fontSize: 14 },
  studentCard: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
  },
  studentName: { color: '#f8fafc', fontSize: 20, fontWeight: '800' },
  studentMeta: { color: '#94a3b8', fontSize: 13, lineHeight: 20, marginTop: 6 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 },
  metricCard: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderRadius: 16,
    borderTopWidth: 4,
    borderWidth: 1,
    padding: 14,
    width: '48%',
  },
  metricValue: { fontSize: 25, fontWeight: '900' },
  metricLabel: { color: '#94a3b8', fontSize: 12, fontWeight: '600', marginTop: 4 },
  section: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 18,
    padding: 16,
  },
  sectionTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '800', marginBottom: 10 },
  updateItem: { borderTopColor: '#334155', borderTopWidth: 1, paddingVertical: 12 },
  updateType: { color: '#60a5fa', fontSize: 12, fontWeight: '800', marginBottom: 4 },
  updateText: { color: '#cbd5e1', fontSize: 14, lineHeight: 20 },
  emptyText: { color: '#64748b', fontSize: 14, paddingVertical: 10, textAlign: 'center' },
});
