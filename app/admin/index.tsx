import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Film,
  Users,
  Eye,
  CloudUpload,
  Clapperboard,
  Tag,
  ChartBar,
  Settings,
  Star,
  LogOut,
  ChevronRight,
  AlertCircle,
} from 'lucide-react-native';
import { supabase, Video } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingScreen } from '@/components/Loading';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

interface DashboardStats {
  totalVideos: number;
  publishedVideos: number;
  totalUsers: number;
  totalViews: number;
  recentVideos: Video[];
  featuredVideos: Video[];
}

export default function AdminDashboard() {
  const router = useRouter();
  const { user, profile, isAdmin, loading: authLoading, signOut } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const [
        videosCount,
        publishedCount,
        usersCount,
        viewsCount,
        recentVideosData,
        featuredVideosData,
      ] = await Promise.all([
        supabase.from('videos').select('id', { count: 'exact', head: true }),
        supabase.from('videos').select('id', { count: 'exact', head: true }).eq('status', 'published'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('video_views').select('id', { count: 'exact', head: true }),
        supabase.from('videos').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('videos').select('*').eq('featured', true).eq('status', 'published').limit(5),
      ]);

      setStats({
        totalVideos: videosCount.count || 0,
        publishedVideos: publishedCount.count || 0,
        totalUsers: usersCount.count || 0,
        totalViews: viewsCount.count || 0,
        recentVideos: (recentVideosData.data as Video[]) || [],
        featuredVideos: (featuredVideosData.data as Video[]) || [],
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, []);

  useEffect(() => {
    // If auth is still loading, wait
    if (authLoading) {
      return;
    }

    // If auth is done but no user, or user is not admin - redirect to login
    if (!user || !isAdmin) {
      router.replace('/admin/login');
      return;
    }

    // User is admin - fetch data
    setLoading(true);
    fetchStats().finally(() => setLoading(false));
  }, [authLoading, user, isAdmin, router, fetchStats]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  }, [fetchStats]);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/');
  };

  // Loading state
  if (authLoading) {
    return <LoadingScreen />;
  }

  // Not authorized - show access denied
  if (!user || !isAdmin) {
    return (
      <View style={styles.container}>
        <View style={styles.unauthorized}>
          <AlertCircle size={48} color={Colors.status.error} />
          <Text style={styles.unauthorizedTitle}>Access Denied</Text>
          <Text style={styles.unauthorizedText}>
            You must be logged in as an admin to access this page.
          </Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.replace('/admin/login')}
          >
            <Text style={styles.loginButtonText}>Go to Admin Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Loading dashboard data
  if (loading && !stats) {
    return <LoadingScreen />;
  }

  const statCards = [
    {
      icon: Film,
      label: 'Total Videos',
      value: stats?.totalVideos || 0,
      subtext: `${stats?.publishedVideos || 0} published`,
      color: Colors.primary,
      onPress: () => router.push('/admin/videos'),
    },
    {
      icon: Users,
      label: 'Total Users',
      value: stats?.totalUsers || 0,
      color: Colors.status.info,
      onPress: () => router.push('/admin/users'),
    },
    {
      icon: Eye,
      label: 'Total Views',
      value: stats?.totalViews || 0,
      color: Colors.status.success,
      onPress: () => router.push('/admin/analytics'),
    },
  ];

  const menuItems = [
    { icon: CloudUpload, label: 'Upload Video', route: '/admin/upload', color: Colors.primary },
    { icon: Clapperboard, label: 'Manage Videos', route: '/admin/videos', color: Colors.status.info },
    { icon: Tag, label: 'Categories', route: '/admin/categories', color: Colors.status.success },
    { icon: Users, label: 'Users', route: '/admin/users', color: Colors.status.warning },
    { icon: ChartBar, label: 'Analytics', route: '/admin/analytics', color: Colors.status.error },
    { icon: Settings, label: 'Settings', route: '/admin/settings', color: Colors.text.secondary },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>Admin Dashboard</Text>
            <Text style={styles.subtitle}>
              Welcome, {profile?.full_name || profile?.email?.split('@')[0] || 'Admin'}
            </Text>
          </View>
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <LogOut size={20} color={Colors.status.error} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        <View style={styles.statsGrid}>
          {statCards.map((stat, index) => (
            <TouchableOpacity
              key={index}
              style={styles.statCard}
              onPress={stat.onPress}
            >
              <View style={[styles.statIcon, { backgroundColor: `${stat.color}20` }]}>
                <stat.icon size={24} color={stat.color} />
              </View>
              <Text style={styles.statValue}>{formatNumber(stat.value)}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
              {stat.subtext && (
                <Text style={styles.statSubtext}>{stat.subtext}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.menuGrid}>
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.menuItem}
                onPress={() => router.push(item.route as any)}
              >
                <View style={[styles.menuIcon, { backgroundColor: `${item.color}20` }]}>
                  <item.icon size={20} color={item.color} />
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <ChevronRight size={16} color={Colors.text.muted} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {stats?.featuredVideos && stats.featuredVideos.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Featured Videos</Text>
              <TouchableOpacity onPress={() => router.push('/admin/videos')}>
                <Text style={styles.seeAllText}>Manage</Text>
              </TouchableOpacity>
            </View>
            {stats.featuredVideos.map((video) => (
              <View key={video.id} style={styles.videoItem}>
                <View style={styles.videoThumbnail}>
                  <Film size={20} color={Colors.text.secondary} />
                </View>
                <View style={styles.videoInfo}>
                  <Text style={styles.videoTitle} numberOfLines={1}>{video.title}</Text>
                  <Text style={styles.videoMeta}>{video.views_count || 0} views</Text>
                </View>
                <Star size={16} color={Colors.primary} fill={Colors.primary} />
              </View>
            ))}
          </View>
        )}

        {stats?.recentVideos && stats.recentVideos.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recently Uploaded</Text>
              <TouchableOpacity onPress={() => router.push('/admin/videos')}>
                <Text style={styles.seeAllText}>View All</Text>
              </TouchableOpacity>
            </View>
            {stats.recentVideos.map((video) => (
              <View key={video.id} style={styles.videoItem}>
                <View style={styles.videoThumbnail}>
                  <Film size={20} color={Colors.text.secondary} />
                </View>
                <View style={styles.videoInfo}>
                  <Text style={styles.videoTitle} numberOfLines={1}>{video.title}</Text>
                  <View style={styles.videoTags}>
                    {video.featured && (
                      <View style={[styles.badge, styles.badgeFeatured]}>
                        <Text style={styles.badgeText}>Featured</Text>
                      </View>
                    )}
                    {video.trending && (
                      <View style={[styles.badge, styles.badgeTrending]}>
                        <Text style={styles.badgeText}>Trending</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.statusBadge}>
                  <View style={[
                    styles.statusDot,
                    video.status === 'published' ? styles.statusPublished : styles.statusDraft
                  ]} />
                  <Text style={styles.statusText}>{video.status}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.footer} />
      </ScrollView>
    </View>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.card,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: FontSizes.display,
    fontWeight: FontWeights.bold,
    color: Colors.text.primary,
  },
  subtitle: {
    fontSize: FontSizes.md,
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
  },
  signOutButton: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    backgroundColor: `${Colors.status.error}20`,
  },
  content: {
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  statValue: {
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.bold,
    color: Colors.text.primary,
  },
  statLabel: {
    fontSize: FontSizes.sm,
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  statSubtext: {
    fontSize: FontSizes.xs,
    color: Colors.text.muted,
    marginTop: Spacing.xs,
  },
  section: {
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.semibold,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  seeAllText: {
    fontSize: FontSizes.sm,
    color: Colors.primary,
    fontWeight: FontWeights.semibold,
  },
  menuGrid: {
    gap: Spacing.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuLabel: {
    flex: 1,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.medium,
    color: Colors.text.primary,
  },
  videoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  videoThumbnail: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  videoInfo: {
    flex: 1,
  },
  videoTitle: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  videoMeta: {
    fontSize: FontSizes.sm,
    color: Colors.text.muted,
  },
  videoTags: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  badge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  badgeFeatured: {
    backgroundColor: Colors.primary,
  },
  badgeTrending: {
    backgroundColor: Colors.status.info,
  },
  badgeText: {
    fontSize: FontSizes.xs,
    color: Colors.text.primary,
    fontWeight: FontWeights.semibold,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusPublished: {
    backgroundColor: Colors.status.success,
  },
  statusDraft: {
    backgroundColor: Colors.text.muted,
  },
  statusText: {
    fontSize: FontSizes.xs,
    color: Colors.text.muted,
    textTransform: 'capitalize',
  },
  footer: {
    height: Spacing.xxl,
  },
  unauthorized: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
  },
  unauthorizedTitle: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: Colors.text.primary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  unauthorizedText: {
    fontSize: FontSizes.md,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  loginButton: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  loginButtonText: {
    color: Colors.text.primary,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
  },
});
