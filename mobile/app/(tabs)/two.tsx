import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  comunicadosApi,
  familyApi,
  ocorrenciasApi,
  type Comunicado,
  type Ocorrencia,
  type ResponsavelComunicado,
  type ResponsavelOcorrencia,
} from '../../lib/api';
import { useAuthStore } from '../../lib/auth.store';

type Tab = 'comunicados' | 'ocorrencias';
type AnyComunicado = Comunicado | ResponsavelComunicado;
type AnyOcorrencia = Ocorrencia | ResponsavelOcorrencia;

function formatDate(iso?: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function isRead(item: AnyComunicado) {
  return 'lido' in item ? item.lido : Boolean(item.is_read);
}

function ComunicadoModal({ item, onClose }: { item: AnyComunicado | null; onClose: () => void }) {
  if (!item) return null;
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle} numberOfLines={2}>{item.titulo}</Text>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>Fechar</Text>
          </Pressable>
        </View>
        <Text style={styles.modalMeta}>{formatDate(item.data_envio)}</Text>
        <ScrollView contentContainerStyle={styles.modalBody}>
          <Text style={styles.modalContent}>{item.conteudo}</Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

function ComunicadoItem({ item, onPress }: { item: AnyComunicado; onPress: () => void }) {
  const unread = !isRead(item);
  return (
    <TouchableOpacity style={[styles.listItem, unread && styles.unreadItem]} onPress={onPress}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemTitle} numberOfLines={1}>{item.titulo}</Text>
        {unread && <Text style={styles.newBadge}>Novo</Text>}
      </View>
      <Text style={styles.itemText} numberOfLines={2}>{item.conteudo}</Text>
      <Text style={styles.itemDate}>{formatDate(item.data_envio)}</Text>
    </TouchableOpacity>
  );
}

function OcorrenciaItem({ item }: { item: AnyOcorrencia }) {
  return (
    <View style={styles.listItem}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemTitle}>{item.tipo}</Text>
        <Text style={[styles.statusBadge, item.resolvida ? styles.resolved : styles.pending]}>
          {item.resolvida ? 'Resolvida' : 'Aberta'}
        </Text>
      </View>
      {item.gravidade ? <Text style={styles.itemMeta}>Gravidade: {item.gravidade}</Text> : null}
      <Text style={styles.itemText}>{item.descricao}</Text>
      {'observacao_pais' in item && item.observacao_pais ? (
        <Text style={styles.parentNote}>Para a família: {item.observacao_pais}</Text>
      ) : null}
      <Text style={styles.itemDate}>{formatDate(item.data_registro)}</Text>
    </View>
  );
}

export default function RegistrosScreen() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  const isResponsavel = role === 'responsavel';
  const isAluno = role === 'aluno';
  const [tab, setTab] = useState<Tab>('comunicados');
  const [selectedComunicado, setSelectedComunicado] = useState<AnyComunicado | null>(null);

  const responsavelQuery = useQuery({
    queryKey: ['registros', 'responsavel'],
    queryFn: () => familyApi.getMeuFilho().then((r) => r.data),
    enabled: isResponsavel,
  });

  const alunoOcorrenciasQuery = useQuery({
    queryKey: ['registros', 'aluno-ocorrencias', user?.aluno_id],
    queryFn: () => ocorrenciasApi.listByAluno(Number(user?.aluno_id)).then((r) => r.data.items),
    enabled: isAluno && !!user?.aluno_id,
  });

  const alunoComunicadosQuery = useQuery({
    queryKey: ['registros', 'aluno-comunicados'],
    queryFn: () => comunicadosApi.list({ per_page: 50 }).then((r) => r.data.items),
    enabled: isAluno,
  });

  const comunicados: AnyComunicado[] =
    isResponsavel ? responsavelQuery.data?.comunicados ?? [] : alunoComunicadosQuery.data ?? [];
  const ocorrencias: AnyOcorrencia[] =
    isResponsavel ? responsavelQuery.data?.ocorrencias ?? [] : alunoOcorrenciasQuery.data ?? [];

  const activeQueries = isResponsavel
    ? [responsavelQuery]
    : [alunoOcorrenciasQuery, alunoComunicadosQuery];
  const isLoading = activeQueries.some((query) => query.isLoading);
  const isError = activeQueries.some((query) => query.isError);
  const isRefetching = activeQueries.some((query) => query.isRefetching);

  const refetch = () => {
    activeQueries.forEach((query) => query.refetch());
  };

  const handleOpenComunicado = async (item: AnyComunicado) => {
    setSelectedComunicado(item);
    if (!isRead(item)) {
      await comunicadosApi.markRead(item.id).catch(() => null);
      queryClient.invalidateQueries({ queryKey: ['registros'] });
      queryClient.invalidateQueries({ queryKey: ['family-home'] });
    }
  };

  const unreadCount = comunicados.filter((item) => !isRead(item)).length;

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'comunicados' && styles.tabButtonActive]}
          onPress={() => setTab('comunicados')}
        >
          <Text style={[styles.tabText, tab === 'comunicados' && styles.tabTextActive]}>
            Recados{unreadCount > 0 ? ` (${unreadCount})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'ocorrencias' && styles.tabButtonActive]}
          onPress={() => setTab('ocorrencias')}
        >
          <Text style={[styles.tabText, tab === 'ocorrencias' && styles.tabTextActive]}>
            Ocorrências
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {isLoading && <ActivityIndicator color="#3b82f6" size="large" style={styles.loader} />}
        {isError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>Não foi possível carregar os registros.</Text>
          </View>
        )}

        {!isLoading && tab === 'comunicados' && (
          comunicados.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum recado por enquanto.</Text>
          ) : (
            comunicados.map((item) => (
              <ComunicadoItem key={item.id} item={item} onPress={() => handleOpenComunicado(item)} />
            ))
          )
        )}

        {!isLoading && tab === 'ocorrencias' && (
          ocorrencias.length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma ocorrência registrada.</Text>
          ) : (
            ocorrencias.map((item) => <OcorrenciaItem key={item.id} item={item} />)
          )
        )}
      </ScrollView>

      <ComunicadoModal item={selectedComunicado} onClose={() => setSelectedComunicado(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  tabs: { flexDirection: 'row', gap: 10, padding: 16 },
  tabButton: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 12,
  },
  tabButtonActive: { backgroundColor: '#1d4ed8', borderColor: '#3b82f6' },
  tabText: { color: '#94a3b8', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  tabTextActive: { color: '#ffffff' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  loader: { marginTop: 40 },
  errorBox: { backgroundColor: '#7f1d1d', borderRadius: 14, padding: 16 },
  errorText: { color: '#fecaca' },
  listItem: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    padding: 15,
  },
  unreadItem: { borderColor: '#3b82f6' },
  itemHeader: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  itemTitle: { color: '#f8fafc', flex: 1, fontSize: 15, fontWeight: '900' },
  itemText: { color: '#cbd5e1', fontSize: 14, lineHeight: 21, marginTop: 8 },
  itemMeta: { color: '#93c5fd', fontSize: 12, fontWeight: '700', marginTop: 8 },
  itemDate: { color: '#64748b', fontSize: 12, marginTop: 10 },
  newBadge: {
    backgroundColor: '#2563eb',
    borderRadius: 9,
    color: '#dbeafe',
    fontSize: 11,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusBadge: {
    borderRadius: 9,
    fontSize: 11,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  resolved: { backgroundColor: '#14532d', color: '#bbf7d0' },
  pending: { backgroundColor: '#78350f', color: '#fde68a' },
  parentNote: { color: '#bfdbfe', fontSize: 13, lineHeight: 20, marginTop: 8 },
  emptyText: { color: '#64748b', fontSize: 15, marginTop: 40, textAlign: 'center' },
  modalContainer: { flex: 1, backgroundColor: '#0f172a' },
  modalHeader: {
    alignItems: 'flex-start',
    borderBottomColor: '#1e293b',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    padding: 20,
  },
  modalTitle: { color: '#f8fafc', flex: 1, fontSize: 19, fontWeight: '900' },
  closeBtn: { paddingVertical: 3 },
  closeBtnText: { color: '#93c5fd', fontSize: 14, fontWeight: '800' },
  modalMeta: { color: '#64748b', fontSize: 12, paddingHorizontal: 20, paddingTop: 12 },
  modalBody: { padding: 20, paddingBottom: 40 },
  modalContent: { color: '#cbd5e1', fontSize: 16, lineHeight: 25 },
});
