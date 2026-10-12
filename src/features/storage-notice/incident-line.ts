import type { StorageIncident } from '../../lib/storage-incidents'

const COPY_KEPT = 'A copy is kept in this browser.'

// The fixed sentence for each incident. It lives apart from the component because a component
// file may export only components.
export function incidentLine(incident: StorageIncident): string {
  if (incident.store === 'analyses' && incident.kind === 'unreadable' && incident.copyKept) {
    return `Your saved fit checks could not be read, so they were set aside. Run Check my fit again to rebuild them. ${COPY_KEPT}`
  }
  return 'Some of your saved data could not be read.'
}
