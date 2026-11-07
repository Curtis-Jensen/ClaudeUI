import { useState } from 'react'
import { useSessionStore } from '../../stores/session-store'
import { takeUpcomingChatId } from '../../lib/thread-look'
import { WelcomeScreenView } from './View'

export function WelcomeScreen(): React.JSX.Element {
  const createNewSession = useSessionStore((s) => s.createNewSession)
  const [loading, setLoading] = useState(false)

  const handleOpen = async (): Promise<void> => {
    setLoading(true)
    try {
      const folder = await window.api.pickFolder()
      if (folder) {
        const routingId = takeUpcomingChatId()
        createNewSession(routingId, folder)
      }
    } finally {
      setLoading(false)
    }
  }

  return <WelcomeScreenView loading={loading} onOpen={handleOpen} />
}
