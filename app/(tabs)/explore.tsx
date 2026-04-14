import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  getCompletionsByDay,
  getCurrentStreak,
  getFocusStats,
  getPersonalContext,
  getTotalPoints,
  getUserNickname,
  getUserSetting,
  listSubtasksForTask,
  listTasks,
  setPersonalContext,
  setUserNickname,
  setUserSetting,
} from "../../src/db/taskRepo";

// ─── Heatmap config ───────────────────────────────────────────────────────────

const WEEKS = 15;
const CELL = 13;
const GAP = 3;
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function getHeatColor(count: number) {
  if (count === 0) return "#ebedf0";
  if (count <= 2)  return "#9be9a8";
  if (count <= 4)  return "#40c463";
  if (count <= 6)  return "#30a14e";
  return "#216e39";
}

function buildGrid(completions: Record<string, number>) {
  const today = new Date();
  const todayDow = today.getDay(); // 0=Sun
  // Convert to Mon-based index (Mon=0 … Sun=6)
  const todayMon = todayDow === 0 ? 6 : todayDow - 1;

  const startDate = new Date(today);
  startDate.setDate(today.getDate() - todayMon - (WEEKS - 1) * 7);

  const grid: { date: string; count: number }[][] = [];
  for (let w = 0; w < WEEKS; w++) {
    const week: { date: string; count: number }[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + w * 7 + d);
      const dateStr = date.toISOString().split("T")[0];
      week.push({ date: dateStr, count: completions[dateStr] ?? 0 });
    }
    grid.push(week);
  }
  return grid;
}

// Return month label for each week column (show when month changes)
function buildMonthLabels(grid: { date: string }[][]) {
  return grid.map((week, wi) => {
    const d = new Date(week[0].date);
    if (wi === 0) return MONTHS[d.getMonth()];
    const prev = new Date(grid[wi - 1][0].date);
    return d.getMonth() !== prev.getMonth() ? MONTHS[d.getMonth()] : "";
  });
}

// ─── Profile Screen ───────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const [nickname, setNickname] = useState("My Name");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [stats, setStats] = useState({ streak: 0, completed: 0, total: 0, points: 0 });
  const [focusStats, setFocusStats] = useState({ totalMinutes: 0, totalSessions: 0 });
  const [completions, setCompletions] = useState<Record<string, number>>({});

  // Edit nickname modal
  const [editVisible, setEditVisible] = useState(false);
  const [editValue, setEditValue] = useState("");

  // Cell tap popup
  const [selectedCell, setSelectedCell] = useState<{ date: string; count: number } | null>(null);

  // My Context
  const [personalContext, setPersonalContextState] = useState("");
  const MAX_CONTEXT = 800;

  useFocusEffect(
    useCallback(() => {
      setNickname(getUserNickname());
      setAvatarUri(getUserSetting("avatarUri") || null);
      setCompletions(getCompletionsByDay());
      setPersonalContextState(getPersonalContext());
      setFocusStats(getFocusStats());

      const tasks = listTasks();
      let completed = 0, total = 0;
      for (const t of tasks) {
        const subs = listSubtasksForTask(t.id);
        if (subs.length === 0) continue;
        total++;
        if (subs.every((s) => s.status === "done")) completed++;
      }
      setStats({ streak: getCurrentStreak(), completed, total, points: getTotalPoints() });
    }, [])
  );

  const grid = useMemo(() => buildGrid(completions), [completions]);
  const monthLabels = useMemo(() => buildMonthLabels(grid), [grid]);

  // ── Nickname save ──────────────────────────────────────────────────────────
  function handleSaveNickname() {
    const trimmed = editValue.trim();
    if (!trimmed) { Alert.alert("Please enter a name."); return; }
    setUserNickname(trimmed);
    setNickname(trimmed);
    setEditVisible(false);
  }

  // ── Avatar pick ────────────────────────────────────────────────────────────
  async function handlePickAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Please allow photo library access.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setAvatarUri(uri);
      setUserSetting("avatarUri", uri);
    }
  }

  const initials = nickname.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  // ── Cell tap popup content ─────────────────────────────────────────────────
  function formatCellDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }

  return (
    <View style={styles.screen}>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Personal Info</Text>
        <Pressable hitSlop={8}>
          <Ionicons name="settings-outline" size={22} color="#18181b" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Avatar + Nickname ──────────────────────────────────────── */}
        <View style={styles.profileRow}>
          <Pressable onPress={handlePickAvatar} style={styles.avatarWrapper}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{initials || "?"}</Text>
              </View>
            )}
            <View style={styles.avatarEdit}>
              <Ionicons name="camera-outline" size={12} color="#fff" />
            </View>
          </Pressable>

          <View style={styles.nameBlock}>
            <Text style={styles.nameLabel}>NICKNAME</Text>
            <Pressable
              style={styles.nameRow}
              onPress={() => { setEditValue(nickname); setEditVisible(true); }}
            >
              <Text style={styles.nameText}>{nickname}</Text>
              <Ionicons name="pencil-outline" size={14} color="#a1a1aa" style={{ marginLeft: 6 }} />
            </Pressable>
          </View>
        </View>

        {/* ── Divider ───────────────────────────────────────────────── */}
        <View style={styles.divider} />

        {/* ── Stats ─────────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Overview</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <View style={styles.statTopRow}>
              <Ionicons name="flame-outline" size={20} color="#f97316" />
              <Text style={styles.statNumber}>{stats.streak}</Text>
            </View>
            <Text style={styles.statLabel}>Current Streak</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <View style={styles.statTopRow}>
              <Ionicons name="bar-chart-outline" size={20} color="#3b82f6" />
              <Text style={styles.statNumber}>
                {stats.completed}/{stats.total}
              </Text>
            </View>
            <Text style={styles.statLabel}>Goals Done</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <View style={styles.statTopRow}>
              <Ionicons name="star-outline" size={20} color="#eab308" />
              <Text style={styles.statNumber}>{stats.points}</Text>
            </View>
            <Text style={styles.statLabel}>XP</Text>
          </View>
        </View>

        <View style={styles.focusCard}>
          <View style={styles.focusCardHeader}>
            <Text style={styles.focusCardTitle}>Focus Practice</Text>
            <Ionicons name="timer-outline" size={18} color="#c2410c" />
          </View>
          <Text style={styles.focusCardValue}>{focusStats.totalMinutes} min</Text>
          <Text style={styles.focusCardSub}>
            {focusStats.totalSessions} session{focusStats.totalSessions === 1 ? "" : "s"} logged across your steps
          </Text>
        </View>

        {/* ── Divider ───────────────────────────────────────────────── */}
        <View style={styles.divider} />

        {/* ── Heatmap ───────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Growth</Text>
        <Text style={styles.sectionSub}>Steps completed per day — tap a cell for details</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            {/* X-axis: month labels (absolutely positioned to avoid wrapping) */}
            <View style={styles.monthRow}>
              {monthLabels.map((label, wi) =>
                label ? (
                  <Text
                    key={wi}
                    numberOfLines={1}
                    style={[styles.monthText, { left: 30 + wi * (CELL + GAP) }]}
                  >
                    {label}
                  </Text>
                ) : null
              )}
            </View>

            {/* Grid + Y-axis */}
            <View style={styles.heatmapBody}>
              {/* Y-axis */}
              <View style={styles.yAxis}>
                {DAY_LABELS.map((label, i) => (
                  <View key={i} style={styles.yAxisCell}>
                    <Text style={styles.yAxisText}>{label}</Text>
                  </View>
                ))}
              </View>

              {/* Cells */}
              <View style={styles.heatmapGrid}>
                {grid.map((week, wi) => (
                  <View key={wi} style={styles.heatmapCol}>
                    {week.map((cell, di) => (
                      <Pressable
                        key={di}
                        style={[styles.heatCell, { backgroundColor: getHeatColor(cell.count) }]}
                        onPress={() => setSelectedCell(cell)}
                      />
                    ))}
                  </View>
                ))}
              </View>
            </View>

            {/* Legend */}
            <View style={styles.legendRow}>
              <View style={styles.yAxisSpacer} />
              <Text style={styles.legendLabel}>Less</Text>
              {["#ebedf0","#9be9a8","#40c463","#30a14e","#216e39"].map((c) => (
                <View key={c} style={[styles.heatCell, { backgroundColor: c, marginHorizontal: 1 }]} />
              ))}
              <Text style={styles.legendLabel}>More</Text>
            </View>
          </View>
        </ScrollView>

        {/* ── My Context ────────────────────────────────────────────── */}
        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>My Context</Text>
        <Text style={styles.sectionSub}>
          Share your background, habits, or preferences.
        </Text>
        <View style={styles.contextWrap}>
          <TextInput
            value={personalContext}
            onChangeText={(t) => {
              if (t.length <= MAX_CONTEXT) {
                setPersonalContextState(t);
                setPersonalContext(t);
              }
            }}
            placeholder="e.g. I'm a cs student. I prefer steps under 10 minutes. I don't have a car."
            placeholderTextColor="#a1a1aa"
            multiline
            style={styles.contextInput}
          />
          <Text style={styles.contextCount}>{personalContext.length}/{MAX_CONTEXT}</Text>
        </View>
        <View style={styles.contextTips}>
          {[
            "The AI uses this to tailor every plan to your situation.",
            "More detail = more personalized steps.",
            "You can add preferences like \"I only have evenings free\" or \"no gym access\".",
          ].map((tip, i) => (
            <View key={i} style={styles.tipRow}>
              <Text style={styles.tipIcon}>💡</Text>
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>

      </ScrollView>

      {/* ── Cell detail popup ────────────────────────────────────────── */}
      <Modal visible={!!selectedCell} transparent animationType="fade" statusBarTranslucent>
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedCell(null)} />
        {selectedCell && (
          <View style={styles.cellPopup}>
            <Text style={styles.cellPopupDate}>{formatCellDate(selectedCell.date)}</Text>
            <Text style={styles.cellPopupCount}>
              {selectedCell.count === 0
                ? "No activity on this day"
                : `${selectedCell.count} step${selectedCell.count > 1 ? "s" : ""} completed`}
            </Text>
            <Pressable onPress={() => setSelectedCell(null)} style={styles.cellPopupClose}>
              <Text style={styles.cellPopupCloseText}>Close</Text>
            </Pressable>
          </View>
        )}
      </Modal>

      {/* ── Edit Nickname Modal ──────────────────────────────────────── */}
      <Modal visible={editVisible} transparent animationType="fade" statusBarTranslucent>
        <View style={{ flex: 1 }}>
          <Pressable
            style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.4)" }]}
            onPress={() => setEditVisible(false)}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1, justifyContent: "flex-end" }}
          >
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Edit Nickname</Text>
          <TextInput
            style={styles.modalInput}
            value={editValue}
            onChangeText={setEditValue}
            placeholder="Enter your name"
            autoFocus
            maxLength={30}
          />
          <View style={styles.modalBtns}>
            <Pressable onPress={() => setEditVisible(false)} style={styles.modalBtnSecondary}>
              <Text style={styles.modalBtnSecondaryText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={handleSaveNickname} style={styles.modalBtnPrimary}>
              <Text style={styles.modalBtnPrimaryText}>Save</Text>
            </Pressable>
          </View>
        </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
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
  pageTitle: { fontSize: 22, fontWeight: "800", color: "#18181b", letterSpacing: -0.3 },

  scroll: { paddingHorizontal: 20, paddingBottom: 60 },

  // Avatar
  profileRow: { flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 10 },
  avatarWrapper: { position: "relative" },
  avatarPlaceholder: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: "#18181b",
    alignItems: "center", justifyContent: "center",
  },
  avatarImage: { width: 64, height: 64, borderRadius: 32 },
  avatarText: { color: "#fff", fontSize: 22, fontWeight: "700" },
  avatarEdit: {
    position: "absolute", bottom: 0, right: 0,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: "#71717a",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: "#f9f9fb",
  },
  nameBlock: { flex: 1, gap: 4 },
  nameLabel: { fontSize: 10, color: "#a1a1aa", fontWeight: "600", letterSpacing: 0.8 },
  nameRow: { flexDirection: "row", alignItems: "center" },
  nameText: { fontSize: 20, fontWeight: "700", color: "#18181b" },

  // Divider
  divider: { height: 1, backgroundColor: "#f0f0f0", marginVertical: 20 },

  // Section
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#18181b", marginBottom: 4 },
  sectionSub: { fontSize: 12, color: "#a1a1aa", marginBottom: 12 },

  // Stats
  statsRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    overflow: "hidden",
  },
  statItem: { flex: 1, paddingVertical: 18, paddingHorizontal: 16, gap: 6 },
  statTopRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  statDivider: { width: 1, backgroundColor: "#f0f0f0", marginVertical: 12 },
  statNumber: { fontSize: 24, fontWeight: "800", color: "#18181b" },
  statLabel: { fontSize: 12, color: "#71717a", fontWeight: "500" },
  focusCard: {
    marginTop: 14,
    backgroundColor: "#fff7ed",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#fed7aa",
    padding: 16,
    gap: 4,
  },
  focusCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  focusCardTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#9a3412",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  focusCardValue: {
    fontSize: 28,
    fontWeight: "800",
    color: "#18181b",
  },
  focusCardSub: {
    fontSize: 13,
    color: "#9a3412",
    lineHeight: 18,
  },

  // Heatmap
  monthRow: { height: 14, position: "relative", marginBottom: 4 },
  yAxisSpacer: { width: 30 },
  monthText: { position: "absolute", fontSize: 9, color: "#a1a1aa", fontWeight: "500", bottom: 0 },

  heatmapBody: { flexDirection: "row" },
  yAxis: { width: 30, gap: GAP, paddingTop: 0 },
  yAxisCell: { height: CELL, justifyContent: "center" },
  yAxisText: { fontSize: 9, color: "#a1a1aa", textAlign: "right", paddingRight: 4 },

  heatmapGrid: { flexDirection: "row", gap: GAP },
  heatmapCol: { flexDirection: "column", gap: GAP },
  heatCell: { width: CELL, height: CELL, borderRadius: 2 },

  legendRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 8 },
  legendLabel: { fontSize: 10, color: "#a1a1aa", marginHorizontal: 2 },

  // Cell popup
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  cellPopup: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 44,
    gap: 8,
  },
  cellPopupDate: { fontSize: 16, fontWeight: "700", color: "#18181b" },
  cellPopupCount: { fontSize: 14, color: "#71717a" },
  cellPopupClose: {
    marginTop: 8,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: "#18181b",
    alignItems: "center",
  },
  cellPopupCloseText: { color: "#fff", fontSize: 15, fontWeight: "600" },

  // Nickname modal
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 44,
    gap: 16,
  },
  modalTitle: { fontSize: 17, fontWeight: "700", color: "#18181b" },
  modalInput: {
    borderWidth: 1, borderColor: "#e4e4e7",
    borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 16, color: "#18181b",
  },
  modalBtns: { flexDirection: "row", gap: 10 },
  modalBtnSecondary: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    borderWidth: 1, borderColor: "#e4e4e7", alignItems: "center",
  },
  modalBtnSecondaryText: { fontSize: 15, fontWeight: "600", color: "#71717a" },
  modalBtnPrimary: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    backgroundColor: "#18181b", alignItems: "center",
  },
  modalBtnPrimaryText: { fontSize: 15, fontWeight: "600", color: "#fff" },

  contextWrap: {
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 14,
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    marginBottom: 16,
  },
  contextInput: {
    fontSize: 14,
    color: "#18181b",
    minHeight: 100,
    textAlignVertical: "top",
    lineHeight: 20,
  },
  contextCount: {
    fontSize: 11,
    color: "#a1a1aa",
    textAlign: "right",
    marginTop: 4,
  },
  contextTips: { gap: 8, marginBottom: 32 },
  tipRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  tipIcon: { fontSize: 14, marginTop: 1 },
  tipText: { flex: 1, fontSize: 13, color: "#71717a", lineHeight: 18 },
});
