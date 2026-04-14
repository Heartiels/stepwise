import * as FileSystem from "expo-file-system/legacy";
import { getApiBaseUrl } from "./api";

const MIN_FILE_SIZE_BYTES = 1024;
const CJK_CHAR_REGEX = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;

function ensureFileUri(uri: string) {
  return uri.startsWith("file://") ? uri : `file://${uri}`;
}

function parseTranscriptionError(status: number, body: string) {
  try {
    const payload = JSON.parse(body);
    const message = payload?.error?.message;
    const code = payload?.error?.code;

    if (code === "audio_too_short") {
      return "Recording was too short. Please speak a bit longer and try again.";
    }

    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  } catch {
    // Fall through to the generic message below.
  }

  return `Request failed with status ${status}.`;
}

export async function transcribeWithOpenAI(uri: string): Promise<string> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) return "";

  const fileUri = ensureFileUri(uri);
  const info = await FileSystem.getInfoAsync(fileUri);
  const fileSize = "size" in info && typeof info.size === "number" ? info.size : 0;

  if (!info.exists) {
    throw new Error("Recording file was not found.");
  }

  if (fileSize < MIN_FILE_SIZE_BYTES) {
    throw new Error("Recording was too short. Please speak a bit longer and try again.");
  }

  const result = await FileSystem.uploadAsync(`${baseUrl}/api/transcribe`, fileUri, {
    httpMethod: "POST",
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName: "file",
    mimeType: "audio/m4a",
    parameters: {
      model: "whisper-1",
      language: "en",
      prompt: "Transcribe the speech in English only. Keep English words in English. Do not translate into Chinese.",
    },
  });

  if (result.status < 200 || result.status >= 300) {
    throw new Error(parseTranscriptionError(result.status, result.body));
  }

  let payload: { text?: unknown };
  try {
    payload = JSON.parse(result.body);
  } catch {
    throw new Error("OpenAI returned an unreadable response.");
  }

  const text = typeof payload.text === "string" ? payload.text.trim() : "";
  if (!text) return "";

  if (CJK_CHAR_REGEX.test(text)) {
    throw new Error("Please speak in English. The transcript was returned in Chinese.");
  }

  return text;
}
