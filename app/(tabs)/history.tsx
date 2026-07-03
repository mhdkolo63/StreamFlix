import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Clock, Play, Trash2, Film, ChevronRight } from 'lucide-react-native';
import { supabase, Video, WatchHistory } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/Button';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

export default function HistoryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [watchHistory, setWatchHistory] = useState<(WatchHistory & { video?: Video })[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data } = await supabase
        .from('watch_history')
        .select('*, videos(*)')
        .eq('user_id', user.id)
        .order('last_watched_at', { ascending: false })
        .limit(50);

      if (data) {
        setWatchHistory(data as (WatchHistory & { video?: Video })[]);
      }
    } catch (error) {
      console.error('Error fetching watch history:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchHistory();
    setRefreshing(false);
  }, [fetchHistory]);

  const removeWatchHistory = async (historyId: string) => {
    try {
      await supabase
        .from('watch_history')
        .delete()
        .eq('id', historyId);

      setWatchHistory(prev => prev.filter(h => h.id !== historyId));
    } catch (error) {
      console.error('Error removing from history:', error);
    }
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  if (!user) {
    return (
      <View style={styles.emptyContainer}>
        <Clock size={64} color={Colors.text.muted} />
        <Text style={styles.emptyTitle}>Sign in to view history</Text>
        <Text style={styles.emptySubtitle}>
          Keep track of what you've watched
        </Text>
        <Button
          title="Sign In"
          onPress={() => router.push('/auth/login')}
          style={styles.authButton}
          icon={<ChevronRight size={18} color={Colors.text.primary} />}
          iconPosition="right"
        />
      </View>
    );
  }

  if (watchHistory.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Clock size={24} color={Colors.primary} />
          <Text style={styles.title}>Watch History</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Film size={64} color={Colors.text.muted} />
          <Text style={styles.emptyTitle}>No watch history</Text>
          <Text style={styles.emptySubtitle}>
            Start watching videos to build your history
          </Text>
          <Button
            title="Browse Videos"
            onPress={() => router.push('/')}
            style={styles.browseButton}
            icon={<ChevronRight size={18} color={Colors.text.primary} />}
            iconPosition="right"
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Clock size={24} color={Colors.primary} />
        <Text style={styles.title}>Watch History</Text>
        <Text style={styles.count}>{watchHistory.length} videos</Text>
      </View>

      <FlatList
        data={watchHistory}
        keyExtractor={(item) => item.id}
        refreshing={refreshing}
        onRefresh={onRefresh}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
        renderItem={({ item }) => {
          const video = item.video;
          if (!video) return null;

          const progress = Math.min(100, (item.progress / video.duration) * 100);
          const playedAt = new Date(item.last_watched_at);
          const now = new Date();
          const diffDays = Math.floor((now.getTime() - playedAt.getTime()) / (1000 * 60 * 60 * 24));

          let timeText = 'Today';
          if (diffDays === 1) timeText = 'Yesterday';
          else if (diffDays < 7) timeText = `${diffDays} days ago`;
          else if (diffDays < 30) timeText = `${Math.floor(diffDays / 7)} weeks ago`;
          else timeText = playedAt.toLocaleDateString();

          return (
            <TouchableOpacity
              style={styles.historyItem}
              onPress={() => router.push(`/video/${video.id}`)}
              activeOpacity={0.8}
            >
              <View style={styles.thumbnailContainer}>
                <Image
                  source={{
                    uri: video.thumbnail_url || 'https://images.unsplash.com/photo-1489594927165-fd5a049b6667?w=200&h=120&fit=crop',
                  }}
                  style={styles.thumbnail}
                />
                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${progress}%` }]} />
                  </View>
                </View>
                <View style={styles.playOverlay}>
                  <Play size={24} color={Colors.text.primary} fill={Colors.text.primary} />
                </View>
              </View>

              <View style={styles.info}>
                <Text style={styles.videoTitle} numberOfLines={2}>
                  {video.title}
                </Text>
                <Text style={styles.videoMeta}>
                  {formatDuration(item.progress)} / {formatDuration(video.duration)}
                </Text>
                <Text style={styles.timeText}>{timeText}</Text>
              </View>

              <TouchableOpacity
                onPress={() => removeWatchHistory(item.id)}
                style={styles.removeButton}
              >
                <Trash2 size={18} color={Colors.text.muted} />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  title: {
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.bold,
    color: Colors.text.primary,
    flex: 1,
  },
  count: {
    fontSize: FontSizes.md,
    color: Colors.text.secondary,
  },
  listContent: {
    paddingBottom: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    padding: Spacing.sm,
    overflow: 'hidden',
  },
  thumbnailContainer: {
    width: 120,
    height: 68,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  progressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 2,
  },
  progressBar: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  info: {
    flex: 1,
    marginLeft: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  videoTitle: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  videoMeta: {
    fontSize: FontSizes.sm,
    color: Colors.text.secondary,
  },
  timeText: {
    fontSize: FontSizes.xs,
    color: Colors.text.muted,
    marginTop: Spacing.xs,
  },
  removeButton: {
    padding: Spacing.sm,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.semibold,
    color: Colors.text.primary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: FontSizes.md,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  authButton: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  browseButton: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
});
