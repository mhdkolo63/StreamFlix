import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Heart, Film, ArrowRight } from 'lucide-react-native';
import { supabase, Video } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { VideoCard } from '@/components/VideoCard';
import { VideoCardSkeleton } from '@/components/Skeleton';
import { Button } from '@/components/Button';
import { LoadingScreen } from '@/components/Loading';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

const { width } = Dimensions.get('window');

export default function FavoritesScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [favorites, setFavorites] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFavorites = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data } = await supabase
        .from('favorites')
        .select('video_id, videos(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (data) {
        const videos = data
          .filter((item) => item.videos && !Array.isArray(item.videos))
          .map((item) => item.videos as unknown as Video);
        setFavorites(videos);
      }
    } catch (error) {
      console.error('Error fetching favorites:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  if (!user) {
    return (
      <View style={styles.emptyContainer}>
        <Heart size={64} color={Colors.text.muted} />
        <Text style={styles.emptyTitle}>Sign in to use My List</Text>
        <Text style={styles.emptySubtitle}>
          Keep track of your favorite movies and shows
        </Text>
        <Button
          title="Sign In"
          onPress={() => router.push('/auth/login')}
          style={styles.authButton}
          icon={<ArrowRight size={18} color={Colors.text.primary} />}
          iconPosition="right"
        />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>My List</Text>
        </View>
        <View style={styles.gridContainer}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.gridItem}>
              <VideoCardSkeleton size="medium" />
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (favorites.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>My List</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Film size={64} color={Colors.text.muted} />
          <Text style={styles.emptyTitle}>Your list is empty</Text>
          <Text style={styles.emptySubtitle}>
            Add movies and shows to watch later
          </Text>
          <Button
            title="Browse Videos"
            onPress={() => router.push('/')}
            style={styles.browseButton}
            icon={<ArrowRight size={18} color={Colors.text.primary} />}
            iconPosition="right"
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Heart size={24} color={Colors.primary} fill={Colors.primary} />
        <Text style={styles.title}>My List</Text>
        <Text style={styles.count}>{favorites.length} videos</Text>
      </View>
      <FlatList
        data={favorites}
        keyExtractor={(item) => item.id}
        numColumns={2}
        renderItem={({ item }) => (
          <View style={styles.gridItem}>
            <VideoCard
              video={item}
              onPress={() => router.push(`/video/${item.id}`)}
              size="medium"
            />
          </View>
        )}
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
    paddingBottom: Spacing.lg,
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
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
  },
  gridItem: {
    width: '50%',
    paddingRight: Spacing.sm,
    marginBottom: Spacing.md,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
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
