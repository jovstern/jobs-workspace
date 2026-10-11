import { canonicaliseResumeText, redactContactDetails } from '@jobs-workspace/shared'

// Matches the start of any resume or job tag, open or close, in any letter case, with optional
// spaces inside the bracket. Only the bracket is replaced, so the word stays readable.
const DATA_BLOCK_TAG = /<\s*(\/?)\s*(resume|job)/gi

// The single function that turns resume text into the string sent to the model. Contact details
// are removed here, on the server, whatever the browser sent (D-07, D-18). The output is also the
// string quotes are verified against, so the prompt and the verification see the same text.
//
// Steps, in order: canonical form, contact removal, then tag neutralisation so the text cannot
// close its own data block. Each step is idempotent, so preparing twice changes nothing. Apart
// from the tag step, the result equals what the browser holds after canonicalising and redacting.
export function prepareResumeForModel(text: string): string {
  const redacted = redactContactDetails(canonicaliseResumeText(text)).text
  return redacted.replace(
    DATA_BLOCK_TAG,
    (_match, slash: string, word: string) => `[${slash}${word}`,
  )
}
