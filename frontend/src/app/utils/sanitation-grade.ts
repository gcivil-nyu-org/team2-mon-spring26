export const SANITATION_GRADE_DESCRIPTIONS: Record<string, string> = {
  Z: 'Initial Grade Pending',
  N: 'Not Yet Graded',
  P: 'Grade Pending after initial inspection resulting in closure',
};

export function formatSanitationGradeLabel(grade: string): string {
  const description = SANITATION_GRADE_DESCRIPTIONS[grade];
  return description ? `${grade} (${description})` : grade;
}
