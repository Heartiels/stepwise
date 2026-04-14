import { useLocalSearchParams, router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  Keyboard,
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
  logFocusSession,
  replaceSubtaskWithSteps,
  replaceSubtasks,
  setSubtaskToday,
  setSubtaskXP,
  updateSubtaskStatus,
  type Subtask,
} from "../../src/db/taskRepo";
import { breakStepIntoSmallerActions, editSteps } from "../../src/services/openai";
import { FocusSessionSheet } from "../../components/focus-session-sheet";
import { FloatToast } from "../../components/step-toast";
import { formatFocusDurationLabel } from "../../src/tasks/focus";

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

type ActiveSession = {
  subtaskId: string;
  action: string;
  explanation: string;
};

export default function TaskDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const task = useMemo(() => listTasks().find((t) => t.id === id) ?? null, [id]);
  const [subtasks, setSubtasks] = useState<Subtask[]>(() => listSubtasksForTask(id as string));
  const [revision, setRevision] = useState(0);

  let actionTips: string[] = [];
  try { actionTips = task?.notes ? JSON.parse(task.notes) : []; } catch { actionTips = []; }

  const [doneIds, setDoneIds] = useState<Set<string>>(
    () => new Set(subtasks.filter((s) => s.status === "done").map((s) => s.id))
  );
  const allDone = subtasks.length > 0 && doneIds.size === subtasks.length;
  const [screenToast, setScreenToast] = useState<{ xp: number; message: string } | null>(null);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [breakingStepId, setBreakingStepId] = useState<string | null>(null);

  function handleToggle(subtaskId: string, isDone: boolean): { xp: number; message: string } | null {
    let toastData: { xp: number; message: string } | null = null;

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
      toastData = { xp, message };
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
      if (isDone) {
        next.add(subtaskId);
      } else {
        next.delete(subtaskId);
      }
      return next;
    });

    return toastData;
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

  function syncSubtasks(nextSubtasks: Subtask[]) {
    setSubtasks(nextSubtasks);
    setDoneIds(new Set(nextSubtasks.filter((subtask) => subtask.status === "done").map((subtask) => subtask.id)));
  }

  function recordFocusSession(subtaskId: string, secondsSpent: number) {
    const safeSeconds = Math.max(0, Math.round(secondsSpent));
    if (safeSeconds <= 0) return;

    logFocusSession(subtaskId, safeSeconds);
    setSubtasks((prev) =>
      prev.map((subtask) =>
        subtask.id === subtaskId
          ? {
              ...subtask,
              focus_seconds: subtask.focus_seconds + safeSeconds,
              focus_sessions: subtask.focus_sessions + 1,
            }
          : subtask
      )
    );
  }

  function openFocusSession(subtask: Subtask) {
    setActiveSession({
      subtaskId: subtask.id,
      action: subtask.action,
      explanation: subtask.explanation,
    });
  }

  function closeFocusSession() {
    setActiveSession(null);
    setBreakingStepId(null);
  }

  function handleFocusDone(secondsSpent: number) {
    if (!activeSession) return;

    recordFocusSession(activeSession.subtaskId, secondsSpent);
    updateSubtaskStatus(activeSession.subtaskId, "done");
    const toastData = handleToggle(activeSession.subtaskId, true);
    if (toastData) setScreenToast(toastData);
    closeFocusSession();
  }

  async function handleFocusStuck(secondsSpent: number) {
    if (!task || !activeSession) return;

    const selectedIndex = subtasks.findIndex((subtask) => subtask.id === activeSession.subtaskId);
    if (selectedIndex === -1) {
      closeFocusSession();
      return;
    }

    setBreakingStepId(activeSession.subtaskId);
    try {
      recordFocusSession(activeSession.subtaskId, secondsSpent);
      const currentSteps = subtasks.map((subtask) => ({
        emoji: subtask.emoji,
        action: subtask.action,
        explanation: subtask.explanation,
      }));
      const updatedSteps = await breakStepIntoSmallerActions(task.title, currentSteps, selectedIndex);
      const nextSubtasks = replaceSubtaskWithSteps(
        task.id,
        activeSession.subtaskId,
        updatedSteps
      );

      syncSubtasks(nextSubtasks);
      setRevision((current) => current + 1);
      closeFocusSession();
      Alert.alert("Step updated", "I broke that step into smaller actions so it's easier to restart.");
    } catch (err: any) {
      Alert.alert("Couldn't revise this step", err?.message ?? "Please try again.");
      setBreakingStepId(null);
    }
  }

  const [menuVisible, setMenuVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedStepIds, setSelectedStepIds] = useState<Set<string>>(new Set());
  const [editInput, setEditInput] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardHeight(0)
    );
    return () => { show.remove(); hide.remove(); };
  }, []);

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

    const selectedIndices = subtasks
      .map((s, i) => (selectedStepIds.has(s.id) ? i : -1))
      .filter((i) => i !== -1);

    const currentSteps = subtasks.map((subtask) => ({
      emoji: subtask.emoji,
      action: subtask.action,
      explanation: subtask.explanation,
    }));

    setEditLoading(true);
    try {
      const newSteps = await editSteps(task.title, currentSteps, selectedIndices, editInput.trim());

      const selectedSet = new Set(selectedIndices);
      const llmCount = newSteps.length - (subtasks.length - selectedIndices.length);
      const selectedFocusSeconds = subtasks
        .filter((subtask) => selectedStepIds.has(subtask.id))
        .reduce((sum, subtask) => sum + subtask.focus_seconds, 0);
      const selectedFocusSessions = subtasks
        .filter((subtask) => selectedStepIds.has(subtask.id))
        .reduce((sum, subtask) => sum + subtask.focus_sessions, 0);
      const stepMeta: {
        status: string;
        completed_at: number | null;
        focus_seconds: number;
        focus_sessions: number;
        is_today: number;
      }[] = [];
      let llmInserted = false;
      for (let i = 0; i < subtasks.length; i++) {
        if (selectedSet.has(i)) {
          if (!llmInserted) {
            for (let j = 0; j < llmCount; j++) {
              stepMeta.push({
                status: "todo",
                completed_at: null,
                focus_seconds: j === 0 ? selectedFocusSeconds : 0,
                focus_sessions: j === 0 ? selectedFocusSessions : 0,
                is_today: 0,
              });
            }
            llmInserted = true;
          }
        } else {
          stepMeta.push({
            status: subtasks[i].status,
            completed_at: subtasks[i].completed_at ?? null,
            focus_seconds: subtasks[i].focus_seconds ?? 0,
            focus_sessions: subtasks[i].focus_sessions ?? 0,
            is_today: subtasks[i].is_today ?? 0,
          });
        }
      }

      replaceSubtasks(
        task.id,
        newSteps.map((s, i) => ({
          emoji: s.emoji,
          action: s.action,
          explanation: s.explanation,
          ord: i,
          status: stepMeta[i]?.status ?? "todo",
          completed_at: stepMeta[i]?.completed_at ?? null,
          focus_seconds: stepMeta[i]?.focus_seconds ?? 0,
          focus_sessions: stepMeta[i]?.focus_sessions ?? 0,
          is_today: stepMeta[i]?.is_today ?? 0,
        }))
      );

      const updated = listSubtasksForTask(task.id);
      syncSubtasks(updated);
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
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  }

  const stampScale = useRef(new Animated.Value(3)).current;
  const stampOpacity = useRef(new Animated.Value(0)).current;
  const stampRotate = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    if (allDone) {
      stampScale.setValue(3);
      stampOpacity.setValue(0);
      stampRotate.setValue(-20);
      Animated.parallel([
        Animated.spring(stampScale, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
        Animated.timing(stampOpacity, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.spring(stampRotate, { toValue: -12, friction: 5, tension: 100, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.timing(stampOpacity, { toValue: 0, duration: 150, useNativeDriver: true }).start();
    }
  }, [allDone]);

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
      {screenToast && (
        <FloatToast
          xp={screenToast.xp}
          message={screenToast.message}
          onHide={() => setScreenToast(null)}
          anchorTop={116}
        />
      )}
      {activeSession && task && (
        <FocusSessionSheet
          visible={!!activeSession}
          taskTitle={task.title}
          action={activeSession.action}
          explanation={activeSession.explanation}
          loadingStuck={breakingStepId === activeSession.subtaskId}
          onClose={closeFocusSession}
          onLogSession={(seconds) => recordFocusSession(activeSession.subtaskId, seconds)}
          onDone={handleFocusDone}
          onStuck={handleFocusStuck}
        />
      )}

      <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
        <Ionicons name="chevron-back" size={22} color="#18181b" />
        <Text style={styles.backText}>Goals</Text>
      </Pressable>

      <Pressable onPress={() => setMenuVisible((v) => !v)} style={styles.moreBtn} hitSlop={8}>
        <View style={styles.moreCircle}>
          <Ionicons name="ellipsis-horizontal" size={16} color="#18181b" />
        </View>
      </Pressable>

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
              onStart={openFocusSession}
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

      <Animated.View
        pointerEvents="none"
        style={[styles.stamp, { opacity: stampOpacity, transform: [{ scale: stampScale }, { rotate: stampRotateDeg }] }]}
      >
        <Text style={styles.stampText}>ALL DONE!</Text>
      </Animated.View>

      {editMode && (
        <View style={[styles.editSheet, { bottom: keyboardHeight }]}>
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

          <Text style={styles.editInstruction}>
            Select steps to narrow the scope
          </Text>

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
        </View>
      )}
    </View>
  );
}

function StepCard({
  subtask, index, onToggle, onToggleToday, onStart, editMode, selected, onSelect,
}: {
  subtask: Subtask;
  index: number;
  onToggle: (id: string, isDone: boolean) => { xp: number; message: string } | null;
  onToggleToday: (id: string) => void;
  onStart: (subtask: Subtask) => void;
  editMode: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(12)).current;
  const swipeRef = useRef<Swipeable>(null);
  const [done, setDone] = useState(subtask.status === "done");
  const [floatToast, setFloatToast] = useState<{ xp: number; message: string } | null>(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(y, { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    setDone(subtask.status === "done");
  }, [subtask.status]);

  function handleToggle() {
    const next = !done;
    setDone(next);
    updateSubtaskStatus(subtask.id, next ? "done" : "todo");
    const toastData = onToggle(subtask.id, next);
    if (toastData) setFloatToast(toastData);
    swipeRef.current?.close();
  }

  const renderRightAction = () => (
    <View style={[styles.swipeAction, done && styles.swipeActionUndo]}>
      <Ionicons name={done ? "refresh-outline" : "close"} size={22} color="#fff" />
      <Text style={styles.swipeActionText}>{done ? "Undo" : "Done"}</Text>
    </View>
  );

  const { emoji, action, explanation } = subtask;

  const cardContent = (
    <View style={styles.stepCardInner}>
      {floatToast && (
        <FloatToast
          xp={floatToast.xp}
          message={floatToast.message}
          onHide={() => setFloatToast(null)}
        />
      )}

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
            {action}
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

      {subtask.focus_sessions > 0 && (
        <View style={styles.focusMetaRow}>
          <View style={styles.focusMetaBadge}>
            <Ionicons name="timer-outline" size={12} color="#c2410c" />
            <Text style={styles.focusMetaText}>
              {formatFocusDurationLabel(subtask.focus_seconds)} · {subtask.focus_sessions} session{subtask.focus_sessions > 1 ? "s" : ""}
            </Text>
          </View>
        </View>
      )}

      {!editMode && !done && (
        <View style={styles.stepUtilityRow}>
          <Pressable onPress={() => onStart(subtask)} style={styles.startNowBtn}>
            <Ionicons name="flash" size={14} color="#c2410c" />
            <Text style={styles.startNowBtnText}>Start now</Text>
          </Pressable>
        </View>
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
  stepCardInner: {
    gap: 12,
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
  stepUtilityRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  startNowBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  startNowBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#c2410c",
  },
  focusMetaRow: {
    flexDirection: "row",
  },
  focusMetaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff7ed",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  focusMetaText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#c2410c",
  },

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
  editInputExpanded: { minHeight: 120 },
});
