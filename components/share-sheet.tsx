import { forwardRef, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ViewShot from "react-native-view-shot";
import * as ExpoSharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";
import type { Subtask } from "../src/db/taskRepo";

// ─── Image card (also used for off-screen capture) ────────────────────────────

type CardProps = { goalTitle: string; subtasks: Subtask[] };

export const ShareImageCard = forwardRef<ViewShot, CardProps>(({ goalTitle, subtasks }, ref) => (
  <ViewShot ref={ref} options={{ format: "png", quality: 1 }} style={cardStyles.card}>
    <View style={cardStyles.header}>
      <View style={cardStyles.headerLeft}>
        <Text style={cardStyles.appName}>Stepwise</Text>
        <Text style={cardStyles.goalTitle}>{goalTitle}</Text>
      </View>
      <View style={cardStyles.accentDot} />
    </View>
    <View style={cardStyles.divider} />
    <View style={cardStyles.stepsWrap}>
      {subtasks.map((s, i) => (
        <View key={s.id} style={cardStyles.stepRow}>
          <View style={cardStyles.stepLeft}>
            <View style={cardStyles.stepBadge}>
              <Text style={cardStyles.stepNumber}>{i + 1}</Text>
            </View>
            {i < subtasks.length - 1 && <View style={cardStyles.connector} />}
          </View>
          <View style={cardStyles.stepContent}>
            <Text style={cardStyles.stepAction}>{s.emoji ?? "•"}{"  "}{s.action}</Text>
            {!!s.explanation && <Text style={cardStyles.stepExplanation}>{s.explanation}</Text>}
          </View>
        </View>
      ))}
    </View>
    <View style={cardStyles.footer}>
      <View style={cardStyles.footerPill}>
        <Text style={cardStyles.footerText}>Made with Stepwise</Text>
      </View>
    </View>
  </ViewShot>
));

// ─── Preview sheet ─────────────────────────────────────────────────────────────

type SheetProps = {
  visible: boolean;
  mode: "text" | "image";
  onClose: () => void;
  goalTitle: string;
  subtasks: Subtask[];
};

function buildText(goalTitle: string, subtasks: Subtask[]): string {
  const lines: string[] = [`🎯 ${goalTitle}`, ""];
  subtasks.forEach((s, i) => {
    lines.push(`${i + 1}. ${s.emoji ?? "•"} ${s.action}`);
    if (s.explanation) lines.push(`   ${s.explanation}`);
  });
  lines.push("", "— via Stepwise");
  return lines.join("\n");
}

export function SharePreviewSheet({ visible, mode, onClose, goalTitle, subtasks }: SheetProps) {
  const viewShotRef = useRef<ViewShot>(null);
  const [capturing, setCapturing] = useState(false);
  const [copied, setCopied] = useState(false);
  const textContent = buildText(goalTitle, subtasks);

  async function handleShareText() {
    try { await Share.share({ message: textContent }); } catch { /* dismissed */ }
  }

  async function handleCopy() {
    await Clipboard.setStringAsync(textContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShareImage() {
    if (!viewShotRef.current) return;
    setCapturing(true);
    try {
      const uri = await (viewShotRef.current as any).capture();
      const canShare = await ExpoSharing.isAvailableAsync();
      if (canShare) await ExpoSharing.shareAsync(uri, { mimeType: "image/png" });
      else Alert.alert("Sharing not available on this device.");
    } catch { Alert.alert("Failed to capture image."); }
    finally { setCapturing(false); }
  }

  function handleClose() {
    setCopied(false);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={handleClose} />
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {mode === "text" ? "Share as Text" : "Share as Image"}
            </Text>
            <Pressable onPress={handleClose} hitSlop={8} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color="#71717a" />
            </Pressable>
          </View>

          {/* Text preview */}
          {mode === "text" && (
            <>
              <ScrollView style={styles.textBox} showsVerticalScrollIndicator={false}>
                <Text style={styles.textContent}>{textContent}</Text>
              </ScrollView>
              <View style={styles.actionRow}>
                <Pressable style={[styles.btn, styles.secondaryBtn]} onPress={handleCopy}>
                  <Ionicons name={copied ? "checkmark" : "copy-outline"} size={16} color="#18181b" />
                  <Text style={styles.secondaryBtnText}>{copied ? "Copied!" : "Copy"}</Text>
                </Pressable>
                <Pressable style={[styles.btn, styles.primaryBtn]} onPress={handleShareText}>
                  <Ionicons name="share-outline" size={16} color="#fff" />
                  <Text style={styles.primaryBtnText}>Share</Text>
                </Pressable>
              </View>
            </>
          )}

          {/* Image preview */}
          {mode === "image" && (
            <>
              <ScrollView showsVerticalScrollIndicator={false} style={styles.imageScroll}>
                <View style={styles.imageCardWrap}>
                  <ShareImageCard ref={viewShotRef} goalTitle={goalTitle} subtasks={subtasks} />
                </View>
              </ScrollView>
              <View style={styles.actionRow}>
                <Pressable
                  style={[styles.btn, styles.primaryBtn, capturing && { opacity: 0.6 }]}
                  onPress={handleShareImage}
                  disabled={capturing}
                >
                  <Ionicons name="share-outline" size={16} color="#fff" />
                  <Text style={styles.primaryBtnText}>{capturing ? "Preparing…" : "Share"}</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const ORANGE = "#f97316";
const ORANGE_LIGHT = "#fff7ed";
const ORANGE_BORDER = "#fed7aa";

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    width: 340,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e4e4e7",
  },
  header: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    backgroundColor: ORANGE_LIGHT,
  },
  headerLeft: { flex: 1, gap: 6 },
  appName: {
    fontSize: 10,
    fontWeight: "800",
    color: ORANGE,
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
  goalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#18181b",
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  accentDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ORANGE,
    marginTop: 4,
  },
  divider: { height: 1, backgroundColor: ORANGE_BORDER },
  stepsWrap: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  stepRow: { flexDirection: "row", gap: 14 },
  stepLeft: { alignItems: "center", width: 24 },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: ORANGE,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  stepNumber: { fontSize: 11, fontWeight: "800", color: "#fff" },
  connector: {
    flex: 1,
    width: 1.5,
    backgroundColor: ORANGE_BORDER,
    marginVertical: 3,
    minHeight: 8,
  },
  stepContent: { flex: 1, paddingBottom: 14, gap: 3 },
  stepAction: { fontSize: 13, fontWeight: "700", color: "#18181b", lineHeight: 19 },
  stepExplanation: { fontSize: 11, color: "#71717a", lineHeight: 16 },
  footer: {
    paddingVertical: 14,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#f4f4f5",
  },
  footerPill: {
    backgroundColor: "#f4f4f5",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  footerText: { fontSize: 10, fontWeight: "600", color: "#a1a1aa", letterSpacing: 0.3 },
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(24,24,27,0.42)",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 36,
    gap: 16,
    maxHeight: "88%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#18181b" },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f4f4f5",
    alignItems: "center",
    justifyContent: "center",
  },
  textBox: {
    backgroundColor: "#f9f9fb",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    padding: 14,
    maxHeight: 320,
  },
  textContent: {
    fontSize: 13,
    color: "#3f3f46",
    lineHeight: 22,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  actionRow: { flexDirection: "row", gap: 10 },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
  },
  secondaryBtn: { backgroundColor: "#f4f4f5", borderWidth: 1, borderColor: "#e4e4e7" },
  secondaryBtnText: { fontSize: 14, fontWeight: "600", color: "#18181b" },
  primaryBtn: { backgroundColor: "#18181b" },
  primaryBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  imageScroll: { maxHeight: 440 },
  imageCardWrap: { alignItems: "center", paddingVertical: 8 },
});
