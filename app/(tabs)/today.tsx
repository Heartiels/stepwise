import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  listTodaySubtasks,
  setSubtaskToday,
  updateSubtaskStatus,
  type TodaySubtask,
} from "../../src/db/taskRepo";

export default function TodayScreen() {
  const [subtasks, setSubtasks] = useState<TodaySubtask[]>([]);

  useFocusEffect(
    useCallback(() => {
      setSubtasks(listTodaySubtasks().filter((subtask) => subtask.status !== "done"));
    }, [])
  );

  function handleRemove(subtaskId: string) {
    setSubtaskToday(subtaskId, false);
    setSubtasks((prev) => prev.filter((subtask) => subtask.id !== subtaskId));
  }

  function handleDone(subtaskId: string) {
    updateSubtaskStatus(subtaskId, "done");
    setSubtasks((prev) => prev.filter((subtask) => subtask.id !== subtaskId));
  }

  return (
    <View style={styles.screen}>
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
              onDone={() => handleDone(subtask.id)}
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
}: {
  subtask: TodaySubtask;
  onOpen: () => void;
  onRemove: () => void;
  onDone: () => void;
}) {
  const [emoji, action, explanation] = subtask.title.split("\n");

  return (
    <Pressable style={styles.card} onPress={onOpen}>
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
        <Ionicons name="chevron-forward" size={16} color="#a1a1aa" />
      </View>

      <Text style={styles.stepAction}>
        <Text style={styles.stepEmoji}>{emoji ?? "•"} </Text>
        {action ?? subtask.title}
      </Text>
      {!!explanation && <Text style={styles.stepExplanation}>{explanation}</Text>}

      <View style={styles.actionRow}>
        <Pressable onPress={onRemove} style={[styles.actionBtn, styles.secondaryBtn]}>
          <Text style={styles.secondaryBtnText}>Remove</Text>
        </Pressable>
        <Pressable onPress={onDone} style={[styles.actionBtn, styles.primaryBtn]}>
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
