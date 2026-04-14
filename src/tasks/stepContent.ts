export type StepContent = {
  emoji: string;
  action: string;
  explanation: string;
};

export type StepContentSource = {
  title?: string | null;
  emoji?: string | null;
  action?: string | null;
  explanation?: string | null;
};

export function parseStoredStepContent(value: string): StepContent {
  const [emoji = "", action = "", explanation = ""] = value.split("\n");

  return {
    emoji: emoji.trim() || "•",
    action: action.trim() || value.trim(),
    explanation: explanation.trim(),
  };
}

export function readStepContent(source: StepContentSource): StepContent {
  const parsedFromTitle = parseStoredStepContent(source.title?.trim() ?? "");
  const emoji = source.emoji?.trim() || parsedFromTitle.emoji;
  const action = source.action?.trim() || parsedFromTitle.action;
  const explanation = source.explanation?.trim() || parsedFromTitle.explanation;

  return {
    emoji,
    action,
    explanation,
  };
}

export function formatStoredStepContent(step: StepContent): string {
  return [
    step.emoji.trim() || "•",
    step.action.trim(),
    step.explanation.trim(),
  ].join("\n");
}
