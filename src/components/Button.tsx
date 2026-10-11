import type { ComponentProps } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'link'

type ButtonProps = ComponentProps<'button'> & { variant?: ButtonVariant }

const BASE =
  'inline-flex items-center justify-center rounded font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700'

// Buttons are 44px tall (min-h-11) so touch targets stay comfortable; the link style is plain text.
const SOLID = 'min-h-11 px-4 py-2 text-base'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: `${SOLID} bg-blue-700 text-white hover:bg-blue-800`,
  secondary: `${SOLID} border border-gray-300 bg-white text-gray-900 hover:bg-gray-50`,
  destructive: `${SOLID} bg-red-700 text-white hover:bg-red-800 focus-visible:outline-red-700`,
  link: 'text-sm text-blue-700 underline hover:text-blue-800',
}

// An unavailable action sets aria-disabled and explains itself in nearby text; it never uses the
// native disabled attribute, so it stays focusable and discoverable. The look comes from the
// aria-disabled variants below, and the click handler is the caller's job to ignore.
const UNAVAILABLE =
  'aria-disabled:cursor-not-allowed aria-disabled:border-transparent aria-disabled:bg-gray-200 aria-disabled:text-gray-700 aria-disabled:hover:bg-gray-200'

export function Button({
  variant = 'secondary',
  type = 'button',
  className,
  ...props
}: ButtonProps) {
  const classes = [BASE, VARIANTS[variant], UNAVAILABLE, className].filter(Boolean).join(' ')
  return <button type={type} className={classes} {...props} />
}
