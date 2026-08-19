'use client'

import { useEffect } from 'react'
import { useSession } from '../session'
import { useLiveStream } from './LiveStreamProvider'

export function useOperationalStateSync() {
  const { user, refreshUser } = useSession()
  const { subscribe } = useLiveStream()

  useEffect(() => {
    if (!user) return

    return subscribe((event) => {
      if (event.entity !== 'user' || event.action !== 'updated' || event.id !== user.id) return
      void refreshUser()
    })
  }, [refreshUser, subscribe, user])
}
