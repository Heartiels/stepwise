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
    return await editSteps(
      goalTitle,
      currentSteps,
      [selectedIndex],
      "Break this step into 2-3 much smaller actions for a low-energy user who feels stuck right now. Keep them sequential, concrete, and easy to start in under 2 minutes each."
    );
  } catch (err) {
    console.warn("[Stepwise] Step breakdown failed. Using local fallback.", err);
    return mockBreakStepIntoSmallerActions(target);
  }
}
