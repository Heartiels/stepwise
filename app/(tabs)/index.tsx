import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import {
  Alert,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  addSubtasks,
  addTask,
  getPersonalContext,
  updateTaskNotes,
} from "../../src/db/taskRepo";
import { Ionicons } from "@expo/vector-icons";
import { decomposeTask, type DecomposedTask } from "../../src/services/openai";
import { Input } from "../../components/ui/input";
import { VoiceInputButton } from "@/components/voice-input-button";

const HINTS = [
  "Scrolling TikTok in bed instead of starting that task.",
  "Sitting on the couch watching Netflix while ignoring the mess.",
  "Scrolling through old texts instead of making dinner.",
  "Staring at my desk, still not starting the assignment.",
];

// ─── Home Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const [modalVisible, setModalVisible] = useState(true);
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const [hintIndex, setHintIndex] = useState(0);
  const hintOpacity = useRef(new Animated.Value(1)).current;

  // Show modal every time the app opens
  useEffect(() => {
    setModalVisible(true);
  }, []);

  // Rotate hints every 3 seconds with fade
  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(hintOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        setHintIndex((i) => (i + 1) % HINTS.length);
        Animated.timing(hintOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [hintOpacity]);

  async function handleDecompose() {
    const trimmed = goal.trim();
    if (!trimmed) {
      Alert.alert("Please type something you've been putting off.");
      return;
    }

    setLoading(true);
    try {
      const result: DecomposedTask = await decomposeTask(trimmed, getPersonalContext());

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
          <Pressable style={StyleSheet.absoluteFillObject} onPress={Keyboard.dismiss} />

          <Pressable
            onPress={() => { setModalVisible(false); router.push("/history"); }}
            style={styles.modalHistoryBtn}
            hitSlop={8}
          >
            <Ionicons name="time-outline" size={20} color="#fff" />
          </Pressable>

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
              Tell me your goal — I'll break it into doable steps.
            </Text>
            <View style={styles.goalRow}>
              <View style={{ flex: 1 }}>
                <Input
                  value={goal}
                  onChangeText={setGoal}
                  multiline
                  numberOfLines={3}
                  style={styles.dialogInput}
                  editable={!loading}
                />
                {goal.length === 0 && (
                  <Animated.Text
                    style={[styles.hintOverlay, { opacity: hintOpacity }]}
                    pointerEvents="none"
                  >
                    {HINTS[hintIndex]}
                  </Animated.Text>
                )}
              </View>

              <VoiceInputButton
                onText={(t) => {
                  setGoal(t);
                  Keyboard.dismiss();
                }}
              />
            </View>
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

      {/* ── Top Bar ───────────────────────────────────────────────────── */}
      <View style={styles.topBar}>
        {/* Left: icon bar (clock → history) */}
        <View style={styles.iconBar}>
          <Pressable
            onPress={() => router.push("/history")}
            style={styles.iconCircle}
            hitSlop={8}
          >
            <Ionicons name="time-outline" size={20} color="#fff" />
          </Pressable>
        </View>

        {/* Right: add new goal */}
        <Pressable
          onPress={() => { setGoal(""); setModalVisible(true); }}
          style={styles.iconCircle}
          hitSlop={8}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      </View>

      {/* ── Blank Main Content ────────────────────────────────────────── */}
      <View style={styles.emptyCenter}>
        <Text style={styles.emptyEmoji}>✨</Text>
        <Text style={styles.emptyTitle}>What's your next goal?</Text>
        <Text style={styles.emptySub}>Tap + to break it down into steps.</Text>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f9f9fb" },

  // Modal
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
  dialogClose: { position: "absolute", top: 12, right: 12, padding: 4 },
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
    minHeight: 100,
    textAlignVertical: "top",
    paddingTop: 12,
  },
  submitBtn: {
    backgroundColor: "#18181b",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  submitBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  // Top bar
  topBar: {
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconBar: {
    flexDirection: "row",
    gap: 8,
  },
  iconCircle: {
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

  // Empty state
  emptyCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingBottom: 80,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 4 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: "#18181b" },
  emptySub: { fontSize: 14, color: "#a1a1aa" },

  modalHistoryBtn: {
    position: "absolute",
    top: 52,
    left: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#18181b",
    alignItems: "center",
    justifyContent: "center",
  },

  goalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  hintOverlay: {
    position: "absolute",
    top: 12,
    left: 16,
    right: 16,
    fontSize: 16,
    color: "#a1a1aa",
    pointerEvents: "none",
  },

});
