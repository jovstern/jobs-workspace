// Red-phase placeholder: replaced by the real lookup in the next commit.
export interface FitErrorView {
  code: string
  message: string
  retryable: boolean
  action: 'edit_resume' | null
}

export function describeFitError(failure: unknown): FitErrorView {
  return { code: typeof failure, message: '', retryable: false, action: null }
}
