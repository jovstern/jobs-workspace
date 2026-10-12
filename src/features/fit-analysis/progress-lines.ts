// What the user reads while a check runs. The lines follow typical elapsed time; they are not a
// report of what the server is doing, which sends nothing until its answer is complete. They live
// outside the component file so the component file exports only a component.

// The one home of the reassurance sentence.
export const FIT_REASSURANCE = 'Usually 10 to 20 seconds.'

const STAGES = [
  { fromSeconds: 30, line: 'Still working. This can take up to a minute.' },
  { fromSeconds: 10, line: 'Writing your learning plan and tips' },
  { fromSeconds: 4, line: 'Comparing it with each requirement' },
]
const FIRST_LINE = 'Reading your resume'

// Anything that is not a number of at least 4 gives the first line.
export function progressLine(elapsedSeconds: number): string {
  return STAGES.find((stage) => elapsedSeconds >= stage.fromSeconds)?.line ?? FIRST_LINE
}
