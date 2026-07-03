import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Play, Info, ChevronRight, TrendingUp, Star, Clock, Search, Bell } from 'lucide-react-native';
import { supabase, Video } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { VideoRow } from '@/components/VideoRow';
import { HeroSkeleton, VideoCardSkeleton } from '@/components/Skeleton';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

const { width, height } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();

  const [featuredVideo, setFeaturedVideo] = useState<Video | null>(null);
  const [trendingVideos, setTrendingVideos] = useState<Video[]>([]);
  const [recentVideos, setRecentVideos] = useState<Video[]>([]);
  const [continueWatching, setContinueWatching] = useState<Video[]>([]);
  const [continueWatchingProgress, setContinueWatchingProgress] = useState<Record<string, number>>({});
  const [categories, setCategories] = useState<{ name: string; videos: Video[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      // Fetch featured video
      const { data: featured } = await supabase
        .from('videos')
        .select('*')
        .eq('featured', true)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (featured) setFeaturedVideo(featured);

      // Fetch trending videos
      const { data: trending } = await supabase
        .from('videos')
        .select('*')
        .eq('trending', true)
        .eq('status', 'published')
        .order('views_count', { ascending: false })
        .limit(10);

      if (trending) setTrendingVideos(trending);

      // Fetch recently added
      const { data: recent } = await supabase
        .from('videos')
        .select('*')
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(10);

      if (recent) setRecentVideos(recent);

      // Fetch continue watching (if user is logged in)
      if (user) {
        const { data: watchHistory } = await supabase
          .from('watch_history')
          .select('video_id, progress, videos(*)')
          .eq('user_id', user.id)
          .eq('completed', false)
          .order('last_watched_at', { ascending: false })
          .limit(5);

        if (watchHistory) {
          const videos: Video[] = [];
          const progressMap: Record<string, number> = {};

          watchHistory.forEach((item) => {
            if (item.videos && !Array.isArray(item.videos)) {
              videos.push(item.videos as unknown as Video);
              const video = item.videos as Video;
              progressMap[video.id] = Math.min(100, (item.progress / video.duration) * 100);
            }
          });

          setContinueWatching(videos);
          setContinueWatchingProgress(progressMap);
        }
      }

      // Fetch videos by category
      const { data: categoriesData } = await supabase
        .from('categories')
        .select('name, slug');

      if (categoriesData && categoriesData.length > 0) {
        const categoryVideos = await Promise.all(
          categoriesData.slice(0, 3).map(async (cat) => {
            const { data: catVideos } = await supabase
              .from('video_categories')
              .select('videos(*)')
              .eq('category_id', (await supabase.from('categories').select('id').eq('slug', cat.slug).maybeSingle()).data?.id)
              .limit(10);

            const videos = catVideos
              ?.filter((v) => v.videos && !Array.isArray(v.videos))
              .map((v) => v.videos as unknown as Video) || [];

            return { name: cat.name, videos };
          })
        );

        setCategories(categoryVideos.filter((cv) => cv.videos.length > 0));
      }

      setLoading(false);

      // Fetch unread notification count
      if (user) {
        const { count: unread } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_read', false);
        setUnreadCount(unread || 0);
      }
    } catch (error) {
      console.error('Error fetching home data:', error);
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time subscription for new videos
  useEffect(() => {
    const channel = supabase
      .channel('videos-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'videos',
          filter: 'status=eq.published',
        },
        () => {
          fetchData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'videos',
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    // Real-time subscription for notifications
    let notifChannel: any = null;
    if (user) {
      notifChannel = supabase
        .channel('home-notifications')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            fetchData();
          }
        )
        .subscribe();
    }

    return () => {
      supabase.removeChannel(channel);
      if (notifChannel) supabase.removeChannel(notifChannel);
    };
  }, [fetchData, user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const renderHeroBanner = () => {
    if (loading) {
      return <HeroSkeleton />;
    }

    if (!featuredVideo) {
      return (
        <View style={styles.heroContainer}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&h=450&fit=crop' }}
            style={styles.heroImage}
            resizeMode="cover"
          />
          <View style={styles.heroOverlay} />
          <View style={styles.heroContent}>
            <Text style={styles.heroTagline}>Welcome to StreamFlix</Text>
            <Text style={styles.heroSubtitle}>Stream the best movies and shows</Text>
            <View style={styles.heroButtons}>
              <TouchableOpacity style={styles.playButton}>
                <Play size={20} color={Colors.text.primary} fill={Colors.text.primary} />
                <Text style={styles.playButtonText}>Get Started</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.heroContainer}>
        <Image
          source={{
            uri: featuredVideo.thumbnail_url || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&h=450&fit=crop',
          }}
          style={styles.heroImage}
          resizeMode="cover"
        />
        <View style={styles.heroOverlay} />
        <View style={styles.heroContent}>
          <Text style={styles.heroTitle}>{featuredVideo.title}</Text>
          {featuredVideo.release_year && (
            <Text style={styles.heroMeta}>{featuredVideo.release_year}</Text>
          )}
          {featuredVideo.genre && (
            <Text style={styles.heroGenre}>{featuredVideo.genre}</Text>
          )}
          <Text style={styles.heroDescription} numberOfLines={3}>
            {featuredVideo.description || 'No description available'}
          </Text>
          <View style={styles.heroButtons}>
            <TouchableOpacity
              style={styles.playButton}
              onPress={() => router.push(`/video/${featuredVideo.id}`)}
            >
              <Play size={20} color={Colors.text.primary} fill={Colors.text.primary} />
              <Text style={styles.playButtonText}>Play Now</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.infoButton}
              onPress={() => router.push(`/video/${featuredVideo.id}`)}
            >
              <Info size={20} color={Colors.text.primary} />
              <Text style={styles.infoButtonText}>More Info</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={Colors.primary}
          colors={[Colors.primary]}
        />
      }
    >
      <View style={styles.topBar}>
        <Text style={styles.appTitle}>StreamFlix</Text>
        <View style={styles.topBarActions}>
          <TouchableOpacity style={styles.topBarIcon} onPress={() => router.push('/search')}>
            <Search size={22} color={Colors.text.primary} />
          </TouchableOpacity>
          {user && (
            <TouchableOpacity style={styles.topBarIcon} onPress={() => router.push('/notifications')}>
              <Bell size={22} color={Colors.text.primary} />
              {unreadCount > 0 && (
                <View style={styles.unreadDot} />
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {renderHeroBanner()}

      {user && continueWatching.length > 0 && (
        <VideoRow
          title="Continue Watching"
          videos={continueWatching}
          showProgress
          progressMap={continueWatchingProgress}
          onSeeAll={() => router.push('/history')}
        />
      )}

      <VideoRow
        title="Trending Now"
        videos={trendingVideos}
        loading={loading}
        onSeeAll={() => router.push('/browse/trending')}
      />

      <VideoRow
        title="Recently Added"
        videos={recentVideos}
        loading={loading}
        onSeeAll={() => router.push('/browse/recent')}
      />

      {categories.map((category, index) => (
        <VideoRow
          key={index}
          title={category.name}
          videos={category.videos}
          onSeeAll={() => router.push(`/browse/category/${category.name.toLowerCase()}`)}
        />
      ))}

      <View style={styles.footer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  appTitle: {
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.bold,
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  topBarIcon: {
    padding: Spacing.sm,
    position: 'relative',
  },
  unreadDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  heroContainer: {
    width: '100%',
    height: height * 0.55,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11, 11, 11, 0.4)',
  },
  heroGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  heroContent: {
    position: 'absolute',
    bottom: Spacing.xl,
    left: Spacing.lg,
    right: Spacing.lg,
  },
  heroTitle: {
    fontSize: FontSizes.display,
    fontWeight: FontWeights.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  heroMeta: {
    fontSize: FontSizes.lg,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },
  heroGenre: {
    fontSize: FontSizes.md,
    color: Colors.primary,
    fontWeight: FontWeights.semibold,
    marginBottom: Spacing.sm,
  },
  heroDescription: {
    fontSize: FontSizes.md,
    color: Colors.text.secondary,
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  heroTagline: {
    fontSize: FontSizes.display,
    fontWeight: FontWeights.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  heroSubtitle: {
    fontSize: FontSizes.lg,
    color: Colors.text.secondary,
    marginBottom: Spacing.lg,
  },
  heroButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  playButtonText: {
    color: Colors.text.primary,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
  },
  infoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  infoButtonText: {
    color: Colors.text.primary,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
  },
  footer: {
    height: Spacing.xxl,
  },
});
