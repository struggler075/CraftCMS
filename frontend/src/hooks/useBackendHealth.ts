import { useEffect, useRef, useState } from 'react'
import axios from 'axios'

const RETRY_INTERVAL = 15
const CHECK_URL = '/api/health'

export function useBackendHealth() {
  const [available, setAvailable] = useState<boolean | null>(null)
  const [countdown, setCountdown] = useState(RETRY_INTERVAL)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const check = async () => {
    try {
      await axios.get(CHECK_URL, { timeout: 5000 })
      setAvailable(true)
      stopCountdown()
    } catch {
      setAvailable(false)
      startCountdown()
    }
  }

  const startCountdown = () => {
    stopCountdown()
    setCountdown(RETRY_INTERVAL)
    countdownRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          stopCountdown()
          check()
          return RETRY_INTERVAL
        }
        return c - 1
      })
    }, 1000)
  }

  const stopCountdown = () => {
    if (countdownRef.current) clearInterval(countdownRef.current)
    if (retryRef.current) clearTimeout(retryRef.current)
  }

  const retry = () => {
    stopCountdown()
    setAvailable(null)
    check()
  }

  useEffect(() => {
    check()
    return stopCountdown
  }, [])

  return { available, countdown, retry }
}
