/**
 * Aluno detail screen — exibe notas por disciplina e ocorrências.
 * Acessado ao tocar em um aluno na tab Alunos.
 */
import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { alunoDetailApi, ocorrenciasApi, type AlunoNota, type Ocorrencia } from '../../lib/api';

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtNota(v?: number | null) {
  if (v == null) return '—';
  return v.toFixed(1);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function mediaColor(media?: number | null) {
  if (media == null) return '#64748b';
  if (media < 50) return '#ef4444';
  if (media < 60) return '#f59e0b';
  return '#22c55e';
}

function gravidadeColor(g?: string) {
  if (!g) return '#64748b';
  if (g === 'GRAVÍSSIMA') return '#ef4444';
  if (g === 'GRAVE') return '#f59e0b';
  return '#94a3b8';
}

// ── sub-components ────────────────────────────────────────────────────────────

function NotaRow({ nota }: { nota: AlunoNota }) {
  return (
    <View style={styles.notaRow}>
      <Text style={styles.notaDisciplina} numberOfLines={1}>{nota.disciplina}</Text>
      <View style={styles.notaCols}>
        <Text style={styles.notaCell}>{fmtNota(nota.trimestre1)}</Text>
        <Text style={styles.notaCell}>{fmtNota(nota.trimestre2)}</Text>
        <Text style={styles.notaCell}>{fmtNota(nota.trimestre3)}</Text>
        <Text style={[styles.notaCell, styles.notaTotal, { color: mediaColor(nota.total) }]}>
          {fmtNota(nota.total)}
        </Text>
        <Text style={styles.notaCell}>{nota.faltas ?? '—'}</Text>
      </View>
    </View>
  );
}

function OcorrenciaCard({ o }: { o: Ocorrencia }) {
  return (
    <View style={styles.ocorrCard}>
      <View style={styles.ocorrHeader}>
        <View style={[styles.gravidadeBadge, { borderColor: gravidadeColor(o.gravidade) }]}>
          <Text style={[styles.gravidadeText, { color: gravidadeColor(o.gravidade) }]}>
            {o.gravidade ?? 'LEVE'}
          </Text>
        </View>
        <Text style={styles.ocorrDate}>{fmtDate(o.data_registro)}</Text>
        {o.resolvida && (
          <View style={styles.resolvidaBadge}>
            <Text style={styles.resolvidaText}>✓ Resolvida</Text>
          </View>
        )}
      </View>
      <Text style={styles.ocorrTipo}>{o.tipo}</Text>
      <Text style={styles.ocorrDesc}>{o.descricao}</Text>
      {o.acao_tomada ? (
        <Text style={styles.ocorrAcao}>Ação: {o.acao_tomada}</Text>
      ) : null}
      <Text style={styles.ocorrAutor}>Registrado por: {o.autor_nome}</Text>
    </View>
  );
}

// ── main screen ───────────────────────────────────────────────────────────────

export default function AlunoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<'notas' | 'ocorrencias'>('notas');

  const alunoId = Number(id);

  const {
    data: aluno,
    isLoading: alunoLoading,
    isError: alunoError,
    refetch: refetchAluno,
    isRefetching,
  } = useQuery({
    queryKey: ['aluno', alunoId],
    queryFn: () => alunoDetailApi.get(alunoId).then((r) => r.data),
    enabled: !!alunoId,
  });

  const { data: ocorrencias, isLoading: ocorrLoading, refetch: refetchOcorr } = useQuery({
    queryKey: ['ocorrencias', alunoId],
    queryFn: () => ocorrenciasApi.listByAluno(alunoId).then((r) => r.data),
    enabled: !!alunoId && tab === 'ocorrencias',
  });

  const handleRefresh = () => {
    refetchAluno();
    if (tab === 'ocorrencias') refetchOcorr();
  };

  if (alunoLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#3b82f6" size="large" />
      </View>
    );
  }

  if (alunoError || !aluno) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Não foi possível carregar o aluno.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>← Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const initials = aluno.nome
    .split(' ')
    .slice(0, 2)
    .map((n: string) => n[0])
    .join('')
    .toUpperCase();

  const media = aluno.media;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} />}
    >
      {/* Back */}
      <TouchableOpacity style={styles.backRow} onPress={() => router.back()}>
        <Text style={styles.backText}>← Alunos</Text>
      </TouchableOpacity>

      {/* Hero card */}
      <View style={styles.heroCard}>
        <View style={[styles.avatar, { backgroundColor: media != null && media < 50 ? '#7f1d1d' : '#1d4ed8' }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.heroName}>{aluno.nome}</Text>
        <Text style={styles.heroMeta}>
          {aluno.turma} · {aluno.turno}
        </Text>
        {aluno.matricula ? <Text style={styles.heroMatricula}>Mat. {aluno.matricula}</Text> : null}

        {/* Risk + Media badges */}
        <View style={styles.heroBadges}>
          {media != null && (
            <View style={[styles.mediaBadge, { backgroundColor: mediaColor(media) + '22', borderColor: mediaColor(media) }]}>
              <Text style={[styles.mediaBadgeText, { color: mediaColor(media) }]}>
                Média {media.toFixed(1)}
              </Text>
            </View>
          )}
          {aluno.faltas != null && (
            <View style={styles.faltasBadge}>
              <Text style={styles.faltasBadgeText}>⚠ {aluno.faltas} faltas</Text>
            </View>
          )}
          {aluno.risk_status === 'ALTO' && (
            <View style={styles.riskBadge}>
              <Text style={styles.riskBadgeText}>🔴 Alto Risco</Text>
            </View>
          )}
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'notas' && styles.tabBtnActive]}
          onPress={() => setTab('notas')}
        >
          <Text style={[styles.tabBtnText, tab === 'notas' && styles.tabBtnTextActive]}>
            📊 Notas
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'ocorrencias' && styles.tabBtnActive]}
          onPress={() => setTab('ocorrencias')}
        >
          <Text style={[styles.tabBtnText, tab === 'ocorrencias' && styles.tabBtnTextActive]}>
            📋 Ocorrências
          </Text>
        </TouchableOpacity>
      </View>

      {/* Notas tab */}
      {tab === 'notas' && (
        <View style={styles.section}>
          {aluno.notas.length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma nota registrada.</Text>
          ) : (
            <>
              {/* Header */}
              <View style={styles.notaHeaderRow}>
                <Text style={styles.notaDisciplina}>Disciplina</Text>
                <View style={styles.notaCols}>
                  {['T1', 'T2', 'T3', 'Média', 'Faltas'].map((h) => (
                    <Text key={h} style={[styles.notaCell, styles.notaHeaderCell]}>{h}</Text>
                  ))}
                </View>
              </View>
              {aluno.notas.map((nota: AlunoNota) => (
                <NotaRow key={nota.id} nota={nota} />
              ))}
            </>
          )}
        </View>
      )}

      {/* Ocorrências tab */}
      {tab === 'ocorrencias' && (
        <View style={styles.section}>
          {ocorrLoading ? (
            <ActivityIndicator color="#3b82f6" style={{ marginTop: 20 }} />
          ) : !ocorrencias || ocorrencias.length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma ocorrência registrada.</Text>
          ) : (
            ocorrencias.map((o: Ocorrencia) => <OcorrenciaCard key={o.id} o={o} />)
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' },
  errorText: { color: '#fca5a5', fontSize: 15, marginBottom: 16 },
  backBtn: { padding: 12 },
  backBtnText: { color: '#3b82f6', fontSize: 15 },

  backRow: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  backText: { color: '#3b82f6', fontSize: 14, fontWeight: '600' },

  heroCard: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { color: '#ffffff', fontWeight: '700', fontSize: 26 },
  heroName: { fontSize: 20, fontWeight: '700', color: '#f1f5f9', marginBottom: 4 },
  heroMeta: { fontSize: 14, color: '#64748b', marginBottom: 2 },
  heroMatricula: { fontSize: 12, color: '#475569', marginBottom: 10 },
  heroBadges: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 6 },
  mediaBadge: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  mediaBadgeText: { fontSize: 12, fontWeight: '700' },
  faltasBadge: { backgroundColor: '#451a03', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  faltasBadgeText: { color: '#fbbf24', fontSize: 12, fontWeight: '600' },
  riskBadge: { backgroundColor: '#450a0a', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  riskBadgeText: { color: '#fca5a5', fontSize: 12, fontWeight: '600' },

  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  tabBtn: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: '#3b82f6' },
  tabBtnText: { fontSize: 14, color: '#475569', fontWeight: '600' },
  tabBtnTextActive: { color: '#3b82f6' },

  section: { padding: 16, paddingBottom: 40 },

  notaHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    marginBottom: 4,
  },
  notaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#0f1f38',
  },
  notaDisciplina: { flex: 1, fontSize: 13, color: '#94a3b8', paddingRight: 8 },
  notaCols: { flexDirection: 'row' },
  notaCell: { width: 44, textAlign: 'center', fontSize: 12, color: '#64748b' },
  notaHeaderCell: { color: '#475569', fontWeight: '700', fontSize: 11 },
  notaTotal: { fontWeight: '700', fontSize: 13 },

  ocorrCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  ocorrHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  gravidadeBadge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  gravidadeText: { fontSize: 11, fontWeight: '700' },
  ocorrDate: { fontSize: 12, color: '#475569' },
  resolvidaBadge: { marginLeft: 'auto', backgroundColor: '#14532d', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  resolvidaText: { color: '#86efac', fontSize: 11, fontWeight: '600' },
  ocorrTipo: { fontSize: 13, fontWeight: '700', color: '#cbd5e1', marginBottom: 4 },
  ocorrDesc: { fontSize: 13, color: '#94a3b8', lineHeight: 18, marginBottom: 6 },
  ocorrAcao: { fontSize: 12, color: '#60a5fa', marginBottom: 4, fontStyle: 'italic' },
  ocorrAutor: { fontSize: 11, color: '#334155', marginTop: 2 },

  emptyText: { color: '#475569', fontSize: 14, textAlign: 'center', marginTop: 40 },
});
