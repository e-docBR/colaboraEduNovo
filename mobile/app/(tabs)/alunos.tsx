import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
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

function notaColor(value?: number | null) {
  if (typeof value !== 'number') return '#0f172a';
  return value >= 18 ? '#2e7d32' : '#ef6c00';
}

function BoletimRow({ nota }: { nota: AlunoNota }) {
  return (
    <View style={styles.tableRow}>
      <Text style={[styles.tableCell, styles.disciplinaCell]} numberOfLines={2}>
        {nota.disciplina}
      </Text>
      <Text style={[styles.tableCell, styles.numberCell, { color: notaColor(nota.trimestre1) }]}>
        {fmtNota(nota.trimestre1)}
      </Text>
      <Text style={[styles.tableCell, styles.numberCell]}>{fmtNota(nota.trimestre2)}</Text>
      <Text style={[styles.tableCell, styles.numberCell]}>{fmtNota(nota.trimestre3)}</Text>
      <Text style={[styles.tableCell, styles.numberCell, styles.totalCell, { color: notaColor(nota.total) }]}>
        {fmtNota(nota.total)}
      </Text>
      <Text style={[styles.tableCell, styles.faltasCell]}>{nota.faltas ?? 0}</Text>
      <View style={[styles.tableCell, styles.situacaoCell]}>
        <Text style={[styles.situacaoBadge, { color: situacaoColor(nota.situacao) }]}>
          {nota.situacao || '—'}
        </Text>
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

  const sortedNotas = [...(aluno?.notas ?? [])].sort((a, b) => a.disciplina.localeCompare(b.disciplina));

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
          <View style={styles.summaryCard}>
            <Text style={styles.studentName}>{aluno.nome}</Text>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Matrícula</Text>
                <Text style={styles.summaryValue}>{aluno.matricula ?? '—'}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Turma / Turno</Text>
                <Text style={styles.summaryValue}>{aluno.turma} • {aluno.turno}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Média geral</Text>
                <Text style={styles.mediaValue}>{fmtNota(aluno.media)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.webTabs}>
            <View style={[styles.webTab, styles.webTabActive]}>
              <MaterialIcons name="star" size={22} color="#0b63f6" />
              <Text style={[styles.webTabText, styles.webTabTextActive]}>Boletim</Text>
            </View>
            <TouchableOpacity style={styles.webTab} onPress={() => router.push('/(tabs)/two')}>
              <MaterialIcons name="warning" size={22} color="#64748b" />
              <Text style={styles.webTabText}>Minhas Ocorrências</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.webTab} onPress={() => router.push('/(tabs)/two')}>
              <MaterialIcons name="notifications" size={22} color="#64748b" />
              <Text style={styles.webTabText}>Meus Recados</Text>
            </TouchableOpacity>
          </View>

          {sortedNotas.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>Nenhuma nota registrada.</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tableScroller}>
              <View style={styles.tableCard}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderText, styles.disciplinaCell]}>Disciplina</Text>
                  <Text style={[styles.tableHeaderText, styles.numberCell]}>1º Tri</Text>
                  <Text style={[styles.tableHeaderText, styles.numberCell]}>2º Tri</Text>
                  <Text style={[styles.tableHeaderText, styles.numberCell]}>3º Tri</Text>
                  <Text style={[styles.tableHeaderText, styles.numberCell]}>Total</Text>
                  <Text style={[styles.tableHeaderText, styles.faltasCell]}>Faltas</Text>
                  <Text style={[styles.tableHeaderText, styles.situacaoCell]}>Situação</Text>
                </View>
                {sortedNotas.map((nota) => <BoletimRow key={nota.id} nota={nota} />)}
              </View>
            </ScrollView>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f7fb' },
  content: { padding: 14, paddingBottom: 32 },
  loader: { marginTop: 40 },
  errorBox: { backgroundColor: '#fee2e2', borderRadius: 8, marginBottom: 12, padding: 14 },
  errorText: { color: '#991b1b', fontSize: 14 },
  summaryCard: {
    backgroundColor: '#ffffff',
    borderColor: '#dbe4f0',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 22,
    padding: 18,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  studentName: { color: '#020617', fontSize: 22, fontWeight: '900', marginBottom: 14 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 },
  summaryItem: { minWidth: 110, paddingRight: 16 },
  summaryDivider: { backgroundColor: '#dbe4f0', height: 60, marginRight: 16, width: 1 },
  summaryLabel: { color: '#64748b', fontSize: 14, marginBottom: 4 },
  summaryValue: { color: '#020617', fontSize: 16, fontWeight: '800' },
  mediaValue: { color: '#2e7d32', fontSize: 18, fontWeight: '900' },
  webTabs: {
    borderBottomColor: '#dbe4f0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 4,
    marginBottom: 16,
  },
  webTab: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
    minHeight: 50,
    paddingHorizontal: 12,
  },
  webTabActive: { borderBottomColor: '#0b63f6', borderBottomWidth: 3 },
  webTabText: { color: '#64748b', fontSize: 13, fontWeight: '800' },
  webTabTextActive: { color: '#0b63f6' },
  tableScroller: { marginBottom: 8 },
  tableCard: {
    backgroundColor: '#ffffff',
    borderColor: '#dbe4f0',
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 780,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  tableHeader: {
    alignItems: 'center',
    borderBottomColor: '#eef2f7',
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 58,
  },
  tableHeaderText: { color: '#020617', fontSize: 14, fontWeight: '900' },
  tableRow: {
    alignItems: 'center',
    borderBottomColor: '#f1f5f9',
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 64,
  },
  tableCell: { color: '#020617', fontSize: 15, paddingHorizontal: 12 },
  disciplinaCell: { width: 260 },
  numberCell: { fontWeight: '800', textAlign: 'center', width: 90 },
  totalCell: { fontWeight: '900' },
  faltasCell: { textAlign: 'center', width: 80 },
  situacaoCell: { alignItems: 'center', width: 110 },
  situacaoBadge: {
    borderColor: '#cbd5e1',
    borderRadius: 7,
    borderWidth: 1,
    fontSize: 14,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  emptyBox: { backgroundColor: '#ffffff', borderRadius: 8, padding: 24 },
  emptyText: { color: '#64748b', textAlign: 'center' },
});
