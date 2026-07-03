import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react-native';
import { Colors, BorderRadius, Spacing, FontSizes, FontWeights } from '@/constants/theme';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

function Toast({ toast, onDismiss }: ToastProps) {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(-100));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onDismiss(toast.id);
      });
    }, toast.duration || 4000);

    return () => clearTimeout(timer);
  }, []);

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle size={20} color={Colors.status.success} />;
      case 'error':
        return <AlertCircle size={20} color={Colors.status.error} />;
      case 'warning':
        return <AlertTriangle size={20} color={Colors.status.warning} />;
      default:
        return <Info size={20} color={Colors.status.info} />;
    }
  };

  const getBorderColor = () => {
    switch (toast.type) {
      case 'success':
        return Colors.status.success;
      case 'error':
        return Colors.status.error;
      case 'warning':
        return Colors.status.warning;
      default:
        return Colors.status.info;
    }
  };

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
          borderLeftColor: getBorderColor(),
        },
      ]}
    >
      {getIcon()}
      <Text style={styles.message}>{toast.message}</Text>
    </Animated.View>
  );
}

let toastId = 0;
let setToasts: React.Dispatch<React.SetStateAction<ToastMessage[]>> | null = null;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToastsState] = useState<ToastMessage[]>([]);
  setToasts = setToastsState;

  const dismissToast = useCallback((id: string) => {
    setToastsState(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <>
      {children}
      <View style={styles.container}>
        {toasts.map(toast => (
          <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </View>
    </>
  );
}

export function toast(message: string, type: ToastType = 'info', duration = 4000) {
  if (setToasts) {
    const id = (++toastId).toString();
    setToasts(prev => [...prev, { id, message, type, duration }]);
  }
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: Spacing.md,
    zIndex: 9999,
    paddingTop: 50,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    borderLeftWidth: 4,
    gap: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  message: {
    flex: 1,
    color: Colors.text.primary,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.medium,
  },
});
