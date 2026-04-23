/**
 * Alunos tab — list of students with server-side pagination and search.
 */
import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { alunosApi, type Aluno } from '../../lib/api';

const PAGE_SIZE = 20;

function AlunoItem({ item }: { item: Aluno }) {
  const initials = item.nome
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  return (
    <TouchableOpacity
      style={styles.item}
      activeOpacity={0.7}
      onPress={() => router.push(`/aluno/${item.id}`)}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.nome}</Text>
        <Text style={styles.itemMeta}>
          {item.turma} · {item.turno}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

export default function AlunosScreen() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search input to avoid firing a request on every keystroke
  const handleSearch = useCallback((text: string) => {
    setSearch(text);
    clearTimeout((handleSearch as any)._timer);
    (handleSearch as any)._timer = setTimeout(() => setDebouncedSearch(text), 400);
  }, []);

  const {
    data,
    isLoading,
    isError,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['alunos', debouncedSearch],
    queryFn: ({ pageParam = 0 }) =>
      alunosApi
        .list({ offset: pageParam as number, limit: PAGE_SIZE, search: debouncedSearch || undefined })
        .then((r) => r.data),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length * PAGE_SIZE : undefined,
    initialPageParam: 0,
  });

  const allAlunos: Aluno[] = data?.pages.flat() ?? [];

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchWrapper}>
        <TextInput
          style={styles.search}
          placeholder="🔎  Buscar aluno..."
          placeholderTextColor="#475569"
          value={search}
          onChangeText={handleSearch}
        />
      </View>

      {isLoading && (
        <ActivityIndicator color="#3b82f6" size="large" style={{ marginTop: 40 }} />
      )}

      {isError && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>Erro ao carregar alunos.</Text>
        </View>
      )}

      {!isLoading && (
        <FlatList
          data={allAlunos}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <AlunoItem item={item} />}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            isFetchingNextPage
              ? <ActivityIndicator color="#3b82f6" style={{ marginVertical: 16 }} />
              : null
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={styles.emptyText}>Nenhum aluno encontrado.</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 32 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  searchWrapper: { padding: 16 },
  search: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#334155',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1d4ed8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: { color: '#ffffff', fontWeight: '700', fontSize: 16 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '600', color: '#f1f5f9' },
  itemMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
  chevron: { color: '#334155', fontSize: 22, fontWeight: '300', marginLeft: 4 },
  separator: { height: 1, backgroundColor: '#1e293b', marginLeft: 78 },
  errorBox: { margin: 24, padding: 16, backgroundColor: '#7f1d1d', borderRadius: 12 },
  errorText: { color: '#fca5a5', fontSize: 14 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyText: { color: '#475569', fontSize: 15 },
});
