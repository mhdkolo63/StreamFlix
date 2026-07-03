import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  User,
  Settings,
  Heart,
  Clock,
  Film,
  Lock,
  LogOut,
  ChevronRight,
  Shield,
  Bell,
  HelpCircle,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/Button';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, profile, isAdmin, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [stats, setStats] = useState({ watched: 0, favorites: 0, watchTime: 0 });
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchStats = useCallback(async () => {
    if (!user) return;

    try {
      const { count: watchedCount } = await supabase
        .from('watch_history')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      const { count: favCount } = await supabase
        .from('favorites')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      const { data: historyData } = await supabase
        .from('watch_history')
        .select('progress')
        .eq('user_id', user.id);

      const totalSeconds = (historyData || []).reduce((sum, item) => sum + (item.progress || 0), 0);
      const watchTimeHours = Math.floor(totalSeconds / 3600);

      setStats({
        watched: watchedCount || 0,
        favorites: favCount || 0,
        watchTime: watchTimeHours,
      });

      const { count: unread } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      setUnreadCount(unread || 0);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, [user]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Real-time notification count
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('profile-notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchStats]);

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setSigningOut(true);
            try {
              await signOut();
              router.replace('/auth/login');
            } catch (error) {
              console.error('Sign out error:', error);
              setSigningOut(false);
            }
          },
        },
      ]
    );
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
        </View>
        <View style={styles.guestContainer}>
          <User size={64} color={Colors.text.muted} />
          <Text style={styles.guestTitle}>Welcome to StreamFlix</Text>
          <Text style={styles.guestSubtitle}>
            Sign in to access your profile, favorites, and watch history
          </Text>
          <Button
            title="Sign In"
            onPress={() => router.push('/auth/login')}
            style={styles.authButton}
          />
          <Button
            title="Create Account"
            onPress={() => router.push('/auth/register')}
            variant="outline"
            style={styles.authButton}
          />
          <Button
            title="Sign in as Admin"
            onPress={() => router.push('/admin/login')}
            variant="outline"
            icon={<Shield size={18} color={Colors.primary} />}
            style={styles.adminLoginButton}
          />
        </View>
      </View>
    );
  }

  const statItems = [
    { icon: Film, label: 'Watched', value: stats.watched.toString() },
    { icon: Heart, label: 'Favorites', value: stats.favorites.toString() },
    { icon: Clock, label: 'Watch Time', value: `${stats.watchTime}h` },
  ];

  const menuSections = [
    {
      title: 'Account',
      items: [
        { icon: User, label: 'Edit Profile', onPress: () => router.push('/profile/edit') },
        { icon: Lock, label: 'Change Password', onPress: () => router.push('/auth/change-password') },
        {
          icon: Bell,
          label: 'Notifications',
          badge: unreadCount,
          onPress: () => router.push('/notifications'),
        },
      ],
    },
    {
      title: 'Support',
      items: [
        { icon: HelpCircle, label: 'Help Center', onPress: () => router.push('/help') },
        { icon: Shield, label: 'Privacy Policy', onPress: () => router.push('/privacy') },
      ],
    },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
      </View>

      <View style={styles.profileCard}>
        <View style={styles.avatarContainer}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <User size={32} color={Colors.text.primary} />
            </View>
          )}
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.userName}>{profile?.full_name || 'User'}</Text>
          <Text style={styles.userEmail}>{profile?.email}</Text>
          {profile?.username && (
            <Text style={styles.userUsername}>@{profile.username}</Text>
          )}
          {isAdmin && (
            <View style={styles.adminBadge}>
              <Shield size={12} color={Colors.text.primary} />
              <Text style={styles.adminText}>Admin</Text>
            </View>
          )}
        </View>
      </View>

      {isAdmin && (
        <TouchableOpacity
          style={styles.adminCard}
          onPress={() => router.push('/admin')}
        >
          <Shield size={20} color={Colors.primary} />
          <Text style={styles.adminCardText}>Admin Dashboard</Text>
          <ChevronRight size={20} color={Colors.text.muted} />
        </TouchableOpacity>
      )}

      <View style={styles.statsContainer}>
        {statItems.map((stat, index) => (
          <View key={index} style={styles.statItem}>
            <stat.icon size={20} color={Colors.text.secondary} />
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {menuSections.map((section, sectionIndex) => (
        <View key={sectionIndex} style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>{section.title}</Text>
          <View style={styles.menuCard}>
            {section.items.map((item: any, itemIndex: number) => (
              <TouchableOpacity
                key={itemIndex}
                style={[
                  styles.menuItem,
                  itemIndex < section.items.length - 1 && styles.menuItemBorder,
                ]}
                onPress={item.onPress}
              >
                <View style={styles.menuItemLeft}>
                  <item.icon size={20} color={Colors.text.secondary} />
                  <Text style={styles.menuItemLabel}>{item.label}</Text>
                  {item.badge > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.badge}</Text>
                    </View>
                  )}
                </View>
                <ChevronRight size={20} color={Colors.text.muted} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      {!isAdmin && (
        <TouchableOpacity
          style={styles.adminSignInButton}
          onPress={() => router.push('/admin/login')}
        >
          <Shield size={20} color={Colors.primary} />
          <Text style={styles.adminSignInText}>Sign in as Admin</Text>
          <ChevronRight size={20} color={Colors.text.muted} />
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.signOutButton}
        onPress={handleSignOut}
        disabled={signingOut}
      >
        <LogOut size={20} color={Colors.status.error} />
        <Text style={styles.signOutText}>
          {signingOut ? 'Signing out...' : 'Sign Out'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.version}>StreamFlix v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.md },
  title: { fontSize: FontSizes.xxl, fontWeight: FontWeights.bold, color: Colors.text.primary },
  guestContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xxl },
  guestTitle: { fontSize: FontSizes.xl, fontWeight: FontWeights.semibold, color: Colors.text.primary, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  guestSubtitle: { fontSize: FontSizes.md, color: Colors.text.secondary, textAlign: 'center', marginBottom: Spacing.lg },
  authButton: { width: '100%', marginBottom: Spacing.sm },
  adminLoginButton: { width: '100%', marginTop: Spacing.md, borderColor: Colors.primary },
  profileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, marginHorizontal: Spacing.lg, padding: Spacing.lg, borderRadius: BorderRadius.xl, marginBottom: Spacing.md },
  avatarContainer: { marginRight: Spacing.lg },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  avatarPlaceholder: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  profileInfo: { flex: 1 },
  userName: { fontSize: FontSizes.xl, fontWeight: FontWeights.semibold, color: Colors.text.primary, marginBottom: Spacing.xs },
  userEmail: { fontSize: FontSizes.md, color: Colors.text.secondary, marginBottom: Spacing.xs },
  userUsername: { fontSize: FontSizes.sm, color: Colors.text.muted, marginBottom: Spacing.xs },
  adminBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.sm, gap: Spacing.xs, alignSelf: 'flex-start' },
  adminText: { fontSize: FontSizes.xs, fontWeight: FontWeights.semibold, color: Colors.text.primary },
  adminCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, marginHorizontal: Spacing.lg, padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.lg, gap: Spacing.md },
  adminCardText: { flex: 1, fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.text.primary },
  adminSignInButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, marginHorizontal: Spacing.lg, padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.lg, gap: Spacing.md, borderWidth: 1, borderColor: Colors.primary },
  adminSignInText: { flex: 1, fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.primary },
  statsContainer: { flexDirection: 'row', marginHorizontal: Spacing.lg, marginBottom: Spacing.lg },
  statItem: { flex: 1, alignItems: 'center', backgroundColor: Colors.card, paddingVertical: Spacing.lg, borderRadius: BorderRadius.md, marginHorizontal: Spacing.xs },
  statValue: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold, color: Colors.text.primary, marginTop: Spacing.sm, marginBottom: Spacing.xs },
  statLabel: { fontSize: FontSizes.sm, color: Colors.text.secondary },
  menuSection: { marginBottom: Spacing.lg },
  menuSectionTitle: { fontSize: FontSizes.sm, fontWeight: FontWeights.medium, color: Colors.text.muted, paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm, textTransform: 'uppercase' },
  menuCard: { backgroundColor: Colors.card, marginHorizontal: Spacing.lg, borderRadius: BorderRadius.md, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  menuItemLabel: { fontSize: FontSizes.md, color: Colors.text.primary },
  badge: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full, minWidth: 20, alignItems: 'center' },
  badgeText: { fontSize: FontSizes.xs, fontWeight: FontWeights.bold, color: Colors.text.primary },
  signOutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.card, marginHorizontal: Spacing.lg, marginVertical: Spacing.xl, padding: Spacing.md, borderRadius: BorderRadius.md, gap: Spacing.sm },
  signOutText: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.status.error },
  version: { fontSize: FontSizes.sm, color: Colors.text.muted, textAlign: 'center', marginBottom: Spacing.xxl },
});
