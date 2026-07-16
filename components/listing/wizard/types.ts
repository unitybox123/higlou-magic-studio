export type WizardStep =
  | "photos"
  | "analyzing"
  | "reveal"
  | "review"
  | "export";

/** User-facing progress: Photos → Understand → Build Listing → Export. */
export const WIZARD_PROGRESS_STEPS = [
  { id: "photos", label: "Add Photos" },
  { id: "analyzing", label: "Understand" },
  { id: "review", label: "Build Listing" },
  { id: "export", label: "Review & Export" },
] as const;

export function wizardStepToProgressIndex(step: WizardStep): number {
  switch (step) {
    case "photos":
      return 0;
    case "analyzing":
    case "reveal":
      return 1;
    case "review":
      return 2;
    case "export":
      return 3;
    default:
      return 0;
  }
}

export function wizardStepOfLabel(step: WizardStep, exported = false): string {
  if (exported) return `${WIZARD_PROGRESS_STEPS.length} of ${WIZARD_PROGRESS_STEPS.length}`;
  const index = wizardStepToProgressIndex(step);
  return `${index + 1} of ${WIZARD_PROGRESS_STEPS.length}`;
}
