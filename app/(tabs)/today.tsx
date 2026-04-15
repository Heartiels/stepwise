import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  listSubtasksForTask,
  listTodaySubtasks,
  logFocusSession,
  replaceSubtaskWithSteps,
  setSubtaskToday,
  setSubtaskXP,
  updateSubtaskStatus,
  type TodaySubtask,
} from "../../src/db/taskRepo";
import { breakStepIntoSmallerActions } from "../../src/services/openai";
import { FocusSessionSheet } from "../../components/focus-session-sheet";
import { FloatToast } from "../../components/step-toast";

const MID_MESSAGES = [
  "Nice work!", "Keep it up!", "One step closer!",
  "Small wins add up!", "You're making progress!",
  "Strong momentum!", "Good progress!", "Way to go!",
];

type ActiveTodaySession = {
  subtaskId: string;
  taskId: string;
  taskTitle: string;
  action: string;
  explanation: string;
};

export default function TodayScreen() {
  const [subtasks, setSubtasks] = useState<TodaySubtask[]>([]);
  const [activeSession, setActiveSession] = useState<ActiveTodaySession | null>(null);
  const [breakingStepId, setBreakingStepId] = useState<string | null>(null);
  const [screenToast, setScreenToast] = useState<{ xp: number; message: string } | null>(null);

  const refreshToday = useCallback(() => {
    setSubtasks(listTodaySubtasks().filter((subtask) => subtask.status !== "done"));
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshToday();
    }, [refreshToday])
  );

  function handleRemove(subtaskId: string) {
    setSubtaskToday(subtaskId, false);
    setSubtasks((prev) => prev.filter((subtask) => subtask.id !== subtaskId));
  }

  function handleDone(
    subtaskId: string,
    onAnimationEnd: () => void
  ): { xp: number; message: string } {
    const xp = 2;
    const message = MID_MESSAGES[Math.floor(Math.random() * MID_MESSAGES.length)];
    setSubtaskXP(subtaskId, xp);
    updateSubtaskStatus(subtaskId, "done");

    setTimeout(() => {
      onAnimationEnd();
      setSubtasks((prev) => prev.filter((subtask) => subtask.id !== subtaskId));
    }, 700);

    return { xp, message };
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

  function openFocusSession(subtask: TodaySubtask) {
    setActiveSession({
      subtaskId: subtask.id,
      taskId: subtask.task_id,
      taskTitle: subtask.task_title,
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
    const toast = handleDone(activeSession.subtaskId, () => setScreenToast(null));
    setScreenToast(toast);
    closeFocusSession();
  }

  async function handleFocusStuck(secondsSpent: number) {
    if (!activeSession) return;

    setBreakingStepId(activeSession.subtaskId);
    try {
      recordFocusSession(activeSession.subtaskId, secondsSpent);
      const currentTaskSubtasks = listSubtasksForTask(activeSession.taskId);
      const selectedIndex = currentTaskSubtasks.findIndex((subtask) => subtask.id === activeSession.subtaskId);

      if (selectedIndex === -1) {
        closeFocusSession();
        return;
      }

      const currentSteps = currentTaskSubtasks.map((subtask) => ({
        emoji: subtask.emoji,
        action: subtask.action,
        explanation: subtask.explanation,
      }));
      const updatedSteps = await breakStepIntoSmallerActions(
        activeSession.taskTitle,
        currentSteps,
        selectedIndex
      );

      replaceSubtaskWithSteps(
        activeSession.taskId,
        activeSession.subtaskId,
        updatedSteps
      );

      refreshToday();
      closeFocusSession();
      Alert.alert("Step updated", "I broke that Today step into smaller actions so you can restart faster.");
    } catch (err: any) {
      Alert.alert("Couldn't revise this step", err?.message ?? "Please try again.");
      setBreakingStepId(null);
    }
  }

  return (
    <View style={styles.screen}>
      {screenToast && (
        <FloatToast
          xp={screenToast.xp}
          message={screenToast.message}
          onHide={() => setScreenToast(null)}
          anchorTop={84}
        />
      )}
      {activeSession && (
        <FocusSessionSheet
          visible={!!activeSession}
          taskTitle={activeSession.taskTitle}
          action={activeSession.action}
          explanation={activeSession.explanation}
          loadingStuck={breakingStepId === activeSession.subtaskId}
          onClose={closeFocusSession}
          onLogSession={(seconds) => recordFocusSession(activeSession.subtaskId, seconds)}
          onDone={handleFocusDone}
          onStuck={handleFocusStuck}
        />
      )}

      <View style={styles.header}>
        <Text style={styles.pageTitle}>Today</Text>
        <Text style={styles.pageSub}>Focus on the next small step.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {subtasks.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>Today</Text>
            <Text style={styles.emptyTitle}>Nothing marked for today yet</Text>
            <Text style={styles.emptyText}>
              Open a goal and tap the bookmark icon on a step to bring it here.
            </Text>
          </View>
        ) : (
          subtasks.map((subtask) => (
            <TodayCard
              key={subtask.id}
              subtask={subtask}
              onOpen={() => router.push(`/task/${subtask.task_id}`)}
              onRemove={() => handleRemove(subtask.id)}
              onDone={(onAnimationEnd) => handleDone(subtask.id, onAnimationEnd)}
              onStart={() => openFocusSession(subtask)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function TodayCard({
  subtask,
  onOpen,
  onRemove,
  onDone,
  onStart,
}: {
  subtask: TodaySubtask;
  onOpen: () => void;
  onRemove: () => void;
  onDone: (onAnimationEnd: () => void) => { xp: number; message: string };
  onStart: () => void;
}) {
  const { emoji, action, explanation } = subtask;
  const [floatToast, setFloatToast] = useState<{ xp: number; message: string } | null>(null);

  return (
    <Pressable style={[styles.card, { position: "relative" }]} onPress={onOpen}>
      {floatToast && (
        <FloatToast
          xp={floatToast.xp}
          message={floatToast.message}
          onHide={() => setFloatToast(null)}
          anchorTop={52}
        />
      )}

      <View style={styles.cardTop}>
        <View style={styles.taskMeta}>
          <View style={styles.todayBadge}>
            <Ionicons name="bookmark" size={12} color="#f97316" />
            <Text style={styles.todayBadgeText}>Today</Text>
          </View>
          <Text style={styles.taskTitle} numberOfLines={1}>
            {subtask.task_title}
          </Text>
        </View>
        <View style={styles.cardTopRight}>
          <Pressable onPress={onStart} hitSlop={8}>
            <Ionicons name="timer-outline" size={20} color="#a1a1aa" />
          </Pressable>
          <Ionicons name="chevron-forward" size={16} color="#a1a1aa" />
        </View>
      </View>

      <Text style={styles.stepAction}>
        <Text style={styles.stepEmoji}>{emoji ?? "•"} </Text>
        {action}
      </Text>
      {!!explanation && <Text style={styles.stepExplanation}>{explanation}</Text>}

      <View style={styles.actionRow}>
        <Pressable onPress={onRemove} style={[styles.actionBtn, styles.secondaryBtn]}>
          <Text style={styles.secondaryBtnText}>Remove</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            const toast = onDone(() => setFloatToast(null));
            setFloatToast(toast);
          }}
          style={[styles.actionBtn, styles.primaryBtn]}
        >
          <Text style={styles.primaryBtnText}>Done</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f9f9fb" },
  header: {
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 20,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#18181b",
    letterSpacing: -0.3,
  },
  pageSub: {
    marginTop: 4,
    fontSize: 13,
    color: "#71717a",
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 80,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 120,
    gap: 10,
    paddingHorizontal: 24,
  },
  emptyEmoji: {
    fontSize: 28,
    fontWeight: "800",
    color: "#f97316",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#18181b",
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#a1a1aa",
    textAlign: "center",
    lineHeight: 20,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 12,
  },
  cardTopRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  taskMeta: {
    flex: 1,
    gap: 8,
  },
  todayBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    backgroundColor: "#ffedd5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  todayBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#f97316",
  },
  taskTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#71717a",
  },
  stepAction: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "700",
    color: "#18181b",
  },
  stepEmoji: {
    fontSize: 20,
  },
  stepExplanation: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: "#71717a",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryBtn: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e4e4e7",
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#71717a",
  },
  primaryBtn: {
    backgroundColor: "#18181b",
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
});
