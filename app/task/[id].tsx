import { useLocalSearchParams, router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { Ionicons } from "@expo/vector-icons";
import {
  listSubtasksForTask,
  listTasks,
  replaceSubtasks,
  setSubtaskToday,
  setSubtaskXP,
  updateSubtaskStatus,
  type Subtask,
} from "../../src/db/taskRepo";
import { editSteps } from "../../src/services/openai";
import { StepToast } from "../../components/step-toast";

const MID_MESSAGES = [
  "Nice work!",
  "Keep it up!",
  "One step closer!",
  "Small wins add up!",
  "You're making progress!",
  "Strong momentum!",
  "Good progress!",
  "Way to go!",
];

const TRANSITION_DELAY = 380;
const STEP_INTERVAL = 130;

export default function TaskDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const task = useMemo(() => listTasks().find((t) => t.id === id) ?? null, [id]);
  const [subtasks, setSubtasks] = useState<Subtask[]>(() => listSubtasksForTask(id as string));
  const [revision, setRevision] = useState(0); // bumping triggers animation replay

  let actionTips: string[] = [];
  try { actionTips = task?.notes ? JSON.parse(task.notes) : []; } catch { actionTips = []; }

  const [doneIds, setDoneIds] = useState<Set<string>>(
    () => new Set(subtasks.filter((s) => s.status === "done").map((s) => s.id))
  );
  const allDone = subtasks.length > 0 && doneIds.size === subtasks.length;

  const [toast, setToast] = useState<{ xp: number; message: string } | null>(null);

  function handleToggle(subtaskId: string, isDone: boolean) {
    if (isDone) {
      const prevDoneCount = doneIds.size;
      const totalCount = subtasks.length;
      const remainingAfter = totalCount - prevDoneCount - 1;

      let xp = 2;
      let message: string;

      if (prevDoneCount === 0) {
        message = "Great start!";
      } else if (remainingAfter === 0) {
        xp = 5;
        message = "Goal complete!";
      } else if (remainingAfter === 1) {
        message = "Just one step left!";
      } else {
        message = MID_MESSAGES[Math.floor(Math.random() * MID_MESSAGES.length)];
      }

      setSubtaskXP(subtaskId, xp);
      setToast({ xp, message });
    }

    setSubtasks((prev) =>
      prev.map((subtask) =>
        subtask.id === subtaskId
          ? {
              ...subtask,
              status: isDone ? "done" : "todo",
              completed_at: isDone ? Date.now() : null,
              is_today: isDone ? 0 : subtask.is_today,
            }
          : subtask
      )
    );

    setDoneIds((prev) => {
      const next = new Set(prev);
      isDone ? next.add(subtaskId) : next.delete(subtaskId);
      return next;
    });
  }

  function handleToggleToday(subtaskId: string) {
    const current = subtasks.find((subtask) => subtask.id === subtaskId);
    if (!current) return;

    const nextIsToday = current.is_today ? 0 : 1;
    setSubtaskToday(subtaskId, nextIsToday === 1);
    setSubtasks((prev) =>
      prev.map((subtask) =>
        subtask.id === subtaskId ? { ...subtask, is_today: nextIsToday } : subtask
      )
    );
  }

  // ── More menu ──────────────────────────────────────────────────────────────
  const [menuVisible, setMenuVisible] = useState(false);

  // ── Edit mode ──────────────────────────────────────────────────────────────
  const [editMode, setEditMode] = useState(false);
  const [selectedStepIds, setSelectedStepIds] = useState<Set<string>>(new Set());
  const [editInput, setEditInput] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const [editLoading, setEditLoading] = useState(false);

  function enterEditMode() {
    setMenuVisible(false);
    setEditMode(true);
    setSelectedStepIds(new Set());
    setEditInput("");
    setInputFocused(false);
  }

  function exitEditMode() {
    setEditMode(false);
    setSelectedStepIds(new Set());
    setEditInput("");
    setInputFocused(false);
  }

  async function handleStartEditing() {
    if (!editInput.trim()) {
      Alert.alert("Please describe what changes you want.");
      return;
    }
    if (!task) return;

    // Map selected IDs to 0-based indices
    const selectedIndices = subtasks
      .map((s, i) => (selectedStepIds.has(s.id) ? i : -1))
      .filter((i) => i !== -1);

    // Parse current subtasks into DecomposedStep format
    const currentSteps = subtasks.map((s) => {
      const [emoji, action, explanation] = s.title.split("\n");
      return { emoji: emoji ?? "", action: action ?? "", explanation: explanation ?? "" };
    });

    setEditLoading(true);
    try {
      const newSteps = await editSteps(task.title, currentSteps, selectedIndices, editInput.trim());

      // Compute per-step status: non-selected steps preserve their original status,
      // LLM-generated replacements start as 'todo'.
      const selectedSet = new Set(selectedIndices);
      const llmCount = newSteps.length - (subtasks.length - selectedIndices.length);
      const stepMeta: { status: string; completed_at: number | null; is_today: number }[] = [];
      let llmInserted = false;
      for (let i = 0; i < subtasks.length; i++) {
        if (selectedSet.has(i)) {
          if (!llmInserted) {
            for (let j = 0; j < llmCount; j++) {
              stepMeta.push({ status: "todo", completed_at: null, is_today: 0 });
            }
            llmInserted = true;
          }
        } else {
          stepMeta.push({
            status: subtasks[i].status,
            completed_at: subtasks[i].completed_at ?? null,
            is_today: subtasks[i].is_today ?? 0,
          });
        }
      }

      replaceSubtasks(
        task.id,
        newSteps.map((s, i) => ({
          title: `${s.emoji}\n${s.action}\n${s.explanation}`,
          ord: i,
          status: stepMeta[i]?.status ?? "todo",
          completed_at: stepMeta[i]?.completed_at ?? null,
          is_today: stepMeta[i]?.is_today ?? 0,
        }))
      );

      const updated = listSubtasksForTask(task.id);
      setSubtasks(updated);
      setDoneIds(new Set(updated.filter((s) => s.status === "done").map((s) => s.id)));
      setRevision((r) => r + 1);
      exitEditMode();
    } catch (err: any) {
      Alert.alert("Something went wrong", err?.message ?? "Please try again.");
    } finally {
      setEditLoading(false);
    }
  }

  function toggleStepSelect(stepId: string) {
    setSelectedStepIds((prev) => {
      const next = new Set(prev);
      next.has(stepId) ? next.delete(stepId) : next.add(stepId);
      return next;
    });
  }

  // ── Stamp animation ────────────────────────────────────────────────────────
  const stampScale = useRef(new Animated.Value(3)).current;
  const stampOpacity = useRef(new Animated.Value(0)).current;
  const stampRotate = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    if (allDone) {
      stampScale.setValue(3); stampOpacity.setValue(0); stampRotate.setValue(-20);
      Animated.parallel([
        Animated.spring(stampScale, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
        Animated.timing(stampOpacity, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.spring(stampRotate, { toValue: -12, friction: 5, tension: 100, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.timing(stampOpacity, { toValue: 0, duration: 150, useNativeDriver: true }).start();
    }
  }, [allDone]);

  // ── Step reveal ────────────────────────────────────────────────────────────
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
    return () => { clearTimeout(startTimer); clearInterval(interval); };
  }, [id, revision]);

  const stampRotateDeg = stampRotate.interpolate({
    inputRange: [-20, -12],
    outputRange: ["-20deg", "-12deg"],
  });

  return (
    <View style={styles.screen}>
      {toast && (
        <StepToast
          visible={!!toast}
          xp={toast.xp}
          message={toast.message}
          onHide={() => setToast(null)}
        />
      )}

      {/* ── Back button ───────────────────────────────────────────────── */}
      <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
        <Ionicons name="chevron-back" size={22} color="#18181b" />
        <Text style={styles.backText}>Goals</Text>
      </Pressable>

      {/* ── More button ───────────────────────────────────────────────── */}
      <Pressable onPress={() => setMenuVisible((v) => !v)} style={styles.moreBtn} hitSlop={8}>
        <View style={styles.moreCircle}>
          <Ionicons name="ellipsis-horizontal" size={16} color="#18181b" />
        </View>
      </Pressable>

      {/* ── Dropdown menu ─────────────────────────────────────────────── */}
      {menuVisible && (
        <>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setMenuVisible(false)} />
          <View style={styles.dropdownMenu}>
            <Pressable style={styles.dropdownItem} onPress={enterEditMode}>
              <Ionicons name="create-outline" size={16} color="#18181b" />
              <Text style={styles.dropdownItemText}>Edit Steps</Text>
            </Pressable>
          </View>
        </>
      )}

      {/* ── Scroll content ────────────────────────────────────────────── */}
      <ScrollView
        contentContainerStyle={[styles.scroll, editMode && { paddingBottom: 260 }]}
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
              onToggleToday={handleToggleToday}
              editMode={editMode}
              selected={selectedStepIds.has(sub.id)}
              onSelect={() => toggleStepSelect(sub.id)}
            />
          ))}
        </View>

        {visibleCount > subtasks.length && actionTips.length > 0 && (
          <TipsCard tips={actionTips} />
        )}
      </ScrollView>

      {/* ── All-done stamp ────────────────────────────────────────────── */}
      <Animated.View
        pointerEvents="none"
        style={[styles.stamp, { opacity: stampOpacity, transform: [{ scale: stampScale }, { rotate: stampRotateDeg }] }]}
      >
        <Text style={styles.stampText}>ALL DONE!</Text>
      </Animated.View>

      {/* ── Edit mode bottom sheet ────────────────────────────────────── */}
      {editMode && (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.editSheet}
        >
          {/* Header row */}
          <View style={styles.editSheetHeader}>
            <Pressable onPress={exitEditMode} hitSlop={8}>
              <Text style={styles.editCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.editStartBtn, editLoading && { opacity: 0.6 }]}
              onPress={handleStartEditing}
              disabled={editLoading}
              hitSlop={8}
            >
              <Text style={styles.editStartText}>
                {editLoading ? "Editing…" : "Start Editing"}
              </Text>
            </Pressable>
          </View>

          {/* Instruction */}
          <Text style={styles.editInstruction}>
            Select steps to narrow the scope
          </Text>

          {/* Input */}
          <TextInput
            style={[styles.editInput, inputFocused && styles.editInputExpanded]}
            value={editInput}
            onChangeText={setEditInput}
            placeholder={
              inputFocused
                ? "e.g.\n- Break each step into 3 smaller sub-steps\n- I want to finish dinner before this step\n- Reschedule the time"
                : "What changes do you want to make..."
            }
            placeholderTextColor="#a1a1aa"
            multiline
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
          />
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

// ─── Step Card ────────────────────────────────────────────────────────────────

function StepCard({
  subtask, index, onToggle, onToggleToday, editMode, selected, onSelect,
}: {
  subtask: Subtask;
  index: number;
  onToggle: (id: string, isDone: boolean) => void;
  onToggleToday: (id: string) => void;
  editMode: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(12)).current;
  const swipeRef = useRef<Swipeable>(null);
  const [done, setDone] = useState(subtask.status === "done");

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(y, { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
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

  const cardContent = (
    <View style={styles.stepRow}>
      <View style={[styles.stepBadge, done && !editMode && styles.stepBadgeDone]}>
        {done && !editMode
          ? <Ionicons name="close" size={14} color="#fff" />
          : <Text style={styles.stepBadgeText}>{index + 1}</Text>
        }
      </View>
      <View style={styles.stepContent}>
        <Text style={[styles.stepAction, done && !editMode && styles.stepTextDone]}>
          <Text style={[styles.stepEmoji, done && !editMode && styles.stepTextDone]}>{emoji ?? "•"} </Text>
          {action ?? subtask.title}
        </Text>
        {!!explanation && (
          <Text style={[styles.stepExplanation, done && !editMode && styles.stepTextDone]}>{explanation}</Text>
        )}
      </View>
      {!editMode && !done && (
        <Pressable
          onPress={() => onToggleToday(subtask.id)}
          hitSlop={8}
          style={styles.todayBtn}
        >
          <Ionicons
            name={subtask.is_today ? "bookmark" : "bookmark-outline"}
            size={18}
            color={subtask.is_today ? "#f97316" : "#a1a1aa"}
          />
        </Pressable>
      )}
    </View>
  );

  if (editMode) {
    return (
      <Animated.View style={{ opacity, transform: [{ translateY: y }] }}>
        <Pressable
          onPress={onSelect}
          style={[styles.stepCard, selected && styles.stepCardSelected]}
        >
          {cardContent}
        </Pressable>
      </Animated.View>
    );
  }

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
        {cardContent}
      </Swipeable>
    </Animated.View>
  );
}

// ─── Tips Card ────────────────────────────────────────────────────────────────

function TipsCard({ tips }: { tips: string[] }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(y, { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.tipsCard, { opacity, transform: [{ translateY: y }] }]}>
      <Text style={styles.tipsLabel}>💡 Action Tips</Text>
      {tips.slice(0, 3).map((tip, i) => (
        <Text key={i} style={styles.tipText}>• {tip}</Text>
      ))}
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f9f9fb" },

  backBtn: {
    flexDirection: "row", alignItems: "center",
    position: "absolute", top: 52, left: 16, zIndex: 10, gap: 2,
  },
  backText: { fontSize: 16, color: "#18181b", fontWeight: "500" },

  moreBtn: { position: "absolute", top: 52, right: 16, zIndex: 10 },
  moreCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#f4f4f5",
    alignItems: "center", justifyContent: "center",
  },

  dropdownMenu: {
    position: "absolute", top: 90, right: 16, zIndex: 20,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1, borderColor: "#e4e4e7",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12,
    elevation: 8,
    minWidth: 160,
    overflow: "hidden",
  },
  dropdownItem: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 13, paddingHorizontal: 16,
  },
  dropdownItemText: { fontSize: 14, fontWeight: "500", color: "#18181b" },

  scroll: { paddingHorizontal: 20, paddingTop: 100, paddingBottom: 60 },

  goalTitle: {
    fontSize: 26, fontWeight: "800", color: "#18181b",
    lineHeight: 32, marginBottom: 24, letterSpacing: -0.3,
  },

  stepsContainer: { gap: 10 },

  stepCard: {
    backgroundColor: "#fff",
    borderRadius: 16, borderWidth: 1, borderColor: "#e4e4e7",
    padding: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  stepCardSelected: {
    borderColor: "#f97316", borderWidth: 2,
    shadowColor: "#f97316", shadowOpacity: 0.15,
  },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  stepBadge: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: "#18181b",
    alignItems: "center", justifyContent: "center", marginTop: 2, flexShrink: 0,
  },
  stepBadgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  stepBadgeDone: { backgroundColor: "#ef4444" },
  swipeAction: {
    backgroundColor: "#ef4444", justifyContent: "center", alignItems: "center",
    width: 80, borderRadius: 16, gap: 3,
  },
  swipeActionUndo: { backgroundColor: "#a1a1aa" },
  swipeActionText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  stepTextDone: { color: "#c4c4c4", textDecorationLine: "line-through" },
  stepContent: { flex: 1, gap: 2 },
  todayBtn: {
    width: 28,
    alignItems: "center",
    paddingTop: 2,
    flexShrink: 0,
  },
  stepEmoji: { fontSize: 18, marginBottom: 2 },
  stepAction: { fontSize: 14, fontWeight: "600", color: "#18181b", lineHeight: 20 },
  stepExplanation: { fontSize: 12, color: "#71717a", lineHeight: 18, marginTop: 3 },

  tipsCard: {
    backgroundColor: "#fff", borderRadius: 16, borderWidth: 1,
    borderColor: "#e4e4e7", padding: 14, marginTop: 16, gap: 6,
  },
  tipsLabel: { fontSize: 13, fontWeight: "700", color: "#71717a", marginBottom: 4 },
  tipText: { fontSize: 13, color: "#52525b", lineHeight: 20 },

  stamp: {
    position: "absolute", top: "40%", alignSelf: "center",
    borderWidth: 4, borderColor: "#dc2626", borderRadius: 8,
    paddingVertical: 12, paddingHorizontal: 24, backgroundColor: "transparent",
  },
  stampText: {
    fontSize: 36, fontWeight: "900", color: "#dc2626",
    letterSpacing: 4, textTransform: "uppercase",
  },

  // Edit mode bottom sheet
  editSheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderColor: "#e4e4e7",
    padding: 20, paddingBottom: 36,
    gap: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08, shadowRadius: 16, elevation: 10,
  },
  editSheetHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  editCancelText: { fontSize: 15, color: "#71717a", fontWeight: "500" },
  editStartBtn: {
    backgroundColor: "#18181b", borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 16,
  },
  editStartText: { fontSize: 14, fontWeight: "600", color: "#fff" },
  editInstruction: { fontSize: 13, color: "#71717a", fontWeight: "500" },
  editInput: {
    borderWidth: 1, borderColor: "#e4e4e7", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: "#18181b", minHeight: 44,
    textAlignVertical: "top",
  },
  editInputExpanded: { minHeight: 80 },
});
