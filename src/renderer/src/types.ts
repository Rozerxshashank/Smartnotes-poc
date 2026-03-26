export interface Note {
  id: string
  title: string
  content: string
  lastModified: Date
}


export function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 10) return 'Just now'
  if (diffSec < 60) return `${diffSec} seconds ago`
  if (diffMin < 2) return '1 minute ago'
  if (diffMin < 60) return `${diffMin} minutes ago`
  if (diffHour < 2) return '1 hour ago'
  if (diffHour < 24) return `${diffHour} hours ago`
  if (diffDay < 2) return 'Yesterday'
  if (diffDay < 7) return `${diffDay} days ago`
  return date.toLocaleDateString()
}

