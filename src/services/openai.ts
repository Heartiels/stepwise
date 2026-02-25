import OpenAI from "openai";

export type DecomposedStep = {
  emoji: string;
  action: string;
  explanation: string;
};

export type DecomposedTask = {
  title: string;
  steps: DecomposedStep[];
  actionTips: string[];
};

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
- Don't output complex instructional content or lengthy background explanations; If necessary, place them in “Action Tips” or footnotes, and keep them concise.`;

const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

// Lazy init
let client: OpenAI | null = null;
function getClient() {
  if (!apiKey) return null;
  if (!client) {
    client = new OpenAI({
      apiKey,
    });
  }
  return client;
}

//  Mock fallback
function mockDecomposeTask(goal: string): DecomposedTask {
  const t = goal.trim() || "My Goal";
  return {
    title: t,
    steps: [
      {
        emoji: "🎯",
        action: "Define the outcome",
        explanation: `Write one clear sentence for what “${t}” means.`,
      },
      {
        emoji: "🧩",
        action: "Break into smaller parts",
        explanation: "List 3–5 smaller sub-tasks you can finish independently.",
      },
      {
        emoji: "📅",
        action: "Pick today’s first step",
        explanation: "Choose the easiest useful step and schedule it for today.",
      },
      {
        emoji: "⏱️",
        action: "Work in a short focus block",
        explanation: "Start with 15–25 minutes and avoid multitasking.",
      },
      {
        emoji: "✅",
        action: "Review and continue",
        explanation: "Mark progress and decide the next smallest step.",
      },
    ],
    actionTips: [
      "Start with just 5 minutes — momentum beats motivation.",
      "When stuck, pick the smallest possible next action.",
      "Check off each step to build a visible sense of progress.",
    ],
  };
}

export async function decomposeTask(goal: string): Promise<DecomposedTask> {
  const trimmed = goal.trim();
  if (!trimmed) {
    throw new Error("Goal cannot be empty");
  }

  //  No key => use mock instead of crashing
  const openai = getClient();
  if (!openai) {
    console.warn(
      "[Stepwise] EXPO_PUBLIC_OPENAI_API_KEY not found. Using mock decomposition data."
    );
    return mockDecomposeTask(trimmed);
  }

  try {
    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: `Break this goal into steps: ${trimmed}`,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "task_decomposition",
          strict: true,
          schema: {
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
          },
        },
      },
    });

    const parsed = JSON.parse(response.output_text) as DecomposedTask;

    if (!parsed?.title || !Array.isArray(parsed?.steps) || parsed.steps.length === 0) {
      throw new Error("Invalid OpenAI response format");
    }

    return parsed;
  } catch (err) {
    console.warn("[Stepwise] OpenAI request failed. Falling back to mock data.", err);
    return mockDecomposeTask(trimmed);
  }
}