import React from 'react';
import { View, Text, StyleSheet, FlatList, Dimensions } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { Colors, FontSizes, FontWeights, Spacing, BorderRadius } from '@/constants/theme';
import { Video } from '@/lib/supabase';
import { VideoCard } from './VideoCard';
import { VideoCardSkeleton } from './Skeleton';
import { useRouter } from 'expo-router';

interface VideoRowProps {
  title: string;
  videos?: Video[];
  loading?: boolean;
  onSeeAll?: () => void;
  showProgress?: boolean;
  progressMap?: Record<string, number>;
  size?: 'small' | 'medium' | 'large';
}

export function VideoRow({
  title,
  videos = [],
  loading,
  onSeeAll,
  showProgress,
  progressMap,
  size = 'medium',
}: VideoRowProps) {
  const router = useRouter();

  const handleVideoPress = (video: Video) => {
    router.push(`/video/${video.id}`);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
        </View>
        <FlatList
          horizontal
          data={[1, 2, 3, 4, 5]}
          keyExtractor={(item) => item.toString()}
          renderItem={() => <VideoCardSkeleton size={size} />}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.list}
        />
      </View>
    );
  }

  if (videos.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {onSeeAll && (
          <ChevronRight
            size={20}
            color={Colors.text.secondary}
            onPress={onSeeAll}
          />
        )}
      </View>
      <FlatList
        horizontal
        data={videos}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <VideoCard
            video={item}
            onPress={() => handleVideoPress(item)}
            size={size}
            showProgress={showProgress}
            progress={progressMap?.[item.id]}
          />
        )}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  title: {
    color: Colors.text.primary,
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.semibold,
  },
  list: {
    paddingHorizontal: Spacing.lg,
  },
});
