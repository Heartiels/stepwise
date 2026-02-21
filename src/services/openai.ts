import OpenAI from "openai";

type DecomposedTask = {
  title: string;
  steps: { emoji: string; action: string; explanation: string }[];
};

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
          content:
            "You are a productivity coach. Break a user's goal into 5-9 small, actionable steps. Return concise structured JSON only.",
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
            },
            required: ["title", "steps"],
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