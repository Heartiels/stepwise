import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { transcribeWithOpenAI } from "@/src/services/speech";

type VoiceInputButtonProps = {
  onText: (text: string) => void;
};

type RecorderState = "idle" | "recording" | "processing";

const MIN_RECORDING_MS = 700;

export function VoiceInputButton({ onText }: VoiceInputButtonProps) {
  const recordingRef = useRef<Audio.Recording | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const startingRef = useRef(false); // prevents double-tap without flickering UI
  const [state, setState] = useState<RecorderState>("idle");

  useEffect(() => {
    return () => {
      void cleanupRecording();
    };
  }, []);

  async function cleanupRecording() {
    const current = recordingRef.current;
    recordingRef.current = null;
    startedAtRef.current = null;

    if (!current) return;

    try {
      const status = await current.getStatusAsync();
      if (status.isRecording || status.canRecord) {
        await current.stopAndUnloadAsync();
      }
    } catch {
      // Ignore cleanup failures.
    }

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
    } catch {
      // Ignore cleanup failures.
    }
  }

  async function startRecording() {
    if (state !== "idle" || startingRef.current) return;
    startingRef.current = true;

    try {
      await cleanupRecording();

      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        startingRef.current = false;
        setState("idle");
        Alert.alert("Microphone permission is required.");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = recording;
      startedAtRef.current = Date.now();
      startingRef.current = false;
      setState("recording");
    } catch (error: unknown) {
      await cleanupRecording();
      startingRef.current = false;
      setState("idle");
      Alert.alert(
        "Failed to start recording",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  async function stopRecording() {
    const recording = recordingRef.current;
    if (!recording || state !== "recording") return;

    setState("processing");

    try {
      await recording.stopAndUnloadAsync();
      const status = await recording.getStatusAsync();
      const durationMillis = status.durationMillis ?? 0;
      const fallbackDuration = startedAtRef.current ? Date.now() - startedAtRef.current : 0;
      const effectiveDuration = Math.max(durationMillis, fallbackDuration);
      const uri = recording.getURI();

      if (!uri) {
        throw new Error("No recording file was created.");
      }

      if (effectiveDuration < MIN_RECORDING_MS) {
        Alert.alert("Recording too short", "Tap once to start, speak, then tap again to stop.");
        return;
      }

      const text = await transcribeWithOpenAI(uri);
      if (!text) {
        Alert.alert(
          "Voice input unavailable",
          "No speech was detected, or the OpenAI API key is missing."
        );
        return;
      }

      onText(text);
    } catch (error: unknown) {
      Alert.alert(
        "Transcription failed",
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      recordingRef.current = null;
      startedAtRef.current = null;
      setState("idle");

      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        });
      } catch {
        // Ignore cleanup failures.
      }
    }
  }

  function handlePress() {
    if (state === "recording") {
      void stopRecording();
      return;
    }

    if (state === "idle") {
      void startRecording();
    }
  }

  const isRecording = state === "recording";
  const isProcessing = state === "processing";

  return (
    <View style={{ alignItems: "center" }}>
      <Pressable
        onPress={handlePress}
        disabled={isProcessing}
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: isRecording ? "#E11D48" : "#111",
          alignItems: "center",
          justifyContent: "center",
          opacity: isProcessing ? 0.6 : 1,
        }}
      >
        <Ionicons
          name={isProcessing ? "hourglass-outline" : isRecording ? "stop" : "mic"}
          size={14}
          color="#fff"
        />
      </Pressable>

    </View>
  );
}
