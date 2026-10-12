import type { StorageIncident } from '../../lib/storage-incidents'

const COPY_KEPT = 'A copy is kept in this browser.'

const ADD_RESUME = 'Add your resume again to continue.'
const REBUILD = 'Run Check my fit again to rebuild them.'

const WRITE_FAILED =
  'Your browser could not save your latest changes. Storage may be full. What you see now will be lost when you refresh.'

function partialLine(count: number, copyKept: boolean): string {
  const unreadable = count === 1 ? 'the unreadable one' : 'the unreadable ones'
  const tail = copyKept
    ? `The others are fine. ${COPY_KEPT}`
    : `The others are fine. A copy could not be kept, and ${unreadable} will be replaced the next time you save.`
  const verb = copyKept ? 'set aside' : 'left out'
  const subject =
    count === 1
      ? `1 saved fit check could not be read and was ${verb}.`
      : `${String(count)} saved fit checks could not be read and were ${verb}.`
  return `${subject} ${tail}`
}

function resumeLine(kind: 'unreadable' | 'newer', copyKept: boolean): string {
  if (kind === 'newer') {
    return copyKept
      ? `Your saved resume was written by a newer version of this app, so it was set aside and the page started without it. ${ADD_RESUME} ${COPY_KEPT}`
      : `Your saved resume was written by a newer version of this app, so the page started without it. A copy could not be kept, and that data will be replaced the next time you save. ${ADD_RESUME}`
  }
  return copyKept
    ? `Your saved resume could not be read, so it was set aside and the page started without it. ${ADD_RESUME} ${COPY_KEPT}`
    : `Your saved resume could not be read, so the page started without it. A copy could not be kept, and the unreadable data will be replaced the next time you save. ${ADD_RESUME}`
}

function fitChecksLine(kind: 'unreadable' | 'newer', copyKept: boolean): string {
  if (kind === 'newer') {
    return copyKept
      ? `Your saved fit checks were written by a newer version of this app, so they were set aside and the page started without them. ${REBUILD} ${COPY_KEPT}`
      : `Your saved fit checks were written by a newer version of this app, so the page started without them. A copy could not be kept, and that data will be replaced the next time you save. ${REBUILD}`
  }
  return copyKept
    ? `Your saved fit checks could not be read, so they were set aside. ${REBUILD} ${COPY_KEPT}`
    : `Your saved fit checks could not be read, so the page started without them. A copy could not be kept, and the unreadable data will be replaced the next time you save. ${REBUILD}`
}

// The fixed sentence for each incident, one per row of the storage notices table in the UI
// contract. It lives apart from the component because a component file may export only
// components. A sentence says a copy is kept only when one was written.
export function incidentLine(incident: StorageIncident): string {
  const { store, kind, copyKept } = incident
  if (kind === 'write_failed') return WRITE_FAILED
  if (kind === 'partial') return partialLine(incident.dropped ?? 0, copyKept)
  return store === 'resume' ? resumeLine(kind, copyKept) : fitChecksLine(kind, copyKept)
}
