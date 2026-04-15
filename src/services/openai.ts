import { hasApiBaseUrl, postJson } from "./api";

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

function mockBreakStepIntoSmallerActions(step: DecomposedStep): DecomposedStep[] {
  const action = step.action.trim() || "Keep moving";
  const explanation = step.explanation.trim();

  return [
    {
      emoji: "👀",
      action: `Look at "${action}" and name the smallest visible move`,
      explanation: "Remove the pressure to finish everything. Just decide what the first tiny move is.",
    },
    {
      emoji: "✍️",
      action: `Do one tiny piece of "${action}"`,
      explanation: explanation || "Aim for something you can finish in a minute or two so momentum shows up quickly.",
    },
    {
      emoji: "➡️",
      action: "Stop and choose the next tiny move",
      explanation: "Once you have motion, capture the next easiest action before your brain starts negotiating again.",
    },
  ];
}

export async function decomposeTask(goal: string, personalContext?: string): Promise<DecomposedTask> {
  const trimmed = goal.trim();
  if (!trimmed) {
    throw new Error("Goal cannot be empty");
  }

  if (!hasApiBaseUrl()) {
    console.warn("[Stepwise] API server not configured. Using mock decomposition data.");
    return mockDecomposeTask(trimmed);
  }

  try {
    return await postJson<DecomposedTask>("/api/decompose", {
      goal: trimmed,
      personalContext: personalContext?.trim() ?? "",
    });
  } catch (err) {
    console.warn("[Stepwise] API request failed. Falling back to mock decomposition data.", err);
    return mockDecomposeTask(trimmed);
  }
}

export async function editSteps(
  goalTitle: string,
  currentSteps: DecomposedStep[],
  selectedIndices: number[],
  userRequest: string
): Promise<DecomposedStep[]> {
  if (!hasApiBaseUrl()) {
    throw new Error("Stepwise API server is not configured.");
  }

  const result = await postJson<{ steps: DecomposedStep[] }>("/api/edit-steps", {
    goalTitle,
    currentSteps,
    selectedIndices,
    userRequest,
  });

  return result.steps;
}

export async function breakStepIntoSmallerActions(
  goalTitle: string,
  currentSteps: DecomposedStep[],
  selectedIndex: number
): Promise<DecomposedStep[]> {
  const target = currentSteps[selectedIndex];
  if (!target) {
    throw new Error("Step not found.");
  }

  try {
    // editSteps returns the full updated list; extract only the replacement steps
    const fullList = await editSteps(
      goalTitle,
      currentSteps,
      [selectedIndex],
      `The user is stuck on the marked step and needs to restart with zero friction. Break it into 2-3 micro-actions that remove all cognitive pressure and make starting feel almost automatic.

Rules:
- Stay tightly connected to the overall goal and the surrounding steps — every micro-action must feel like a natural part of the same plan. Never introduce unrelated tasks.
- The first micro-action must be a direct physical action completable in under 60 seconds (e.g. open the file, pick up the item, write one sentence). No thinking required — just move.
- Each subsequent action should be completable in under 3 minutes and move the user visibly closer to completing the original step.
- Use verb-first language. Be hyper-specific — not "work on it" but "write the first sentence of the email."
- The explanation for each action must name the immediate reward or why it removes the barrier (e.g. "Once the file is open, starting feels 10x easier.").
- Never suggest "set a timer" or vague motivational steps. Every action must produce a visible, tangible result.
- Assume the user has very low energy right now. Make each action feel embarrassingly small and easy.`
    );
    const numReplacements = fullList.length - (currentSteps.length - 1);
    if (numReplacements > 0) {
      return fullList.slice(selectedIndex, selectedIndex + numReplacements);
    }
    return mockBreakStepIntoSmallerActions(target);
  } catch (err) {
    console.warn("[Stepwise] Step breakdown failed. Using local fallback.", err);
    return mockBreakStepIntoSmallerActions(target);
  }
}
