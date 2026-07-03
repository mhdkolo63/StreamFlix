import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';

export function useAuthGuard(requireAuth = true, requireAdmin = false) {
  const { user, profile, isAdmin, loading } = useAuth();
  const redirected = useRef(false);
  const checked = useRef(false);

  useEffect(() => {
    // Wait for loading to complete
    if (loading) return;

    // Only run once after loading completes
    if (checked.current) return;
    checked.current = true;

    const checkAccess = () => {
      if (requireAuth && !user) {
        // No user - redirect to appropriate login
        if (!redirected.current) {
          redirected.current = true;
          if (requireAdmin) {
            router.replace('/admin/login');
          } else {
            router.replace('/auth/login');
          }
        }
        return false;
      }

      if (requireAdmin && user && !isAdmin) {
        // User exists but not admin
        if (!redirected.current) {
          redirected.current = true;
          router.replace('/admin/login');
        }
        return false;
      }

      return true;
    };

    checkAccess();
  }, [loading, user, isAdmin, requireAuth, requireAdmin]);

  // Reset redirect flag when user becomes authorized
  useEffect(() => {
    if (user && isAdmin) {
      redirected.current = false;
      checked.current = false;
    }
  }, [user, isAdmin]);

  return {
    user,
    profile,
    isAdmin,
    loading,
    authenticated: !!user,
  };
}

export function useGuestOnly() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/');
    }
  }, [user, loading]);

  return { loading };
}
