export function formatFocusDurationLabel(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  if (safeSeconds < 60) {
    return `${safeSeconds}s focused`;
  }

  const totalMinutes = Math.round(safeSeconds / 60);
  if (totalMinutes < 60) {
    return `${totalMinutes} min focused`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) {
    return `${hours}h focused`;
  }

  return `${hours}h ${minutes}m focused`;
}
