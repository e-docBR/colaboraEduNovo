/**
 * Tabs layout for the ColaboraEdu family app.
 * Tabs: Início, Boletim, Registros, Perfil.
 */
import { useEffect } from 'react';
import { Tabs, router } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuthStore } from '../../lib/auth.store';

// Minimal inline icon component using emoji for zero-dependency approach
function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  const { Text } = require('react-native');
  return (
    <Text style={{ fontSize: focused ? 26 : 22, opacity: focused ? 1 : 0.5 }}>
      {emoji}
    </Text>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const signOut = useAuthStore((s) => s.signOut);
  const user = useAuthStore((s) => s.user);

  const isDark = colorScheme === 'dark';
  const tabBarBg = isDark ? '#0f172a' : '#ffffff';
  const tabBarActiveTint = '#3b82f6';
  const tabBarInactiveTint = isDark ? '#475569' : '#94a3b8';

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  useEffect(() => {
    if (user && !['aluno', 'responsavel'].includes(user.role)) {
      signOut().then(() => router.replace('/(auth)/login'));
    }
  }, [signOut, user]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: tabBarActiveTint,
        tabBarInactiveTintColor: tabBarInactiveTint,
        tabBarStyle: {
          backgroundColor: tabBarBg,
          borderTopColor: isDark ? '#1e293b' : '#e2e8f0',
          borderTopWidth: 1,
          paddingBottom: 6,
          paddingTop: 6,
          height: 64,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: isDark ? '#0f172a' : '#ffffff',
        },
        headerTintColor: isDark ? '#f1f5f9' : '#0f172a',
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 18,
        },
      }}
    >
      {/* Início */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          headerTitle: 'Portal da Família',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
          headerRight: () => (
            <TouchableOpacity onPress={handleSignOut} style={{ marginRight: 16 }}>
              {(() => {
                const { Text } = require('react-native');
                return <Text style={{ fontSize: 20 }}>🚪</Text>;
              })()}
            </TouchableOpacity>
          ),
        }}
      />

      {/* Boletim */}
      <Tabs.Screen
        name="alunos"
        options={{
          title: 'Boletim',
          headerTitle: 'Boletim',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📊" focused={focused} />,
        }}
      />

      <Tabs.Screen
        name="chat"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="two"
        options={{
          title: 'Registros',
          headerTitle: 'Recados e Ocorrências',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📌" focused={focused} />,
        }}
      />

      {/* Perfil */}
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          headerTitle: 'Meu Perfil',
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
        }}
      />

    </Tabs>
  );
}
