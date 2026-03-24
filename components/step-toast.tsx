import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

type StepToastProps = {
  visible: boolean;
  xp: number;
  message: string;
  onHide: () => void;
};

export function StepToast({ visible, xp, message, onHide }: StepToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-60)).current;

  useEffect(() => {
    if (!visible) return;

    opacity.setValue(0);
    translateY.setValue(-60);

    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => {
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 280, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: -20, duration: 280, useNativeDriver: true }),
        ]).start(() => onHide());
      }, 1800);
    });
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.toast, { opacity, transform: [{ translateY }] }]}>
      <Text style={styles.emoji}>👍</Text>
      <View style={styles.textBlock}>
        <Text style={styles.message}>{message}</Text>
        <Text style={styles.xp}>+{xp} XP</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    top: 64,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#18181b",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 10,
    zIndex: 999,
  },
  emoji: {
    fontSize: 32,
  },
  textBlock: {
    gap: 2,
  },
  message: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  xp: {
    color: "#facc15",
    fontSize: 14,
    fontWeight: "600",
  },
});
