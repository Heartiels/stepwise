import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  deleteTask,
  listSubtasksForTask,
  listTasks,
  type Subtask,
  type Task,
} from "../src/db/taskRepo";

// ─── Types ────────────────────────────────────────────────────────────────────

type TaskWithSteps = Task & { subtasks: Subtask[] };

// ─── History Screen ───────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const [tasks, setTasks] = useState<TaskWithSteps[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useFocusEffect(
    useCallback(() => {
      const raw = listTasks();
      const mapped = raw.map((t) => ({
        ...t,
        subtasks: listSubtasksForTask(t.id),
      }));
      // Incomplete first, completed at bottom
      mapped.sort((a, b) => {
        const aDone = a.subtasks.length > 0 && a.subtasks.every((s) => s.status === "done");
        const bDone = b.subtasks.length > 0 && b.subtasks.every((s) => s.status === "done");
        if (aDone === bDone) return 0;
        return aDone ? 1 : -1;
      });
      setTasks(mapped);
    }, [])
  );

  const filteredTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return tasks;

    return tasks.filter((task) => task.title.toLowerCase().includes(query));
  }, [searchQuery, tasks]);

  function handleDelete(taskId: string) {
    Alert.alert("Delete goal?", "This will remove the goal and all its steps.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteTask(taskId);
          setTasks((prev) => prev.filter((t) => t.id !== taskId));
        },
      },
    ]);
  }

  return (
    <View style={styles.screen}>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color="#18181b" />
        </Pressable>
        <Text style={styles.pageTitle}>My Goals</Text>
        <View style={styles.backBtn} />
      </View>

      {/* ── Search Bar (sticky) ─────────────────────────────────────── */}
      <View style={styles.searchContainer}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={16} color="#a1a1aa" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search goals"
            placeholderTextColor="#a1a1aa"
            style={styles.searchInput}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {/* ── Goals List ──────────────────────────────────────────────── */}
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {tasks.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🌱</Text>
            <Text style={styles.emptyText}>No goals yet. Add one to get started!</Text>
          </View>
        ) : filteredTasks.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>No results</Text>
            <Text style={styles.emptyText}>No goals match "{searchQuery.trim()}".</Text>
          </View>
        ) : (
          filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onPress={() => router.push(`/task/${task.id}`)}
              onDelete={() => handleDelete(task.id)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({ task, onPress, onDelete }: {
  task: TaskWithSteps;
  onPress: () => void;
  onDelete: () => void;
}) {
  const allDone = task.subtasks.length > 0 && task.subtasks.every((s) => s.status === "done");

  if (allDone) {
    const completedAt = Math.max(...task.subtasks.map((s) => s.completed_at ?? 0));
    const completedDate = completedAt ? new Date(completedAt).toLocaleDateString() : null;

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

  const doneCount = task.subtasks.filter((s) => s.status === "done").length;
  const totalCount = task.subtasks.length;
  const progress = totalCount > 0 ? doneCount / totalCount : 0;

  return (
    <Pressable style={styles.goalBlock} onPress={onPress}>
      <View style={styles.goalHeader}>
        <View style={styles.goalHeaderLeft}>
          <Text style={styles.goalDate}>
            {new Date(task.created_at).toLocaleDateString()}
          </Text>
          <View style={styles.taskTitleRow}>
            <Text style={styles.taskTitle}>{task.title}</Text>
            <Ionicons name="chevron-forward" size={16} color="#a1a1aa" style={styles.taskTitleChevron} />
          </View>
        </View>
        <Pressable onPress={onDelete} style={styles.deleteBtn} hitSlop={8}>
          <Ionicons name="trash-outline" size={18} color="#a1a1aa" />
        </Pressable>
      </View>

      {/* Progress bar */}
      {totalCount > 0 && (
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { flex: progress }]} />
            <View style={{ flex: 1 - progress }} />
          </View>
          <Text style={styles.progressLabel}>{doneCount}/{totalCount}</Text>
        </View>
      )}
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f9f9fb" },

  header: {
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: { width: 32 },
  pageTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#18181b",
    letterSpacing: -0.3,
  },

  scroll: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 80 },

  searchContainer: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    backgroundColor: "#f9f9fb",
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#18181b",
    paddingVertical: 0,
  },

  emptyState: { alignItems: "center", marginTop: 80, gap: 12 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: 16, color: "#a1a1aa", textAlign: "center" },

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
  taskTitleRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  taskTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#18181b",
    lineHeight: 22,
    flex: 1,
  },
  taskTitleDone: { color: "#a1a1aa", fontWeight: "600", fontSize: 15 },
  taskTitleChevron: { marginTop: 2 },
  deleteBtn: { padding: 4, marginTop: 2 },
  completedRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
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
  completedDate: { fontSize: 11, color: "#a1a1aa" },

  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#f0f0f0",
    flexDirection: "row",
    overflow: "hidden",
  },
  progressFill: {
    backgroundColor: "#18181b",
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#a1a1aa",
    minWidth: 28,
    textAlign: "right",
  },
});
