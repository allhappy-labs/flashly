export type LearnGoal = "cram" | "memorize";
export type LearnFamiliarity = "new" | "some" | "mostly";
export type LearnQuestionType = "multiple_choice" | "written";
export type LearnGrading = "strict" | "smart";
export type LearnDirection = "term" | "definition";
export type LearnScope = "all" | "not_studied" | "learning" | "mastered";
export type LearnFormatPreset = "QA" | "Cloze" | "Definition" | "Mixed";
export type LearnOptions = {
  goal: LearnGoal;
  familiarity: LearnFamiliarity;
  questionTypes: LearnQuestionType[];
  grading: LearnGrading;
  retypeAfterMiss: boolean;
  direction: LearnDirection;
  scope: LearnScope;
  starredOnly: boolean;
  formatPreset: LearnFormatPreset;
};
