import { useEffect, useState } from 'react'

import { progressLine } from './progress-lines'

// The stage line of a running check. It is mounted only while a check is pending, so its clock
// restarts with every check. The elapsed time drives the words and is never shown as a number.
export function FitProgress() {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  // A timer is an outside system, which is what an effect is for. The clock is read here and in
  // the callback only, never during render, and from the real clock rather than a tick count so a
  // background tab that throttles the interval still reports the true elapsed time.
  useEffect(() => {
    const startedAt = Date.now()
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)
    return () => {
      clearInterval(interval)
    }
  }, [])

  return <p className="text-base text-gray-900">{progressLine(elapsedSeconds)}</p>
}
