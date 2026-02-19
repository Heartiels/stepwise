import { useLocalSearchParams, router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { Ionicons } from "@expo/vector-icons";
import {
  listSubtasksForTask,
  listTasks,
  updateSubtaskStatus,
  type Subtask,
} from "../../src/db/taskRepo";

// How long to wait for the screen slide-in to finish before revealing steps
const TRANSITION_DELAY = 380;
// Gap between each step appearing
const STEP_INTERVAL = 130;

export default function TaskDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const task = useMemo(
    () => listTasks().find((t) => t.id === id) ?? null,
    [id]
  );
  const subtasks = useMemo(() => listSubtasksForTask(id as string), [id]);

  let actionTips: string[] = [];
  try {
    actionTips = task?.notes ? JSON.parse(task.notes) : [];
  } catch {
    actionTips = [];
  }

  // Track which steps are done to know when all are complete
  const [doneIds, setDoneIds] = useState<Set<string>>(
    () => new Set(subtasks.filter((s) => s.status === "done").map((s) => s.id))
  );
  const allDone = subtasks.length > 0 && doneIds.size === subtasks.length;

  function handleToggle(subtaskId: string, isDone: boolean) {
    setDoneIds((prev) => {
      const next = new Set(prev);
      isDone ? next.add(subtaskId) : next.delete(subtaskId);
      return next;
    });
  }

  // Stamp animation
  const stampScale = useRef(new Animated.Value(3)).current;
  const stampOpacity = useRef(new Animated.Value(0)).current;
  const stampRotate = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    if (allDone) {
      stampScale.setValue(3);
      stampOpacity.setValue(0);
      stampRotate.setValue(-20);
      Animated.parallel([
        Animated.spring(stampScale, {
          toValue: 1,
          friction: 4,
          tension: 120,
          useNativeDriver: true,
        }),
        Animated.timing(stampOpacity, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.spring(stampRotate, {
          toValue: -12,
          friction: 5,
          tension: 100,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.timing(stampOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [allDone]);

  // visibleCount controls how many steps are rendered.
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    setVisibleCount(0);
    let count = 0;
    let interval: ReturnType<typeof setInterval>;

    const startTimer = setTimeout(() => {
      interval = setInterval(() => {
        count += 1;
        setVisibleCount(count);
        if (count >= subtasks.length + 1) clearInterval(interval);
      }, STEP_INTERVAL);
    }, TRANSITION_DELAY);

    return () => {
      clearTimeout(startTimer);
      clearInterval(interval);
    };
  }, [id]);

  const stampRotateDeg = stampRotate.interpolate({
    inputRange: [-20, -12],
    outputRange: ["-20deg", "-12deg"],
  });

  return (
    <View style={styles.screen}>
      <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
        <Ionicons name="chevron-back" size={22} color="#18181b" />
        <Text style={styles.backText}>Goals</Text>
      </Pressable>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.goalTitle}>{task?.title}</Text>

        <View style={styles.stepsContainer}>
          {subtasks.slice(0, visibleCount).map((sub, idx) => (
            <StepCard
              key={sub.id}
              subtask={sub}
              index={idx}
              onToggle={handleToggle}
            />
          ))}
        </View>

        {visibleCount > subtasks.length && actionTips.length > 0 && (
          <TipsCard tips={actionTips} />
        )}
      </ScrollView>

      {/* All-done stamp */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.stamp,
          {
            opacity: stampOpacity,
            transform: [{ scale: stampScale }, { rotate: stampRotateDeg }],
          },
        ]}
      >
        <Text style={styles.stampText}>ALL DONE!</Text>
      </Animated.View>
    </View>
  );
}

// Each card owns its fade-in + swipe-to-complete gesture
function StepCard({ subtask, index, onToggle }: { subtask: Subtask; index: number; onToggle: (id: string, isDone: boolean) => void }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(12)).current;
  const swipeRef = useRef<Swipeable>(null);
  const [done, setDone] = useState(subtask.status === "done");

  // Entrance animation on mount
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(y, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  function handleToggle() {
    const next = !done;
    setDone(next);
    updateSubtaskStatus(subtask.id, next ? "done" : "todo");
    onToggle(subtask.id, next);
    swipeRef.current?.close();
  }

  const renderRightAction = () => (
    <View style={[styles.swipeAction, done && styles.swipeActionUndo]}>
      <Ionicons name={done ? "refresh-outline" : "close"} size={22} color="#fff" />
      <Text style={styles.swipeActionText}>{done ? "Undo" : "Done"}</Text>
    </View>
  );

  const [emoji, action, explanation] = subtask.title.split("\n");

  return (
    <Animated.View style={{ opacity, transform: [{ translateY: y }] }}>
      <Swipeable
        ref={swipeRef}
        renderRightActions={renderRightAction}
        onSwipeableOpen={handleToggle}
        rightThreshold={60}
        overshootRight={false}
        containerStyle={styles.stepCard}
      >
        <View style={styles.stepRow}>
          <View style={[styles.stepBadge, done && styles.stepBadgeDone]}>
            {done
              ? <Ionicons name="close" size={14} color="#fff" />
              : <Text style={styles.stepBadgeText}>{index + 1}</Text>
            }
          </View>
          <View style={styles.stepContent}>
            <Text style={[styles.stepAction, done && styles.stepTextDone]}>
              <Text style={[styles.stepEmoji, done && styles.stepTextDone]}>{emoji ?? "•"} </Text>
              {action ?? subtask.title}
            </Text>
            {!!explanation && (
              <Text style={[styles.stepExplanation, done && styles.stepTextDone]}>{explanation}</Text>
            )}
          </View>
        </View>
      </Swipeable>
    </Animated.View>
  );
}

function TipsCard({ tips }: { tips: string[] }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(y, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[styles.tipsCard, { opacity, transform: [{ translateY: y }] }]}
    >
      <Text style={styles.tipsLabel}>💡 Action Tips</Text>
      {tips.map((tip, i) => (
        <Text key={i} style={styles.tipText}>
          • {tip}
        </Text>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f9f9fb" },

  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    position: "absolute",
    top: 52,
    left: 16,
    zIndex: 10,
    gap: 2,
  },
  backText: { fontSize: 16, color: "#18181b", fontWeight: "500" },

  scroll: {
    paddingHorizontal: 20,
    paddingTop: 100,
    paddingBottom: 60,
  },

  goalTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#18181b",
    lineHeight: 32,
    marginBottom: 24,
    letterSpacing: -0.3,
  },

  stepsContainer: { gap: 10 },

  stepCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#18181b",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    flexShrink: 0,
  },
  stepBadgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  stepBadgeDone: { backgroundColor: "#ef4444" },
  swipeAction: {
    backgroundColor: "#ef4444",
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    borderRadius: 16,
    gap: 3,
  },
  swipeActionUndo: { backgroundColor: "#a1a1aa" },
  swipeActionText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  stepTextDone: {
    color: "#c4c4c4",
    textDecorationLine: "line-through",
  },
  stepContent: { flex: 1, gap: 2 },
  stepEmoji: { fontSize: 18, marginBottom: 2 },
  stepAction: {
    fontSize: 14,
    fontWeight: "600",
    color: "#18181b",
    lineHeight: 20,
  },
  stepExplanation: {
    fontSize: 12,
    color: "#71717a",
    lineHeight: 18,
    marginTop: 3,
  },

  tipsCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    padding: 14,
    marginTop: 16,
    gap: 6,
  },
  tipsLabel: { fontSize: 13, fontWeight: "700", color: "#71717a", marginBottom: 4 },
  tipText: { fontSize: 13, color: "#52525b", lineHeight: 20 },

  stamp: {
    position: "absolute",
    top: "40%",
    alignSelf: "center",
    borderWidth: 4,
    borderColor: "#dc2626",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: "transparent",
  },
  stampText: {
    fontSize: 36,
    fontWeight: "900",
    color: "#dc2626",
    letterSpacing: 4,
    textTransform: "uppercase",
  },
});
