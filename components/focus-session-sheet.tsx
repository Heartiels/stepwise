import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

function useTypingLoop(active: boolean, target = "Helping...") {
  const [chars, setChars] = useState<string[]>([]);
  useEffect(() => {
    if (!active) { setChars([]); return; }
    const arr = target.split("");
    let cancelled = false;
    let iv: ReturnType<typeof setInterval> | null = null;
    function startLoop() {
      if (cancelled) return;
      let idx = 0;
      setChars([]);
      iv = setInterval(() => {
        if (cancelled) { clearInterval(iv!); return; }
        const i = idx++;
        setChars(() => arr.slice(0, i + 1));
        if (idx >= arr.length) {
          clearInterval(iv!);
          setTimeout(startLoop, 400);
        }
      }, 80);
    }
    startLoop();
    return () => { cancelled = true; if (iv) clearInterval(iv); };
  }, [active, target]);
  return chars;
}

const DURATIONS = [5, 10, 15] as const;

type FocusSessionSheetProps = {
  visible: boolean;
  taskTitle: string;
  action: string;
  explanation?: string;
  loadingStuck?: boolean;
  onClose: () => void;
  onDone: (secondsSpent: number) => void;
  onStuck: (secondsSpent: number) => void;
  onLogSession: (secondsSpent: number) => void;
};

type SessionPhase = "ready" | "running" | "complete";

export function FocusSessionSheet({
  visible,
  taskTitle,
  action,
  explanation,
  loadingStuck = false,
  onClose,
  onDone,
  onStuck,
  onLogSession,
}: FocusSessionSheetProps) {
  const [selectedMinutes, setSelectedMinutes] = useState<number>(10);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(10 * 60);
  const [phase, setPhase] = useState<SessionPhase>("ready");
  const blockDurationSecondsRef = useRef<number>(10 * 60);
  const helpingChars = useTypingLoop(loadingStuck);

  useEffect(() => {
    if (!visible) {
      setSelectedMinutes(10);
      setRemainingSeconds(10 * 60);
      setPhase("ready");
      return;
    }

    setRemainingSeconds(selectedMinutes * 60);
  }, [selectedMinutes, visible]);

  useEffect(() => {
    if (!visible || phase !== "running") return;

    const interval = setInterval(() => {
      setRemainingSeconds((current) => {
        if (current <= 1) {
          clearInterval(interval);
          onLogSession(blockDurationSecondsRef.current);
          setPhase("complete");
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [onLogSession, phase, visible]);

  const timeLabel = useMemo(() => {
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }, [remainingSeconds]);

  function handleStart(minutes = selectedMinutes) {
    setSelectedMinutes(minutes);
    setRemainingSeconds(minutes * 60);
    blockDurationSecondsRef.current = minutes * 60;
    setPhase("running");
  }

  function getElapsedSeconds() {
    return Math.max(blockDurationSecondsRef.current - remainingSeconds, 0);
  }

  function handleDonePress() {
    onDone(phase === "running" ? getElapsedSeconds() : 0);
  }

  function handleStuckPress() {
    onStuck(phase === "running" ? getElapsedSeconds() : 0);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.eyebrow}>Focus</Text>
            <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color="#71717a" />
            </Pressable>
          </View>

          <View style={styles.stepCard}>
            <Text style={styles.stepAction}>{action}</Text>
            {!!explanation && <Text style={styles.stepExplanation}>{explanation}</Text>}
          </View>

          {phase === "ready" && (
            <>
              <Text style={styles.sectionLabel}>Pick a short focus block</Text>
              <View style={styles.durationRow}>
                {DURATIONS.map((minutes) => {
                  const selected = selectedMinutes === minutes;
                  return (
                    <Pressable
                      key={minutes}
                      onPress={() => setSelectedMinutes(minutes)}
                      style={[styles.durationChip, selected && styles.durationChipSelected]}
                    >
                      <Text style={[styles.durationChipText, selected && styles.durationChipTextSelected]}>
                        {minutes} min
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable style={styles.primaryBtn} onPress={() => handleStart()}>
                <Ionicons name="flash" size={16} color="#fff" />
                <Text style={styles.primaryBtnText}>Start focus</Text>
              </Pressable>
            </>
          )}

          {phase === "running" && (
            <>
              <View style={styles.timerCard}>
                <Text style={styles.timerLabel}>You only need to do this step</Text>
                <Text style={styles.timerText}>{timeLabel}</Text>
                <Text style={styles.timerSub}>Keep it messy. Just keep moving.</Text>
              </View>

              <View style={styles.actionRow}>
                <Pressable style={[styles.actionBtn, styles.secondaryBtn, { flex: 1 }]} onPress={handleStuckPress} disabled={loadingStuck}>
                  {loadingStuck ? (
                    <Text style={[styles.secondaryBtnText, { fontSize: 18, fontWeight: "800" }]}>{helpingChars.join("")}</Text>
                  ) : (
                    <View style={{ alignItems: "center" }}>
                      <Text style={styles.secondaryBtnText}>Feeling stuck?</Text>
                      <Text style={[styles.secondaryBtnText, { fontSize: 18, fontWeight: "800" }]}>Get more steps</Text>
                    </View>
                  )}
                </Pressable>
                <Pressable style={[styles.actionBtn, styles.primaryBtnInline, { flex: 1 }]} onPress={handleDonePress}>
                  <Text style={[styles.primaryBtnText, { fontSize: 18, fontWeight: "800" }]}>Done early</Text>
                </Pressable>
              </View>
            </>
          )}

          {phase === "complete" && (
            <>
              <View style={styles.timerCard}>
                <Text style={styles.timerLabel}>Nice work</Text>
                <Text style={styles.timerText}>Block finished</Text>
                <Text style={styles.timerSub}>Choose the next move while momentum is still warm.</Text>
              </View>

              <View style={styles.actionColumn}>
                <Pressable style={styles.primaryBtn} onPress={handleDonePress}>
                  <Text style={styles.primaryBtnText}>Mark step done</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionBtn, styles.ghostBtn]}
                  onPress={() => handleStart(5)}
                >
                  <Text style={styles.ghostBtnText}>Continue for 5 more min</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionBtn, styles.secondaryBtn]}
                  onPress={handleStuckPress}
                  disabled={loadingStuck}
                >
                  {loadingStuck ? (
                    <Text style={[styles.secondaryBtnText, { fontSize: 18, fontWeight: "800" }]}>{helpingChars.join("")}</Text>
                  ) : (
                    <View style={{ alignItems: "center" }}>
                      <Text style={styles.secondaryBtnText}>Feeling stuck?</Text>
                      <Text style={[styles.secondaryBtnText, { fontSize: 18, fontWeight: "800" }]}>Get more steps</Text>
                    </View>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

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
    paddingBottom: 32,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  eyebrow: {
    fontSize: 26,
    fontWeight: "800",
    color: "#f97316",
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f4f4f5",
    alignItems: "center",
    justifyContent: "center",
  },
  stepCard: {
    backgroundColor: "#fff7ed",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#fed7aa",
    padding: 16,
    gap: 4,
  },
  stepAction: {
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 25,
    color: "#18181b",
  },
  stepExplanation: {
    fontSize: 13,
    lineHeight: 19,
    color: "#7c2d12",
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#71717a",
  },
  durationRow: {
    flexDirection: "row",
    gap: 10,
  },
  durationChip: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  durationChipSelected: {
    backgroundColor: "#18181b",
    borderColor: "#18181b",
  },
  durationChipText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#3f3f46",
  },
  durationChipTextSelected: {
    color: "#fff",
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#18181b",
    borderRadius: 16,
    paddingVertical: 15,
  },
  primaryBtnInline: {
    backgroundColor: "#18181b",
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  timerCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 6,
  },
  timerLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#71717a",
  },
  timerText: {
    fontSize: 36,
    fontWeight: "900",
    color: "#18181b",
    letterSpacing: -1,
  },
  timerSub: {
    fontSize: 13,
    lineHeight: 18,
    color: "#71717a",
    textAlign: "center",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionColumn: {
    gap: 10,
  },
  actionBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e4e4e7",
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#52525b",
  },
  ghostBtn: {
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
  },
  ghostBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#c2410c",
  },
});
