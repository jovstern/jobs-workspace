import { Button } from '../../components/Button'
import { Notice } from '../../components/Notice'
import { useStorageIncidents } from '../../lib/storage-incidents'
import { incidentLine } from './incident-line'

interface StorageNoticeProps {
  onDismiss?: () => void
}

// One caution notice for everything saved-data related: a line per incident and one Dismiss.
// There is deliberately no download, restore or erase control: the set-aside copy is only kept.
export function StorageNotice({ onDismiss }: StorageNoticeProps) {
  const incidents = useStorageIncidents((state) => state.incidents)
  const dismissAll = useStorageIncidents((state) => state.dismissAll)

  if (incidents.length === 0) return null

  return (
    <div className="mb-6">
      <Notice tone="caution" role="alert">
        <ul className="flex flex-col gap-2">
          {incidents.map((incident) => (
            <li key={incident.id}>{incidentLine(incident)}</li>
          ))}
        </ul>
        <Button
          variant="secondary"
          onClick={() => {
            dismissAll()
            onDismiss?.()
          }}
        >
          Dismiss
        </Button>
      </Notice>
    </div>
  )
}
