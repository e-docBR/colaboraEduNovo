import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { familyApi, type AlunoDetail, type AlunoNota } from '../../lib/api';
import { useAuthStore } from '../../lib/auth.store';

function fmtNota(value?: number | null) {
  return typeof value === 'number' ? value.toFixed(1) : '—';
}

function situacaoColor(value?: string | null) {
  const normalized = value?.toUpperCase() ?? '';
  if (normalized.startsWith('APR')) return '#22c55e';
  if (normalized.startsWith('REC')) return '#f59e0b';
  if (normalized.startsWith('REP')) return '#ef4444';
  return '#64748b';
}

function NotaCard({ nota }: { nota: AlunoNota }) {
  return (
    <View style={styles.notaCard}>
      <View style={styles.notaHeader}>
        <Text style={styles.disciplina}>{nota.disciplina}</Text>
        <Text style={[styles.situacao, { color: situacaoColor(nota.situacao) }]}>
          {nota.situacao || '—'}
        </Text>
      </View>
      <View style={styles.gradeGrid}>
        <View style={styles.gradeCell}>
          <Text style={styles.gradeLabel}>1º Tri</Text>
          <Text style={styles.gradeValue}>{fmtNota(nota.trimestre1)}</Text>
        </View>
        <View style={styles.gradeCell}>
          <Text style={styles.gradeLabel}>2º Tri</Text>
          <Text style={styles.gradeValue}>{fmtNota(nota.trimestre2)}</Text>
        </View>
        <View style={styles.gradeCell}>
          <Text style={styles.gradeLabel}>3º Tri</Text>
          <Text style={styles.gradeValue}>{fmtNota(nota.trimestre3)}</Text>
        </View>
        <View style={styles.gradeCell}>
          <Text style={styles.gradeLabel}>Total</Text>
          <Text style={styles.gradeTotal}>{fmtNota(nota.total)}</Text>
        </View>
        <View style={styles.gradeCell}>
          <Text style={styles.gradeLabel}>Faltas</Text>
          <Text style={styles.gradeValue}>{nota.faltas ?? 0}</Text>
        </View>
      </View>
    </View>
  );
}

export default function BoletimScreen() {
  const role = useAuthStore((s) => s.user?.role);
  const isResponsavel = role === 'responsavel';
  const isAluno = role === 'aluno';

  const responsavelQuery = useQuery({
    queryKey: ['boletim', 'responsavel'],
    queryFn: () => familyApi.getMeuFilho().then((r) => r.data.aluno),
    enabled: isResponsavel,
  });

  const alunoQuery = useQuery({
    queryKey: ['boletim', 'aluno'],
    queryFn: () => familyApi.getMeuAluno().then((r) => r.data),
    enabled: isAluno,
  });

  const activeQuery = isResponsavel ? responsavelQuery : alunoQuery;
  const aluno: AlunoDetail | undefined = activeQuery.data;
  const isLoading = activeQuery.isLoading;
  const isError = activeQuery.isError;
  const isRefetching = activeQuery.isRefetching;

  const refetch = () => {
    activeQuery.refetch();
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
    >
      {isLoading && <ActivityIndicator color="#3b82f6" size="large" style={styles.loader} />}

      {isError && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>Não foi possível carregar o boletim.</Text>
        </View>
      )}

      {aluno && (
        <>
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>{aluno.nome}</Text>
            <Text style={styles.heroMeta}>
              {aluno.turma} · {aluno.turno} · Matrícula {aluno.matricula ?? '—'}
            </Text>
            <View style={styles.mediaBadge}>
              <Text style={styles.mediaLabel}>Média geral</Text>
              <Text style={styles.mediaValue}>{fmtNota(aluno.media)}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Notas por disciplina</Text>
          {aluno.notas.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>Nenhuma nota registrada.</Text>
            </View>
          ) : (
            aluno.notas.map((nota) => <NotaCard key={nota.id} nota={nota} />)
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 18, paddingBottom: 32 },
  loader: { marginTop: 40 },
  errorBox: { backgroundColor: '#7f1d1d', borderRadius: 14, padding: 16 },
  errorText: { color: '#fecaca', fontSize: 14 },
  hero: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
  },
  heroTitle: { color: '#f8fafc', fontSize: 20, fontWeight: '900' },
  heroMeta: { color: '#94a3b8', fontSize: 13, lineHeight: 20, marginTop: 6 },
  mediaBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#052e16',
    borderColor: '#166534',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  mediaLabel: { color: '#86efac', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  mediaValue: { color: '#bbf7d0', fontSize: 22, fontWeight: '900' },
  sectionTitle: { color: '#f8fafc', fontSize: 17, fontWeight: '900', marginBottom: 12, marginTop: 22 },
  notaCard: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    padding: 14,
  },
  notaHeader: { flexDirection: 'row', gap: 12, justifyContent: 'space-between', marginBottom: 12 },
  disciplina: { color: '#f8fafc', flex: 1, fontSize: 15, fontWeight: '800' },
  situacao: { fontSize: 12, fontWeight: '900' },
  gradeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gradeCell: {
    backgroundColor: '#0f172a',
    borderColor: '#334155',
    borderRadius: 12,
    borderWidth: 1,
    minWidth: '30%',
    padding: 10,
  },
  gradeLabel: { color: '#64748b', fontSize: 11, fontWeight: '800' },
  gradeValue: { color: '#e2e8f0', fontSize: 17, fontWeight: '800', marginTop: 3 },
  gradeTotal: { color: '#60a5fa', fontSize: 18, fontWeight: '900', marginTop: 3 },
  emptyBox: { backgroundColor: '#1e293b', borderRadius: 16, padding: 24 },
  emptyText: { color: '#64748b', textAlign: 'center' },
});
