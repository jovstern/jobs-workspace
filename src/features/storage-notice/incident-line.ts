import type { StorageIncident } from '../../lib/storage-incidents'

const COPY_KEPT = 'A copy is kept in this browser.'

const ADD_RESUME = 'Add your resume again to continue.'
const REBUILD = 'Run Check my fit again to rebuild them.'

// The fixed sentence for each incident. It lives apart from the component because a component
// file may export only components.
export function incidentLine(incident: StorageIncident): string {
  const { store, kind } = incident

  if (kind === 'partial') {
    const count = incident.dropped ?? 0
    const subject =
      count === 1
        ? '1 saved fit check could not be read and was set aside.'
        : `${String(count)} saved fit checks could not be read and were set aside.`
    return `${subject} The others are fine. ${COPY_KEPT}`
  }

  if (store === 'resume') {
    return kind === 'newer'
      ? `Your saved resume was written by a newer version of this app, so it was set aside and the page started without it. ${ADD_RESUME} ${COPY_KEPT}`
      : `Your saved resume could not be read, so it was set aside and the page started without it. ${ADD_RESUME} ${COPY_KEPT}`
  }

  return kind === 'newer'
    ? `Your saved fit checks were written by a newer version of this app, so they were set aside and the page started without them. ${REBUILD} ${COPY_KEPT}`
    : `Your saved fit checks could not be read, so they were set aside. ${REBUILD} ${COPY_KEPT}`
}
