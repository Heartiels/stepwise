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
- Don't output complex instructional content or lengthy background explanations; If necessary, place them in “Action Tips” or footnotes, and keep them concise.
- Do NOT include a “set a timer” step unless timing is genuinely critical to the goal. Avoid generic productivity filler steps.`;

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

export async function decomposeTask(goal: string, personalContext?: string): Promise<DecomposedTask> {
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

  const systemPromptWithContext = personalContext?.trim()
    ? `${SYSTEM_PROMPT}\n\n【User Context】\n${personalContext.trim()}`
    : SYSTEM_PROMPT;

  try {
    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content: systemPromptWithContext,
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

// ─── Edit existing steps ───────────────────────────────────────────────────────

export async function editSteps(
  goalTitle: string,
  currentSteps: DecomposedStep[],
  selectedIndices: number[], // 0-based; empty = apply to all
  userRequest: string
): Promise<DecomposedStep[]> {
  const openai = getClient();
  if (!openai) throw new Error("OpenAI API key not configured.");

  const isPartial = selectedIndices.length > 0;

  // Only send selected steps to LLM — non-selected steps never touch LLM
  const stepsToEdit = isPartial
    ? selectedIndices.map((i) => currentSteps[i])
    : currentSteps;

  const stepsText = stepsToEdit
    .map((s, i) => `Step ${i + 1}: ${s.emoji} ${s.action} — ${s.explanation}`)
    .join("\n");

  const systemPrompt = `You are a productivity coach helping a user refine steps of an action plan.
You may return more or fewer steps than provided (e.g. break one step into multiple).
Keep each explanation to 1-2 sentences max. Return ONLY valid JSON.`;

  const userMessage = isPartial
    ? `Goal: "${goalTitle}"\n\nStep(s) to modify:\n${stepsText}\n\nUser's request: ${userRequest}\n\nReturn the replacement step(s).`
    : `Goal: "${goalTitle}"\n\nCurrent steps:\n${stepsText}\n\nUser's request: ${userRequest}\n\nReturn the complete updated step list.`;

  const response = await openai.responses.create({
    model: "gpt-4o-mini",
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "step_edit",
        strict: true,
        schema: {
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
        },
      },
    },
  });

  const llmSteps = (JSON.parse(response.output_text) as { steps: DecomposedStep[] }).steps;

  if (!isPartial) return llmSteps;

  // Splice LLM replacements into the original array at the position of selected steps.
  // Non-selected steps are taken directly from currentSteps — LLM never touched them.
  const selectedSet = new Set(selectedIndices);
  const result: DecomposedStep[] = [];
  let inserted = false;

  for (let i = 0; i < currentSteps.length; i++) {
    if (selectedSet.has(i)) {
      if (!inserted) {
        // Insert all LLM-returned replacements at the first selected position
        result.push(...llmSteps);
        inserted = true;
      }
      // Skip remaining selected steps (replaced by llmSteps above)
    } else {
      result.push(currentSteps[i]);
    }
  }

  return result;
}