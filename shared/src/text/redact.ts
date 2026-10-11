// RED-phase stand-in: returns the text unchanged so the fixture tests fail on their assertions.
export interface RedactionCounts {
  email: number
  phone: number
  address: number
  link: number
}

export function redactContactDetails(text: string): { text: string; counts: RedactionCounts } {
  return { text, counts: { email: 0, phone: 0, address: 0, link: 0 } }
}
