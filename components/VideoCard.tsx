import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions } from 'react-native';
import { Play, Clock, Eye, Star } from 'lucide-react-native';
import { Colors, BorderRadius, FontSizes, FontWeights, Spacing } from '@/constants/theme';
import { Video } from '@/lib/supabase';

interface VideoCardProps {
  video: Video;
  onPress: () => void;
  size?: 'small' | 'medium' | 'large';
  showProgress?: boolean;
  progress?: number;
  showDetails?: boolean;
}

const { width } = Dimensions.get('window');

export function VideoCard({
  video,
  onPress,
  size = 'medium',
  showProgress,
  progress,
  showDetails = true,
}: VideoCardProps) {
  const getCardWidth = () => {
    switch (size) {
      case 'small':
        return width * 0.3;
      case 'large':
        return width - Spacing.lg * 2;
      default:
        return width * 0.45;
    }
  };

  const getCardHeight = () => {
    switch (size) {
      case 'small':
        return width * 0.45;
      case 'large':
        return width * 0.6;
      default:
        return width * 0.55;
    }
  };

  const getImageHeight = () => {
    switch (size) {
      case 'small':
        return width * 0.18;
      case 'large':
        return width * 0.35;
      default:
        return width * 0.28;
    }
  };

  const duration = formatDuration(video.duration);

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.container, { width: getCardWidth() }]}
      activeOpacity={0.8}
    >
      <View style={[styles.thumbnailContainer, { height: getImageHeight() }]}>
        <Image
          source={{
            uri: video.thumbnail_url || 'https://images.unsplash.com/photo-1489594927165-fd5a049b6667?w=400&h=225&fit=crop',
          }}
          style={styles.thumbnail}
          resizeMode="cover"
        />
        <View style={styles.overlay}>
          <View style={styles.playButton}>
            <Play size={24} color={Colors.text.primary} fill={Colors.text.primary} />
          </View>
        </View>
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>{duration}</Text>
        </View>
        {video.featured && (
          <View style={styles.featuredBadge}>
            <Star size={12} color={Colors.primary} fill={Colors.primary} />
            <Text style={styles.featuredText}>Featured</Text>
          </View>
        )}
        {showProgress && progress !== undefined && progress > 0 && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
          </View>
        )}
      </View>
      {showDetails && (
        <View style={styles.details}>
          <Text style={styles.title} numberOfLines={2}>
            {video.title}
          </Text>
          {video.release_year && (
            <Text style={styles.meta}>{video.release_year}</Text>
          )}
          {video.views_count > 0 && size !== 'small' && (
            <View style={styles.viewsContainer}>
              <Eye size={12} color={Colors.text.muted} />
              <Text style={styles.views}>{formatViews(video.views_count)}</Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatViews(views: number): string {
  if (views >= 1000000) {
    return `${(views / 1000000).toFixed(1)}M`;
  }
  if (views >= 1000) {
    return `${(views / 1000).toFixed(1)}K`;
  }
  return views.toString();
}

const styles = StyleSheet.create({
  container: {
    marginRight: Spacing.md,
  },
  thumbnailContainer: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.secondary,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0,
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  durationBadge: {
    position: 'absolute',
    bottom: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  durationText: {
    color: Colors.text.primary,
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.medium,
  },
  featuredBadge: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    backgroundColor: 'rgba(229, 9, 20, 0.9)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  featuredText: {
    color: Colors.text.primary,
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.semibold,
  },
  progressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.xs,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
  },
  details: {
    paddingHorizontal: Spacing.xs,
    paddingTop: Spacing.sm,
  },
  title: {
    color: Colors.text.primary,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    marginBottom: Spacing.xs,
  },
  meta: {
    color: Colors.text.secondary,
    fontSize: FontSizes.sm,
  },
  viewsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  views: {
    color: Colors.text.muted,
    fontSize: FontSizes.xs,
  },
});
