import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { Colors, BorderRadius } from '@/constants/theme';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

const { width: screenWidth } = Dimensions.get('window');

export function Skeleton({ width = '100%', height = 20, borderRadius = BorderRadius.md, style }: SkeletonProps) {
  const opacity = useSharedValue(0.3);

  React.useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.6, {
        duration: 1000,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width, height, borderRadius },
        animatedStyle,
        style,
      ]}
    />
  );
}

export function VideoCardSkeleton({ size = 'medium' }: { size?: 'small' | 'medium' | 'large' }) {
  const getWidth = () => {
    switch (size) {
      case 'small':
        return screenWidth * 0.3;
      case 'large':
        return screenWidth - 32;
      default:
        return screenWidth * 0.45;
    }
  };

  const getImageHeight = () => {
    switch (size) {
      case 'small':
        return screenWidth * 0.18;
      case 'large':
        return screenWidth * 0.35;
      default:
        return screenWidth * 0.28;
    }
  };

  return (
    <View style={[styles.videoCardContainer, { width: getWidth() }]}>
      <Skeleton width="100%" height={getImageHeight()} borderRadius={BorderRadius.lg} />
      <View style={styles.videoCardDetails}>
        <Skeleton width="80%" height={14} borderRadius={BorderRadius.sm} />
        <Skeleton width="40%" height={12} borderRadius={BorderRadius.sm} style={styles.mtSm} />
      </View>
    </View>
  );
}

export function HeroSkeleton() {
  return (
    <View style={styles.heroContainer}>
      <Skeleton width={screenWidth} height={screenWidth * 0.56} borderRadius={0} />
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: Colors.tertiary,
  },
  videoCardContainer: {
    marginRight: 16,
  },
  videoCardDetails: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  mtSm: {
    marginTop: 6,
  },
  heroContainer: {
    width: '100%',
  },
});
