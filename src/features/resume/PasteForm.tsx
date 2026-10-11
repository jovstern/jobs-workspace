interface PasteFormProps {
  onSaved?: () => void
}

// RED stub: the real form follows in the next commit.
export function PasteForm({ onSaved }: PasteFormProps) {
  return onSaved === undefined ? null : null
}
