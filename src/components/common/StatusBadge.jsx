import { AlertTriangle, CircleDashed, CircleHelp, CirclePause, CircleSlash, Loader2, Radio, Wifi } from 'lucide-react'

const MAP = {
  live: { label: 'Live', icon: Radio },
  offline: { label: 'Offline', icon: CircleSlash },
  checking: { label: 'Checking', icon: Loader2 },
  unknown: { label: 'Unknown', icon: CircleHelp },
  error: { label: 'Error', icon: AlertTriangle },
  disabled: { label: 'Monitoring off', icon: CirclePause },
  online: { label: 'Online', icon: Wifi },
  degraded: { label: 'Degraded', icon: AlertTriangle },
  starting: { label: 'Starting', icon: Loader2 },
  svcOffline: { label: 'Offline', icon: CircleSlash },
  svcDisabled: { label: 'Disabled', icon: CircleDashed }
}

export default function StatusBadge({ status }) {
  const { label, icon: Icon } = MAP[status] || MAP.unknown
  const spin = status === 'checking' || status === 'starting'
  return (
    <span className={`badge badge-${status}`}>
      <Icon size={12} className={spin ? 'spin' : ''} aria-hidden />
      {label}
    </span>
  )
}
