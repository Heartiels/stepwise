import { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  addSubtasks,
  addTask,
  deleteTask,
  listSubtasksForTask,
  listTasks,
  updateTaskNotes,
  type Task,
  type Subtask,
} from "../../src/db/taskRepo";
import { Ionicons } from "@expo/vector-icons";
import { decomposeTask, type DecomposedTask } from "../../src/services/openai";
import { Input } from "../../components/ui/input";
import { Card } from "../../components/ui/card";

// ─── Types ────────────────────────────────────────────────────────────────────

type TaskWithSteps = Task & {
  subtasks: Subtask[];
  actionTips: string[];
};

// ─── Home Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const [modalVisible, setModalVisible] = useState(true);
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  // Load tasks + their subtasks whenever tick changes, completed ones sorted to bottom
  const tasks = useMemo<TaskWithSteps[]>(() => {
    try {
      const raw = listTasks();
      const mapped = raw.map((t) => {
        const subtasks = listSubtasksForTask(t.id);
        let actionTips: string[] = [];
        try {
          actionTips = t.notes ? JSON.parse(t.notes) : [];
        } catch {
          actionTips = [];
        }
        return { ...t, subtasks, actionTips };
      });
      // Stable sort: incomplete first, all-done at the bottom
      return mapped.sort((a, b) => {
        const aDone = a.subtasks.length > 0 && a.subtasks.every((s) => s.status === "done");
        const bDone = b.subtasks.length > 0 && b.subtasks.every((s) => s.status === "done");
        if (aDone === bDone) return 0;
        return aDone ? 1 : -1;
      });
    } catch (e: any) {
      console.log("listTasks failed:", e?.message ?? e);
      return [];
    }
  }, [tick]);

  // Show modal every time the app opens, and load existing tasks
  useEffect(() => {
    setModalVisible(true);
    setTick((x) => x + 1);
  }, []);

  async function handleDecompose() {
    const trimmed = goal.trim();
    if (!trimmed) {
      Alert.alert("Please type something you've been putting off.");
      return;
    }

    setLoading(true);
    try {
      const result: DecomposedTask = await decomposeTask(trimmed);

      // Persist to DB
      const taskId = addTask(trimmed);
      if (taskId) {
        addSubtasks(
          taskId,
          result.steps.map((s, i) => ({
            title: `${s.emoji}\n${s.action}\n${s.explanation ?? ""}`,
            ord: i,
          }))
        );
        updateTaskNotes(taskId, JSON.stringify(result.actionTips ?? []));
      }

      setGoal("");
      setModalVisible(false);
      setTick((x) => x + 1);
      if (taskId) router.push(`/task/${taskId}`);
    } catch (err: any) {
      Alert.alert("Something went wrong", err?.message ?? "Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      {/* ── Procrastination Modal ─────────────────────────────────────── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.overlay}
        >
          {/* Backdrop: tapping outside the card dismisses keyboard */}
          <Pressable style={StyleSheet.absoluteFillObject} onPress={Keyboard.dismiss} />

          {/* Dialog card — plain View so layout is predictable */}
          <View style={styles.dialog}>
            <Pressable
              onPress={() => setModalVisible(false)}
              style={styles.dialogClose}
              hitSlop={8}
            >
              <Ionicons name="close" size={18} color="#a1a1aa" />
            </Pressable>
            <Text style={styles.dialogEmoji}>🤔</Text>
            <Text style={styles.dialogTitle}>
              What have you been procrastinating on?
            </Text>
            <Text style={styles.dialogSub}>
              Tell me your goal and I'll break it into small, doable steps.
            </Text>
            <Input
              value={goal}
              onChangeText={setGoal}
              placeholder="e.g. Start learning Spanish..."
              multiline
              numberOfLines={3}
              style={styles.dialogInput}
              editable={!loading}
            />
            <Pressable
              onPress={handleDecompose}
              disabled={loading}
              style={[styles.submitBtn, loading && { opacity: 0.6 }]}
            >
              <Text style={styles.submitBtnText}>
                {loading ? "Breaking it down…" : "Break it down! 🚀"}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.pageTitle}>My Goals</Text>
        <Pressable
          onPress={() => { setGoal(""); setModalVisible(true); }}
          style={styles.addGoalBtn}
          hitSlop={8}
        >
          <View style={styles.addGoalCircle}>
            <Ionicons name="add" size={20} color="#fff" />
          </View>
          <Text style={styles.addGoalLabel}>Add new goal</Text>
        </Pressable>
      </View>

      {/* ── Main Content ──────────────────────────────────────────────── */}
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {tasks.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🌱</Text>
            <Text style={styles.emptyText}>
              No goals yet.{" "}
              <Text
                style={styles.emptyLink}
                onPress={() => { setGoal(""); setModalVisible(true); }}
              >
                Add one
              </Text>
              {" "}to get started!
            </Text>
          </View>
        ) : (
          tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onPress={() => router.push(`/task/${task.id}`)}
            onDelete={() => {
              Alert.alert("Delete goal?", "This will remove the goal and all its steps.", [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () => {
                    deleteTask(task.id);
                    setTick((x) => x + 1);
                  },
                },
              ]);
            }}
          />
        ))
        )}
      </ScrollView>

    </View>
  );
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({ task, onPress, onDelete }: { task: TaskWithSteps; onPress: () => void; onDelete: () => void }) {
  const allDone = task.subtasks.length > 0 && task.subtasks.every((s) => s.status === "done");

  if (allDone) {
    const completedAt = Math.max(...task.subtasks.map((s) => s.completed_at ?? 0));
    const completedDate = completedAt
      ? new Date(completedAt).toLocaleDateString()
      : null;

    return (
      <View style={[styles.goalBlock, styles.goalBlockDone]}>
        <Pressable style={styles.goalHeaderLeft} onPress={onPress}>
          <Text style={[styles.taskTitle, styles.taskTitleDone]} numberOfLines={1}>
            {task.title}
          </Text>
          <View style={styles.completedRow}>
            <View style={styles.completedBadge}>
              <Ionicons name="checkmark" size={11} color="#16a34a" />
              <Text style={styles.completedBadgeText}>Completed</Text>
            </View>
            {completedDate && (
              <Text style={styles.completedDate}>on {completedDate}</Text>
            )}
          </View>
        </Pressable>
        <Pressable onPress={onDelete} style={styles.deleteBtn} hitSlop={8}>
          <Ionicons name="trash-outline" size={16} color="#d4d4d4" />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.goalBlock}>
      {/* Goal header */}
      <View style={styles.goalHeader}>
        <Pressable style={styles.goalHeaderLeft} onPress={onPress}>
          <Text style={styles.goalDate}>
            {new Date(task.created_at).toLocaleDateString()}
          </Text>
          <View style={styles.taskTitleRow}>
            <Text style={styles.taskTitle}>{task.title}</Text>
            <Ionicons name="chevron-forward" size={16} color="#a1a1aa" style={styles.taskTitleChevron} />
          </View>
        </Pressable>
        <Pressable onPress={onDelete} style={styles.deleteBtn} hitSlop={8}>
          <Ionicons name="trash-outline" size={18} color="#a1a1aa" />
        </Pressable>
      </View>

      {/* Steps */}
      <View style={styles.stepsContainer}>
        {task.subtasks.map((sub, idx) => (
          <StepCard key={sub.id} subtask={sub} index={idx} />
        ))}
      </View>

      {/* Action Tips */}
      {task.actionTips.length > 0 && (
        <View style={styles.tipsCard}>
          <Text style={styles.tipsLabel}>💡 Action Tips</Text>
          {task.actionTips.map((tip, i) => (
            <Text key={i} style={styles.tipText}>• {tip}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Step Card ────────────────────────────────────────────────────────────────

function StepCard({ subtask, index }: { subtask: Subtask; index: number }) {
  const [emoji, action] = subtask.title.split("\n");

  return (
    <Card style={styles.stepCard}>
      <View style={styles.stepRow}>
        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>{index + 1}</Text>
        </View>
        <View style={styles.stepContent}>
          <Text style={styles.stepEmoji}>{emoji}</Text>
          <Text style={styles.stepAction}>{action}</Text>
        </View>
      </View>
    </Card>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f9f9fb" },

  // Modal overlay + dialog
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  dialog: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  dialogClose: {
    position: "absolute",
    top: 12,
    right: 12,
    padding: 4,
  },
  dialogEmoji: { fontSize: 32, textAlign: "center", marginBottom: 8 },
  dialogTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#18181b",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 6,
  },
  dialogSub: {
    fontSize: 13,
    color: "#71717a",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 12,
  },
  dialogInput: {
    minHeight: 72,
    textAlignVertical: "top",
    paddingTop: 12,
    marginBottom: 12,
  },
  submitBtn: {
    backgroundColor: "#18181b",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  submitBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },

  // Header bar (sits above the scroll view)
  header: {
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#18181b",
    letterSpacing: -0.5,
  },

  // Scroll content
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 80 },

  // Add goal button
  addGoalBtn: {
    alignSelf: "flex-start",
    alignItems: "center",
    gap: 3,
  },
  addGoalCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#18181b",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  addGoalLabel: { fontSize: 11, fontWeight: "600", color: "#71717a" },

  // Empty state
  emptyState: { alignItems: "center", marginTop: 80, gap: 12 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: 16, color: "#a1a1aa", textAlign: "center" },
  emptyLink: { color: "#3b82f6", textDecorationLine: "underline" },

  // Goal block — outer container
  goalBlock: {
    backgroundColor: "#fff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    padding: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  goalBlockDone: {
    backgroundColor: "#fafafa",
    borderColor: "#f0f0f0",
    shadowOpacity: 0.02,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  taskTitleDone: { color: "#a1a1aa", fontWeight: "600", fontSize: 15 },
  completedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#dcfce7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
    flexShrink: 0,
  },
  completedBadgeText: { fontSize: 11, fontWeight: "600", color: "#16a34a" },
  completedRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  completedDate: { fontSize: 11, color: "#a1a1aa" },
  goalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f4f4f5",
  },
  goalHeaderLeft: { flex: 1, marginRight: 8 },
  goalDate: { fontSize: 11, color: "#a1a1aa", marginBottom: 4 },
  taskTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  taskTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#18181b",
    lineHeight: 26,
    flex: 1,
  },
  taskTitleChevron: { marginTop: 2 },
  deleteBtn: {
    padding: 4,
    marginTop: 2,
  },
  stepsContainer: { gap: 8 },

  // Step card
  stepCard: { padding: 14 },
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
  stepContent: { flex: 1, gap: 2 },
  stepEmoji: { fontSize: 18, marginBottom: 2 },
  stepAction: {
    fontSize: 14,
    fontWeight: "600",
    color: "#18181b",
    lineHeight: 20,
  },

  // Tips card
  tipsCard: { backgroundColor: "#fafafa", gap: 6 },
  tipsLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#71717a",
    marginBottom: 4,
  },
  tipText: { fontSize: 13, color: "#52525b", lineHeight: 20 },

});
