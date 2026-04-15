const fs = require("fs");
const http = require("http");
const path = require("path");

const PORT = Number(process.env.PORT || 8787);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || loadEnvFile(".env").OPENAI_API_KEY || "";
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const OPENAI_TRANSCRIPTIONS_URL = "https://api.openai.com/v1/audio/transcriptions";

const SYSTEM_PROMPT = `【System Role】
You focus on "zero-friction start" and "actionability." Your goal is to help users break down their goals into immediately executable small steps with minimal cognitive cost, spark instant sense of achievement, and help users get started and keep moving forward.

【Input】
- The user provides only a one-sentence goal (e.g., "I want to learn JavaScript"). Always treat this sentence as the only context, unless the user proactively provides more constraints or preferences.
- If the user explicitly states they are in a "hands-free" or "mobile" scenario, you may include an alternative hands-free step in the output.

【Output Format & Style Requirements】
- Number of steps: 5-9.
- Each step consists of two lines:
  1. A short action sentence with emoji (verb-first, be specific)
  2. A brief explanation (1-2 sentences explaining the immediate reward or why it lowers the barrier)
- The first step must be a "physical action" completable in ≤ 60 seconds ((e.g., turn on computer, create a folder, pick up a pen))
- Remaining steps should be completable in ≤5 minutes each
- Language style: concise, standalone, actionable, avoid piling on technical details
- Content: short sentences, just enough info, suitable for low-energy users to execute immediately.
- No complex setup, installation, or multiple inputs required; No ads or links leading to complex external processes (resource names like “MDN” or “official tutorial” are acceptable)
- Must include exactly 3 "Action Tips" (short phrases), providing specific instant motivation and anti-stuck techniques relevant to this specific goal ((e.g., 5-minute self-check, fixed time slots, immediate rewards upon completion, etc.))

【Generation Rules】
- Prioritize tools the user is already familiar with (browser, notepad/code editor, phone timer)
- Emphasize immediately visible results  (e.g., creating a file, seeing console output, checking off a completed item)
- Each step should help users overcome procrastination with minimal options and the clearest next step
- Don't output complex instructional content or lengthy background explanations; If necessary, place them in “Action Tips” or footnotes, and keep them concise.
- Do NOT include a “set a timer” step unless timing is genuinely critical to the goal. Avoid generic productivity filler steps.`;

const EDIT_SYSTEM_PROMPT = `You are a productivity coach helping a user refine steps of an action plan.

【Context awareness】
- You will always receive the full step list and the overall goal. Read them carefully before responding.
- Every step you produce must stay coherent with the goal and the surrounding steps. Never introduce actions that are off-topic or disconnected from what comes before and after.
- The marked step(s) exist within a larger plan — your replacements must feel like a natural part of that plan, not standalone advice.

【Output rules】
- You may return more or fewer steps than the marked ones (e.g. break one into multiple, or combine multiple into one).
- Each step has three separate fields:
  • "action": a single verb-first sentence only — no newlines, no dashes, no explanation embedded here.
  • "explanation": 1-2 sentences explaining the immediate reward or why this lowers the barrier. Keep this in explanation only, never inside action.
  • "emoji": exactly one emoji — never combine multiple.
- Language: concise, actionable, suitable for a low-energy user. No vague filler steps.
- Return ONLY valid JSON.`;

const taskDecompositionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    steps: {
      type: "array",
      minItems: 5,
      maxItems: 9,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          emoji: { type: "string" },
          action: { type: "string" },
          explanation: { type: "string" },
        },
        required: ["emoji", "action", "explanation"],
      },
    },
    actionTips: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: { type: "string" },
    },
  },
  required: ["title", "steps", "actionTips"],
};

const stepEditSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    steps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          emoji: { type: "string" },
          action: { type: "string" },
          explanation: { type: "string" },
        },
        required: ["emoji", "action", "explanation"],
      },
    },
  },
  required: ["steps"],
};

function loadEnvFile(fileName) {
  const envPath = path.join(process.cwd(), fileName);
  if (!fs.existsSync(envPath)) {
    return {};
  }

  const content = fs.readFileSync(envPath, "utf8");
  const entries = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
    entries[key] = value;
  }

  return entries;
}

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  setCorsHeaders(response);
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, message) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "text/plain; charset=utf-8");
  setCorsHeaders(response);
  response.end(message);
}

async function readRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function parseJsonBody(buffer) {
  if (!buffer.length) return {};
  return JSON.parse(buffer.toString("utf8"));
}

function ensureOpenAiKey() {
  if (!OPENAI_API_KEY) {
    const error = new Error("OPENAI_API_KEY is not configured for the Stepwise API server.");
    error.statusCode = 503;
    throw error;
  }
}

async function callResponsesApi(input, schemaName, schema) {
  ensureOpenAiKey();

  const result = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      input,
      text: {
        format: {
          type: "json_schema",
          name: schemaName,
          strict: true,
          schema,
        },
      },
    }),
  });

  const payload = await result.text();
  if (!result.ok) {
    throwOpenAiError(result.status, payload);
  }

  const parsed = JSON.parse(payload);

  // Responses API: output[0].content[0].text
  const outputText =
    parsed.output_text ??
    parsed.output?.[0]?.content?.[0]?.text ??
    parsed.output?.[0]?.content?.[0]?.value;

  if (typeof outputText !== "string" || !outputText.trim()) {
    throw new Error("OpenAI returned an empty response.");
  }

  return JSON.parse(outputText);
}

function throwOpenAiError(statusCode, rawBody) {
  let message = `OpenAI request failed with status ${statusCode}.`;

  try {
    const payload = JSON.parse(rawBody);
    const apiMessage = payload?.error?.message;
    if (typeof apiMessage === "string" && apiMessage.trim()) {
      message = apiMessage.trim();
    }
  } catch {
    // keep generic message
  }

  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

async function handleDecompose(request, response) {
  const body = parseJsonBody(await readRequestBody(request));
  const goal = typeof body.goal === "string" ? body.goal.trim() : "";
  const personalContext = typeof body.personalContext === "string" ? body.personalContext.trim() : "";

  if (!goal) {
    sendJson(response, 400, { error: { message: "Goal cannot be empty." } });
    return;
  }

  const systemPromptWithContext = personalContext
    ? `${SYSTEM_PROMPT}\n\n【User Context】\n${personalContext}`
    : SYSTEM_PROMPT;

  const result = await callResponsesApi(
    [
      { role: "system", content: systemPromptWithContext },
      { role: "user", content: `Break this goal into steps: ${goal}` },
    ],
    "task_decomposition",
    taskDecompositionSchema
  );

  sendJson(response, 200, result);
}

async function handleEditSteps(request, response) {
  const body = parseJsonBody(await readRequestBody(request));
  const goalTitle = typeof body.goalTitle === "string" ? body.goalTitle.trim() : "";
  const currentSteps = Array.isArray(body.currentSteps) ? body.currentSteps : [];
  const selectedIndices = Array.isArray(body.selectedIndices) ? body.selectedIndices : [];
  const userRequest = typeof body.userRequest === "string" ? body.userRequest.trim() : "";

  if (!goalTitle || !userRequest || currentSteps.length === 0) {
    sendJson(response, 400, { error: { message: "Missing required edit payload." } });
    return;
  }

  const isPartial = selectedIndices.length > 0;
  const selectedSet = new Set(selectedIndices);

  // Always pass the full step list so the LLM has complete context.
  // Mark the steps to modify so the LLM knows which ones to replace.
  const allStepsText = currentSteps
    .map((step, index) => {
      const marker = selectedSet.has(index) ? " ← MODIFY THIS" : "";
      return `Step ${index + 1}${marker}: ${step.emoji} ${step.action} — ${step.explanation}`;
    })
    .join("\n");

  const userMessage = isPartial
    ? `Goal: "${goalTitle}"\n\nFull step list (keep all steps in mind for context and coherence):\n${allStepsText}\n\nUser's request for the marked step(s): ${userRequest}\n\nReturn ONLY the replacement step(s) for the marked ones. Do not return the full list.`
    : `Goal: "${goalTitle}"\n\nCurrent steps:\n${allStepsText}\n\nUser's request: ${userRequest}\n\nReturn the complete updated step list.`;

  const result = await callResponsesApi(
    [
      { role: "system", content: EDIT_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    "step_edit",
    stepEditSchema
  );

  // Sanitize: action must be a single line (strip anything after the first newline or " — ")
  const sanitizedSteps = result.steps.map((s) => ({
    ...s,
    action: s.action.split(/\n|—/)[0].trim(),
  }));

  if (isPartial) {
    // Splice the replacement steps back into the full list at the selected positions
    const minIndex = Math.min(...selectedIndices);
    const fullSteps = [...currentSteps];
    const sortedDesc = [...selectedIndices].sort((a, b) => b - a);
    for (const idx of sortedDesc) {
      fullSteps.splice(idx, 1);
    }
    fullSteps.splice(minIndex, 0, ...sanitizedSteps);
    sendJson(response, 200, { steps: fullSteps });
  } else {
    sendJson(response, 200, { steps: sanitizedSteps });
  }
}

async function handleTranscribe(request, response) {
  ensureOpenAiKey();

  const contentType = request.headers["content-type"] || "";
  if (!String(contentType).includes("multipart/form-data")) {
    sendJson(response, 400, { error: { message: "Expected multipart/form-data upload." } });
    return;
  }

  const body = await readRequestBody(request);
  const result = await fetch(OPENAI_TRANSCRIPTIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": contentType,
    },
    body,
  });

  const payload = await result.arrayBuffer();
  response.statusCode = result.status;
  response.setHeader("Content-Type", result.headers.get("content-type") || "application/json; charset=utf-8");
  setCorsHeaders(response);
  response.end(Buffer.from(payload));
}

const server = http.createServer(async (request, response) => {
  try {
    if (!request.url || !request.method) {
      sendJson(response, 400, { error: { message: "Bad request." } });
      return;
    }

    if (request.method === "OPTIONS") {
      response.statusCode = 204;
      setCorsHeaders(response);
      response.end();
      return;
    }

    if (request.method === "GET" && request.url === "/health") {
      sendJson(response, 200, {
        ok: true,
        hasOpenAiKey: Boolean(OPENAI_API_KEY),
      });
      return;
    }

    if (request.method === "POST" && request.url === "/api/decompose") {
      await handleDecompose(request, response);
      return;
    }

    if (request.method === "POST" && request.url === "/api/edit-steps") {
      await handleEditSteps(request, response);
      return;
    }

    if (request.method === "POST" && request.url === "/api/transcribe") {
      await handleTranscribe(request, response);
      return;
    }

    sendText(response, 404, "Not found");
  } catch (error) {
    const statusCode = typeof error.statusCode === "number" ? error.statusCode : 500;
    sendJson(response, statusCode, {
      error: {
        message: error instanceof Error ? error.message : "Unexpected server error.",
      },
    });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[Stepwise API] Listening on http://0.0.0.0:${PORT}`);
  console.log(`[Stepwise API] OPENAI_API_KEY configured: ${OPENAI_API_KEY ? "yes" : "no"}`);
});
