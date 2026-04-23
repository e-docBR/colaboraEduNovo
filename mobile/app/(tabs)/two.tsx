/**
 * Recados tab — lista de comunicados/avisos da instituição.
 * Comunicados não lidos são destacados; toque abre o conteúdo completo.
 */
import { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { comunicadosApi, type Comunicado } from '../../lib/api';

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface ComunicadoModalProps {
  item: Comunicado | null;
  onClose: () => void;
}

function ComunicadoModal({ item, onClose }: ComunicadoModalProps) {
  if (!item) return null;
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle} numberOfLines={2}>{item.titulo}</Text>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
        </View>
        <Text style={styles.modalMeta}>
          {item.autor} · {formatDate(item.data_envio)}
        </Text>
        <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 40 }}>
          <Text style={styles.modalContent}>{item.conteudo}</Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

interface ItemProps {
  item: Comunicado;
  onPress: () => void;
}

function ComunicadoItem({ item, onPress }: ItemProps) {
  const isUnread = !item.is_read;
  return (
    <TouchableOpacity style={[styles.item, isUnread && styles.itemUnread]} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.itemLeft}>
        {isUnread && <View style={styles.dot} />}
      </View>
      <View style={styles.itemContent}>
        <Text style={[styles.itemTitle, isUnread && styles.itemTitleUnread]} numberOfLines={1}>
          {item.titulo}
        </Text>
        <Text style={styles.itemPreview} numberOfLines={2}>{item.conteudo}</Text>
        <Text style={styles.itemMeta}>{item.autor} · {formatDate(item.data_envio)}</Text>
      </View>
      {isUnread && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Novo</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function ComunicadosScreen() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Comunicado | null>(null);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['comunicados'],
    queryFn: () => comunicadosApi.list({ per_page: 50 }).then((r) => r.data),
  });

  const items = data?.items ?? [];
  const unreadCount = items.filter((c) => !c.is_read).length;

  const handleOpen = async (item: Comunicado) => {
    setSelected(item);
    if (!item.is_read) {
      await comunicadosApi.markRead(item.id).catch(() => null);
      // Optimistic update in cache
      queryClient.setQueryData<typeof data>(['comunicados'], (old) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((c) => (c.id === item.id ? { ...c, is_read: true } : c)),
        };
      });
    }
  };

  return (
    <View style={styles.container}>
      {/* Header bar */}
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>📢  Recados</Text>
        {unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{unreadCount} não lido{unreadCount > 1 ? 's' : ''}</Text>
          </View>
        )}
      </View>

      {isLoading && (
        <ActivityIndicator color="#3b82f6" size="large" style={{ marginTop: 40 }} />
      )}

      {isError && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>Não foi possível carregar os recados.</Text>
        </View>
      )}

      {!isLoading && (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <ComunicadoItem item={item} onPress={() => handleOpen(item)} />
          )}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={styles.emptyText}>Nenhum recado por enquanto.</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 32 }}
        />
      )}

      <ComunicadoModal item={selected} onClose={() => setSelected(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },

  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#f1f5f9' },
  unreadBadge: {
    backgroundColor: '#dc2626',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  unreadBadgeText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },

  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  itemUnread: { backgroundColor: '#0f1f38' },
  itemLeft: { width: 16, paddingTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3b82f6' },
  itemContent: { flex: 1, marginRight: 8 },
  itemTitle: { fontSize: 14, fontWeight: '500', color: '#94a3b8', marginBottom: 4 },
  itemTitleUnread: { color: '#f1f5f9', fontWeight: '700' },
  itemPreview: { fontSize: 13, color: '#475569', lineHeight: 18, marginBottom: 6 },
  itemMeta: { fontSize: 11, color: '#334155' },
  badge: {
    backgroundColor: '#1d4ed8',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  badgeText: { color: '#bfdbfe', fontSize: 11, fontWeight: '600' },

  separator: { height: 1, backgroundColor: '#1e293b', marginLeft: 36 },
  errorBox: { margin: 24, padding: 16, backgroundColor: '#7f1d1d', borderRadius: 12 },
  errorText: { color: '#fca5a5', fontSize: 14 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyText: { color: '#475569', fontSize: 15 },

  // Modal
  modalContainer: { flex: 1, backgroundColor: '#0f172a' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  modalTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#f1f5f9', marginRight: 12 },
  closeBtn: { padding: 6 },
  closeBtnText: { color: '#64748b', fontSize: 18, fontWeight: '700' },
  modalMeta: { paddingHorizontal: 20, paddingVertical: 10, fontSize: 12, color: '#475569' },
  modalBody: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },
  modalContent: { fontSize: 15, color: '#cbd5e1', lineHeight: 24 },
});
