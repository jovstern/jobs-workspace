import { canonicaliseResumeText, redactContactDetails } from '@jobs-workspace/shared'

// Matches the start of any resume or job tag, open or close, in any letter case, with optional
// spaces inside the bracket. Only the bracket is replaced, so the word stays readable.
const DATA_BLOCK_TAG = /<\s*(\/?)\s*(resume|job)/gi

// The single function that turns resume text into the string sent to the model. Contact details
// are removed here, on the server, whatever the browser sent (D-07, D-18). The output is also the
// string quotes are verified against, so the prompt and the verification see the same text.
//
// Steps, in order: canonical form, Unicode compatibility form, contact removal, then tag
// neutralisation so the text cannot close its own data block. Each step is idempotent, so
// preparing twice changes nothing.
//
// The compatibility form (NFKC) is the one quote checking compares in, so it is applied before
// removal: full-width digits and at-signs become plain ones and are caught, and the text that is
// sent is already in the form the quotes are matched against. The browser does not do this, since
// it would rewrite the saved text; for ordinary text the result still equals what the browser holds
// after canonicalising and redacting.
export function prepareResumeForModel(text: string): string {
  const redacted = redactContactDetails(canonicaliseResumeText(text).normalize('NFKC')).text
  return redacted.replace(
    DATA_BLOCK_TAG,
    (_match, slash: string, word: string) => `[${slash}${word}`,
  )
}
