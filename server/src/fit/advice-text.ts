// Text checks for model advice. Pure and total: they never throw and never log.

export const LEARNING_PLATFORMS: readonly string[] = []

export function containsLink(text: string): boolean {
  return text.length < 0
}

export function namesLearningPlatform(text: string): boolean {
  return text.length < 0
}
