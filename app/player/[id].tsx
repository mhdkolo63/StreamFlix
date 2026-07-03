import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  ScrollView,
  Image,
  Platform,
  Share,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import * as ScreenOrientation from 'expo-screen-orientation';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  ArrowLeft,
  Settings,
  PictureInPicture2,
  ThumbsUp,
  ThumbsDown,
  Share2,
  Clock,
  Eye,
  Calendar,
  CheckCircle,
} from 'lucide-react-native';
import { supabase, Video as VideoType } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { VideoCard } from '@/components/VideoCard';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');
const APP_NAME = 'StreamFlix';

export default function VideoPlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const videoRef = useRef<Video>(null);
  const [videoData, setVideoData] = useState<VideoType | null>(null);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [loading, setLoading] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [initialPosition, setInitialPosition] = useState(0);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [relatedVideos, setRelatedVideos] = useState<VideoType[]>([]);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [inWatchLater, setInWatchLater] = useState(false);
  const [uploadDate, setUploadDate] = useState('');
  const [viewCount, setViewCount] = useState(0);
  const [autoPlayNext, setAutoPlayNext] = useState(true);
  const [seeking, setSeeking] = useState(false);
  const [seekPosition, setSeekPosition] = useState(0);

  const hideControlsTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchVideo();
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, [id]);

  const fetchVideo = async () => {
    if (!id) return;

    setLoading(true);
    try {
      const { data: videoData, error } = await supabase
        .from('videos')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error || !videoData) {
        setLoading(false);
        return;
      }

      setVideoData(videoData);
      setVideoUri(videoData.video_url);
      setViewCount(videoData.views_count || 0);
      setLikeCount(videoData.like_count || 0);

      if (videoData.created_at) {
        const date = new Date(videoData.created_at);
        setUploadDate(date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }));
      }

      // Get watch progress if user is logged in
      if (user) {
        const { data: historyData } = await supabase
          .from('watch_history')
          .select('progress')
          .eq('video_id', id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (historyData && historyData.progress > 5) {
          setInitialPosition(historyData.progress);
        }

        // Check if liked
        const { data: likeData } = await supabase
          .from('video_likes')
          .select('id')
          .eq('video_id', id)
          .eq('user_id', user.id)
          .maybeSingle();
        setIsLiked(!!likeData);

        // Check if in favorites (watch later)
        const { data: favData } = await supabase
          .from('favorites')
          .select('id')
          .eq('video_id', id)
          .eq('user_id', user.id)
          .maybeSingle();
        setInWatchLater(!!favData);
      }

      // Fetch related videos
      let relatedQuery = supabase
        .from('videos')
        .select('*')
        .eq('status', 'published')
        .neq('id', id)
        .limit(10);

      if (videoData.genre) {
        relatedQuery = relatedQuery.eq('genre', videoData.genre);
      } else {
        relatedQuery = relatedQuery.order('created_at', { ascending: false });
      }

      const { data: related } = await relatedQuery;
      if (related && related.length > 0) {
        setRelatedVideos(related);
      } else {
        const { data: fallback } = await supabase
          .from('videos')
          .select('*')
          .eq('status', 'published')
          .neq('id', id)
          .order('views_count', { ascending: false })
          .limit(10);
        if (fallback) setRelatedVideos(fallback);
      }

      // Track view
      await supabase.from('video_views').insert({
        video_id: id,
        user_id: user?.id || null,
        watch_duration: 0,
      });

      // Increment views count
      await supabase.rpc('increment_video_views', { video_id: id });
      setViewCount(prev => prev + 1);
    } catch (error) {
      console.error('Error fetching video:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (videoRef.current && initialPosition > 0 && videoUri && !hasInitialized) {
      videoRef.current.setPositionAsync(initialPosition * 1000);
      setPosition(initialPosition);
      setHasInitialized(true);
    }
  }, [videoUri, initialPosition, hasInitialized]);

  const saveProgress = useCallback(async (currentPosition: number) => {
    if (!user || !id || !videoData) return;

    try {
      await supabase.from('watch_history').upsert(
        {
          user_id: user.id,
          video_id: id,
          progress: Math.floor(currentPosition),
          completed: currentPosition >= videoData.duration - 10,
          last_watched_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,video_id' }
      );
    } catch (error) {
      // silent
    }
  }, [user, id, videoData]);

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis / 1000);
      setDuration(status.durationMillis ? status.durationMillis / 1000 : 0);
      setIsPlaying(status.isPlaying);

      if (status.didJustFinish && autoPlayNext && relatedVideos.length > 0) {
        const nextVideo = relatedVideos[0];
        router.replace(`/player/${nextVideo.id}`);
        return;
      }

      if (Math.floor(status.positionMillis / 1000) % 5 === 0 && status.positionMillis > 0) {
        saveProgress(status.positionMillis / 1000);
      }
    }
  };

  const togglePlayPause = async () => {
    if (videoRef.current) {
      if (isPlaying) {
        await videoRef.current.pauseAsync();
      } else {
        await videoRef.current.playAsync();
      }
    }
    showControlsTemporarily();
  };

  const toggleMute = async () => {
    if (videoRef.current) {
      await videoRef.current.setIsMutedAsync(!isMuted);
      setIsMuted(!isMuted);
    }
    showControlsTemporarily();
  };

  const toggleFullscreen = async () => {
    try {
      if (isLandscape) {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        setIsLandscape(false);
        setIsFullscreen(false);
      } else {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT);
        setIsLandscape(true);
        setIsFullscreen(true);
      }
    } catch (e) {
      // web may not support orientation lock
    }
    showControlsTemporarily();
  };

  const handleSeek = (value: number) => {
    setSeekPosition(value);
    setSeeking(true);
  };

  const handleSeekRelease = async (value: number) => {
    setSeeking(false);
    if (videoRef.current) {
      await videoRef.current.setPositionAsync(value * 1000);
      setPosition(value);
    }
    showControlsTemporarily();
  };

  const skipForward = async () => {
    if (videoRef.current) {
      const newPosition = Math.min(position + 10, duration);
      await videoRef.current.setPositionAsync(newPosition * 1000);
      setPosition(newPosition);
    }
    showControlsTemporarily();
  };

  const skipBackward = async () => {
    if (videoRef.current) {
      const newPosition = Math.max(position - 10, 0);
      await videoRef.current.setPositionAsync(newPosition * 1000);
      setPosition(newPosition);
    }
    showControlsTemporarily();
  };

  const setSpeed = async (speed: number) => {
    setPlaybackSpeed(speed);
    setShowSpeedMenu(false);
    if (videoRef.current) {
      await videoRef.current.setRateAsync(speed, true);
    }
    showControlsTemporarily();
  };

  const showControlsTemporarily = () => {
    setShowControls(true);
    if (hideControlsTimeout.current) {
      clearTimeout(hideControlsTimeout.current);
    }
    hideControlsTimeout.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
        setShowSpeedMenu(false);
      }
    }, 4000);
  };

  const handleBack = async () => {
    try {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    } catch (e) {
      // web
    }
    if (user && videoData) {
      await saveProgress(position);
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const toggleLike = async () => {
    if (!user || !videoData) {
      Alert.alert('Sign in required', 'Please sign in to like videos.');
      return;
    }

    try {
      if (isLiked) {
        await supabase
          .from('video_likes')
          .delete()
          .eq('video_id', videoData.id)
          .eq('user_id', user.id);
        setIsLiked(false);
        setLikeCount(prev => Math.max(0, prev - 1));
      } else {
        await supabase
          .from('video_likes')
          .insert({ video_id: videoData.id, user_id: user.id });
        setIsLiked(true);
        setLikeCount(prev => prev + 1);
      }
    } catch (error) {
      // silent
    }
  };

  const toggleWatchLater = async () => {
    if (!user || !videoData) {
      Alert.alert('Sign in required', 'Please sign in to save videos to your list.');
      return;
    }

    try {
      if (inWatchLater) {
        await supabase
          .from('favorites')
          .delete()
          .eq('video_id', videoData.id)
          .eq('user_id', user.id);
        setInWatchLater(false);
      } else {
        await supabase
          .from('favorites')
          .insert({ video_id: videoData.id, user_id: user.id });
        setInWatchLater(true);
      }
    } catch (error) {
      // silent
    }
  };

  const handleShare = async () => {
    if (!videoData) return;
    try {
      if (Platform.OS === 'web' && navigator.share) {
        await navigator.share({
          title: videoData.title,
          text: videoData.description || `Watch ${videoData.title} on ${APP_NAME}`,
          url: typeof window !== 'undefined' ? `${window.location.origin}/video/${videoData.id}` : '',
        });
      } else {
        await Share.share({
          message: `Watch "${videoData.title}" on ${APP_NAME}!`,
        });
      }
    } catch (error) {
      // silent
    }
  };

  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatViews = (views: number): string => {
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
    return views.toString();
  };

  const formatDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!videoUri) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Video not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <ArrowLeft size={24} color={Colors.text.primary} />
          <Text style={styles.backText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const progressPercent = duration > 0 ? ((seeking ? seekPosition : position) / duration) * 100 : 0;
  const videoHeight = isFullscreen ? height : Math.min(width * 0.5625, height * 0.4);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar hidden={isFullscreen} />
      <View style={[styles.container, isFullscreen && styles.fullscreenContainer]}>
        <View style={[styles.videoWrapper, { height: videoHeight }]}>
          <Video
            ref={videoRef}
            source={{ uri: videoUri }}
            style={styles.video}
            resizeMode={ResizeMode.CONTAIN}
            onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
            shouldPlay={true}
            isLooping={false}
            useNativeControls={false}
          />

          {showControls && (
            <Animated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(200)}
              style={styles.controlsOverlay}
            >
              <View style={styles.topBar}>
                <TouchableOpacity onPress={handleBack} style={styles.controlButton}>
                  <ArrowLeft size={28} color={Colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.topBarTitle} numberOfLines={1}>
                  {videoData?.title || ''}
                </Text>
                <View style={{ width: 28 }} />
              </View>

              <View style={styles.centerControls}>
                <TouchableOpacity style={styles.controlButton} onPress={skipBackward}>
                  <SkipBack size={28} color={Colors.text.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.playPauseButton} onPress={togglePlayPause}>
                  {isPlaying ? (
                    <Pause size={36} color={Colors.text.primary} fill={Colors.text.primary} />
                  ) : (
                    <Play size={36} color={Colors.text.primary} fill={Colors.text.primary} />
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.controlButton} onPress={skipForward}>
                  <SkipForward size={28} color={Colors.text.primary} />
                </TouchableOpacity>
              </View>

              <View style={styles.bottomBar}>
                <View style={styles.progressRow}>
                  <Text style={styles.timeText}>{formatTime(seeking ? seekPosition : position)}</Text>
                  <TouchableOpacity
                    style={styles.seekBar}
                    activeOpacity={1}
                    onPress={(e) => {
                      const x = e.nativeEvent.locationX;
                      const pct = x / (width - 80);
                      handleSeekRelease(pct * duration);
                    }}
                  >
                    <View style={styles.seekTrack} />
                    <View style={[styles.seekFill, { width: `${progressPercent}%` }]} />
                    <View style={[styles.seekThumb, { left: `${progressPercent}%` }]} />
                  </TouchableOpacity>
                  <Text style={styles.timeText}>{formatTime(duration)}</Text>
                </View>

                <View style={styles.bottomActions}>
                  <View style={styles.bottomLeftActions}>
                    <TouchableOpacity style={styles.controlButton} onPress={toggleMute}>
                      {isMuted ? <VolumeX size={22} color={Colors.text.primary} /> : <Volume2 size={22} color={Colors.text.primary} />}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.speedButton} onPress={() => setShowSpeedMenu(!showSpeedMenu)}>
                      <Text style={styles.speedText}>{playbackSpeed}x</Text>
                    </TouchableOpacity>
                    {showSpeedMenu && (
                      <View style={styles.speedMenu}>
                        {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => (
                          <TouchableOpacity
                            key={speed}
                            style={[styles.speedMenuItem, playbackSpeed === speed && styles.speedMenuItemActive]}
                            onPress={() => setSpeed(speed)}
                          >
                            <Text style={[styles.speedMenuItemText, playbackSpeed === speed && styles.speedMenuItemTextActive]}>
                              {speed}x
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                  <View style={styles.bottomRightActions}>
                    <TouchableOpacity style={styles.controlButton} onPress={() => setAutoPlayNext(!autoPlayNext)}>
                      <Text style={[styles.autoPlayText, autoPlayNext && styles.autoPlayTextActive]}>
                        Auto-play {autoPlayNext ? 'ON' : 'OFF'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.controlButton} onPress={toggleFullscreen}>
                      {isFullscreen ? <Minimize size={22} color={Colors.text.primary} /> : <Maximize size={22} color={Colors.text.primary} />}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Animated.View>
          )}

          {!showControls && (
            <TouchableOpacity
              style={styles.tapToShowControls}
              activeOpacity={1}
              onPress={showControlsTemporarily}
            />
          )}
        </View>

        {!isFullscreen && (
          <ScrollView
            style={styles.infoSection}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.videoTitle}>{videoData?.title}</Text>

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Eye size={16} color={Colors.text.secondary} />
                <Text style={styles.metaText}>{formatViews(viewCount)} views</Text>
              </View>
              <View style={styles.metaItem}>
                <Calendar size={16} color={Colors.text.secondary} />
                <Text style={styles.metaText}>{uploadDate}</Text>
              </View>
              {(videoData?.duration ?? 0) > 0 && (
                <View style={styles.metaItem}>
                  <Clock size={16} color={Colors.text.secondary} />
                  <Text style={styles.metaText}>{formatDuration(videoData?.duration ?? 0)}</Text>
                </View>
              )}
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity style={[styles.actionButton, isLiked && styles.actionButtonActive]} onPress={toggleLike}>
                <ThumbsUp size={20} color={isLiked ? Colors.primary : Colors.text.primary} fill={isLiked ? Colors.primary : 'transparent'} />
                <Text style={[styles.actionText, isLiked && styles.actionTextActive]}>{formatViews(likeCount)}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
                <Share2 size={20} color={Colors.text.primary} />
                <Text style={styles.actionText}>Share</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, inWatchLater && styles.actionButtonActive]}
                onPress={toggleWatchLater}
              >
                <Clock size={20} color={inWatchLater ? Colors.primary : Colors.text.primary} fill={inWatchLater ? Colors.primary : 'transparent'} />
                <Text style={[styles.actionText, inWatchLater && styles.actionTextActive]}>
                  {inWatchLater ? 'Saved' : 'Watch Later'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.publisherRow}>
              <View style={styles.publisherAvatar}>
                <Text style={styles.publisherAvatarText}>{APP_NAME[0]}</Text>
              </View>
              <View style={styles.publisherInfo}>
                <Text style={styles.publisherName}>{APP_NAME}</Text>
                <Text style={styles.publisherSub}>Official Channel</Text>
              </View>
            </View>

            {videoData?.description && (
              <View style={styles.descriptionContainer}>
                <Text style={styles.descriptionText}>{videoData.description}</Text>
              </View>
            )}

            {relatedVideos.length > 0 && (
              <View style={styles.recommendedSection}>
                <Text style={styles.recommendedTitle}>Recommended Videos</Text>
                {relatedVideos.map((video) => (
                  <TouchableOpacity
                    key={video.id}
                    style={styles.recommendedItem}
                    onPress={() => router.push(`/player/${video.id}`)}
                    activeOpacity={0.7}
                  >
                    <Image
                      source={{
                        uri: video.thumbnail_url || 'https://images.unsplash.com/photo-1489594927165-fd5a049b6667?w=320&h=180&fit=crop',
                      }}
                      style={styles.recommendedThumb}
                      resizeMode="cover"
                    />
                    <View style={styles.recommendedInfo}>
                      <Text style={styles.recommendedVideoTitle} numberOfLines={2}>{video.title}</Text>
                      <Text style={styles.recommendedMeta}>{APP_NAME}</Text>
                      <View style={styles.recommendedMetaRow}>
                        <Text style={styles.recommendedMeta}>{formatViews(video.views_count)} views</Text>
                        <Text style={styles.recommendedDot}>•</Text>
                        <Text style={styles.recommendedMeta}>
                          {video.created_at ? new Date(video.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  fullscreenContainer: {
    paddingTop: 0,
  },
  videoWrapper: {
    width: '100%',
    backgroundColor: '#000',
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'space-between',
  },
  tapToShowControls: {
    ...StyleSheet.absoluteFillObject,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.sm,
  },
  topBarTitle: {
    flex: 1,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    color: Colors.text.primary,
    marginHorizontal: Spacing.sm,
  },
  centerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xl,
  },
  playPauseButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButton: {
    padding: Spacing.sm,
  },
  bottomBar: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  seekBar: {
    flex: 1,
    height: 24,
    justifyContent: 'center',
  },
  seekTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: BorderRadius.full,
  },
  seekFill: {
    position: 'absolute',
    height: 4,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
  },
  seekThumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.primary,
    marginLeft: -7,
  },
  timeText: {
    fontSize: FontSizes.sm,
    color: Colors.text.primary,
    fontWeight: FontWeights.medium,
    minWidth: 50,
    textAlign: 'center',
  },
  bottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bottomLeftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  bottomRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  speedButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: BorderRadius.sm,
  },
  speedText: {
    fontSize: FontSizes.sm,
    color: Colors.text.primary,
    fontWeight: FontWeights.semibold,
  },
  speedMenu: {
    position: 'absolute',
    bottom: 50,
    left: 50,
    backgroundColor: 'rgba(20, 20, 20, 0.95)',
    borderRadius: BorderRadius.md,
    padding: Spacing.xs,
    minWidth: 100,
    zIndex: 10,
  },
  speedMenuItem: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  speedMenuItemActive: {
    backgroundColor: 'rgba(229, 9, 20, 0.2)',
  },
  speedMenuItemText: {
    fontSize: FontSizes.sm,
    color: Colors.text.secondary,
    fontWeight: FontWeights.medium,
  },
  speedMenuItemTextActive: {
    color: Colors.primary,
  },
  autoPlayText: {
    fontSize: FontSizes.xs,
    color: Colors.text.secondary,
    fontWeight: FontWeights.medium,
  },
  autoPlayTextActive: {
    color: Colors.primary,
  },
  infoSection: {
    flex: 1,
    padding: Spacing.lg,
  },
  videoTitle: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
    lineHeight: 24,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  metaText: {
    fontSize: FontSizes.sm,
    color: Colors.text.secondary,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.tertiary,
    borderRadius: BorderRadius.full,
  },
  actionButtonActive: {
    backgroundColor: 'rgba(229, 9, 20, 0.15)',
  },
  actionText: {
    fontSize: FontSizes.sm,
    color: Colors.text.primary,
    fontWeight: FontWeights.medium,
  },
  actionTextActive: {
    color: Colors.primary,
  },
  publisherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  publisherAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  publisherAvatarText: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    color: Colors.text.primary,
  },
  publisherInfo: {
    flex: 1,
  },
  publisherName: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    color: Colors.text.primary,
  },
  publisherSub: {
    fontSize: FontSizes.sm,
    color: Colors.text.secondary,
  },
  descriptionContainer: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  descriptionText: {
    fontSize: FontSizes.md,
    color: Colors.text.secondary,
    lineHeight: 22,
  },
  recommendedSection: {
    marginTop: Spacing.sm,
  },
  recommendedTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  recommendedItem: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  recommendedThumb: {
    width: 160,
    height: 90,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.secondary,
  },
  recommendedInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  recommendedVideoTitle: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
    lineHeight: 20,
  },
  recommendedMeta: {
    fontSize: FontSizes.sm,
    color: Colors.text.secondary,
  },
  recommendedMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: 2,
  },
  recommendedDot: {
    fontSize: FontSizes.sm,
    color: Colors.text.muted,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: Spacing.xl,
  },
  errorText: {
    fontSize: FontSizes.xl,
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.card,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  backText: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.medium,
    color: Colors.text.primary,
  },
});
