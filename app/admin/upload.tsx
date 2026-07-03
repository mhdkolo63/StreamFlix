import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Upload, Image as ImageIcon, Check, X, AlertCircle, CheckCircle } from 'lucide-react-native';
import { supabase, Category } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { LoadingScreen } from '@/components/Loading';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

export default function UploadVideoScreen() {
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoFile, setVideoFile] = useState<any>(null);
  const [thumbnailFile, setThumbnailFile] = useState<any>(null);
  const [duration, setDuration] = useState('');
  const [releaseYear, setReleaseYear] = useState('');
  const [genre, setGenre] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [featured, setFeatured] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isAdmin) {
      router.replace('/admin/login');
      return;
    }
    fetchCategories();
  }, [authLoading, user, isAdmin, router]);

  const fetchCategories = async () => {
    try {
      const { data } = await supabase.from('categories').select('*').order('name');
      if (data) setCategories(data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  if (authLoading) return <LoadingScreen />;
  if (!user || !isAdmin) {
    return (
      <View style={styles.container}>
        <View style={styles.unauthorized}>
          <Text style={styles.unauthorizedText}>Access Denied</Text>
        </View>
      </View>
    );
  }

  const pickVideo = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['video/*'],
        copyToCacheDirectory: true,
      });
      if (result.assets && result.assets.length > 0) {
        setVideoFile(result.assets[0]);
        setErrors(prev => ({ ...prev, video: '' }));
      }
    } catch (error) {
      console.error('Error picking video:', error);
      setErrorMessage('Failed to pick video file');
    }
  };

  const pickThumbnail = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: [16, 9],
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setThumbnailFile(result.assets[0]);
      }
    } catch (error) {
      console.error('Error picking thumbnail:', error);
      setErrorMessage('Failed to pick thumbnail');
    }
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId) ? prev.filter(id => id !== categoryId) : [...prev, categoryId]
    );
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = 'Title is required';
    if (!videoFile) newErrors.video = 'Video file is required';
    if (!duration || parseInt(duration) === 0) newErrors.duration = 'Duration is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUpload = async () => {
    setSuccessMessage(null);
    setErrorMessage(null);

    if (!validateForm()) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      let videoUrl = null;

      // Upload video file
      if (videoFile) {
        setUploadStage('Uploading video file...');
        const fileExt = videoFile.name?.split('.').pop() || 'mp4';
        const fileName = `videos/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const response = await fetch(videoFile.uri);
        const blob = await response.blob();

        const { error: uploadError } = await supabase.storage
          .from('videos')
          .upload(fileName, blob, {
            contentType: `video/${fileExt}`,
            upsert: false,
          });

        if (uploadError) throw new Error(`Video upload failed: ${uploadError.message}`);

        setUploadProgress(50);

        const { data: urlData } = supabase.storage.from('videos').getPublicUrl(fileName);
        videoUrl = urlData.publicUrl;
      }

      // Upload thumbnail
      let thumbnailUrl = null;
      if (thumbnailFile) {
        setUploadStage('Uploading thumbnail...');
        const thumbExt = thumbnailFile.uri.split('.').pop() || 'jpg';
        const thumbName = `thumbnails/${Date.now()}_${Math.random().toString(36).substring(7)}.${thumbExt}`;
        const thumbResponse = await fetch(thumbnailFile.uri);
        const thumbBlob = await thumbResponse.blob();

        const { error: thumbError } = await supabase.storage
          .from('thumbnails')
          .upload(thumbName, thumbBlob, { contentType: `image/${thumbExt}` });

        if (!thumbError) {
          const { data: urlData } = supabase.storage.from('thumbnails').getPublicUrl(thumbName);
          thumbnailUrl = urlData.publicUrl;
        }
      }

      setUploadProgress(75);
      setUploadStage('Saving video metadata...');

      // Insert video record
      const { data: insertedVideo, error: insertError } = await supabase
        .from('videos')
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          video_url: videoUrl,
          thumbnail_url: thumbnailUrl,
          duration: parseInt(duration) || 0,
          release_year: parseInt(releaseYear) || null,
          genre: genre.trim() || null,
          featured,
          trending: false,
          status: 'published',
          views_count: 0,
          like_count: 0,
          uploader_id: user.id,
        })
        .select()
        .single();

      if (insertError) throw new Error(`Failed to save video: ${insertError.message}`);

      // Link categories
      if (selectedCategories.length > 0 && insertedVideo) {
        const categoryInserts = selectedCategories.map(catId => ({
          video_id: insertedVideo.id,
          category_id: catId,
        }));

        await supabase.from('video_categories').insert(categoryInserts);
      }

      setUploadProgress(100);
      setUploadStage('Video published successfully!');
      setSuccessMessage('Video uploaded successfully! It is now live on the public site.');

      // Reset form
      setTimeout(() => {
        setTitle('');
        setDescription('');
        setVideoFile(null);
        setThumbnailFile(null);
        setDuration('');
        setReleaseYear('');
        setGenre('');
        setSelectedCategories([]);
        setFeatured(false);
        setUploadProgress(0);
        setUploadStage('');
        setUploading(false);
        setSuccessMessage(null);
      }, 3000);
    } catch (error: any) {
      console.error('Upload error:', error);
      setErrorMessage(error.message || 'Failed to upload video');
      setUploading(false);
      setUploadProgress(0);
      setUploadStage('');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {successMessage && (
        <View style={styles.successBanner}>
          <CheckCircle size={20} color={Colors.status.success} />
          <Text style={styles.successText}>{successMessage}</Text>
        </View>
      )}

      {errorMessage && (
        <View style={styles.errorBanner}>
          <AlertCircle size={20} color={Colors.status.error} />
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity onPress={() => setErrorMessage(null)} style={styles.closeBanner}>
            <X size={18} color={Colors.text.secondary} />
          </TouchableOpacity>
        </View>
      )}

      {uploading && (
        <View style={styles.uploadProgressContainer}>
          <View style={styles.uploadProgressHeader}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.uploadProgressText}>{uploadStage}</Text>
            <Text style={styles.uploadProgressPercent}>{uploadProgress}%</Text>
          </View>
          <View style={styles.uploadProgressBar}>
            <View style={[styles.uploadProgressFill, { width: `${uploadProgress}%` }]} />
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Video Information</Text>
        <Input label="Title" value={title} onChangeText={setTitle} placeholder="Enter video title" error={errors.title} />
        <Input label="Description" value={description} onChangeText={setDescription} placeholder="Enter description" multiline numberOfLines={4} />
        <View style={styles.row}>
          <View style={styles.halfWidth}>
            <Input label="Duration (seconds)" value={duration} onChangeText={setDuration} placeholder="e.g., 7200" keyboardType="numeric" error={errors.duration} />
          </View>
          <View style={styles.halfWidth}>
            <Input label="Release Year" value={releaseYear} onChangeText={setReleaseYear} placeholder="e.g., 2024" keyboardType="numeric" />
          </View>
        </View>
        <Input label="Genre" value={genre} onChangeText={setGenre} placeholder="e.g., Action, Drama" />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Video File</Text>
        <TouchableOpacity style={styles.uploadArea} onPress={pickVideo} disabled={uploading}>
          {videoFile ? (
            <View style={styles.uploadedInfo}>
              <Check size={24} color={Colors.status.success} />
              <Text style={styles.uploadedText} numberOfLines={1}>{videoFile.name || 'Video selected'}</Text>
              <TouchableOpacity onPress={() => setVideoFile(null)} disabled={uploading}>
                <X size={20} color={Colors.text.muted} />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Upload size={32} color={Colors.text.muted} />
              <Text style={styles.uploadText}>Click to upload video</Text>
              <Text style={styles.uploadHint}>MP4, MOV, MKV up to 5GB</Text>
            </>
          )}
        </TouchableOpacity>
        {errors.video && <Text style={styles.error}>{errors.video}</Text>}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Thumbnail Image</Text>
        <TouchableOpacity style={styles.uploadArea} onPress={pickThumbnail} disabled={uploading}>
          {thumbnailFile ? (
            <View style={styles.uploadedInfo}>
              <Check size={24} color={Colors.status.success} />
              <Text style={styles.uploadedText}>Thumbnail selected</Text>
              <TouchableOpacity onPress={() => setThumbnailFile(null)} disabled={uploading}>
                <X size={20} color={Colors.text.muted} />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <ImageIcon size={32} color={Colors.text.muted} />
              <Text style={styles.uploadText}>Click to upload thumbnail</Text>
              <Text style={styles.uploadHint}>JPG, PNG, WebP</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Categories</Text>
        <View style={styles.categoriesGrid}>
          {categories.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.categoryChip, selectedCategories.includes(cat.id) && styles.categoryChipActive]}
              onPress={() => toggleCategory(cat.id)}
              disabled={uploading}
            >
              <Text style={[styles.categoryChipText, selectedCategories.includes(cat.id) && styles.categoryChipTextActive]}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.checkboxRow} onPress={() => setFeatured(!featured)} disabled={uploading}>
          <View style={[styles.checkbox, featured && styles.checkboxActive]}>
            {featured && <Check size={16} color={Colors.text.primary} />}
          </View>
          <Text style={styles.checkboxLabel}>Feature on homepage</Text>
        </TouchableOpacity>
      </View>

      <Button
        title={uploading ? 'Uploading...' : 'Upload Video'}
        onPress={handleUpload}
        loading={uploading}
        disabled={uploading}
        style={styles.submitButton}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, paddingBottom: Spacing.xxl },
  section: { marginBottom: Spacing.xl },
  sectionTitle: { fontSize: FontSizes.lg, fontWeight: FontWeights.semibold, color: Colors.text.primary, marginBottom: Spacing.md },
  row: { flexDirection: 'row', gap: Spacing.md },
  halfWidth: { flex: 1 },
  uploadArea: { borderWidth: 2, borderColor: Colors.border, borderStyle: 'dashed', borderRadius: BorderRadius.lg, padding: Spacing.xl, alignItems: 'center', justifyContent: 'center' },
  uploadText: { fontSize: FontSizes.md, color: Colors.text.secondary, marginTop: Spacing.sm },
  uploadHint: { fontSize: FontSizes.sm, color: Colors.text.muted, marginTop: Spacing.xs },
  uploadedInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  uploadedText: { fontSize: FontSizes.md, color: Colors.status.success, flex: 1 },
  categoriesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  categoryChip: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.full, backgroundColor: Colors.tertiary },
  categoryChipActive: { backgroundColor: Colors.primary },
  categoryChipText: { fontSize: FontSizes.md, color: Colors.text.secondary, fontWeight: FontWeights.medium },
  categoryChipTextActive: { color: Colors.text.primary },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  checkbox: { width: 24, height: 24, borderRadius: BorderRadius.sm, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  checkboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkboxLabel: { fontSize: FontSizes.md, color: Colors.text.primary },
  submitButton: { marginBottom: Spacing.xl },
  error: { color: Colors.status.error, fontSize: FontSizes.sm, marginTop: Spacing.xs },
  unauthorized: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  unauthorizedText: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold, color: Colors.text.primary },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderLeftWidth: 4,
    borderLeftColor: Colors.status.success,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  successText: {
    flex: 1,
    color: Colors.status.success,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderLeftWidth: 4,
    borderLeftColor: Colors.status.error,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  errorText: {
    flex: 1,
    color: Colors.status.error,
    fontSize: FontSizes.md,
  },
  closeBanner: {
    padding: Spacing.xs,
  },
  uploadProgressContainer: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  uploadProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  uploadProgressText: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.text.primary,
    fontWeight: FontWeights.medium,
  },
  uploadProgressPercent: {
    fontSize: FontSizes.md,
    color: Colors.primary,
    fontWeight: FontWeights.bold,
  },
  uploadProgressBar: {
    height: 6,
    backgroundColor: Colors.tertiary,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  uploadProgressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
  },
});
