import { useEffect, useState, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type KioskState = 'idle' | 'qr-display' | 'offline'

interface ZoneConfig {
  zone_id: string
  product_section: string | null
}

export function KioskApp() {
  const [state, setState] = useState<KioskState>('idle')
  // Hardcode zone for now - will fetch from DB after SQL works
  const [zoneConfig, setZoneConfig] = useState<ZoneConfig>({ zone_id: '00000000-0000-0000-0000-000000000002', product_section: 'sarees' })
  const [session, setSession] = useState<any>(null)
  const [mintedToken, setMintedToken] = useState<{ token_id: string; expires_at: string } | null>(null)
  const [countdown, setCountdown] = useState(30)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const storeName = 'The Chennai Silks'
  const sectionName = zoneConfig?.product_section ?? ''

  const checkNetwork = useCallback(() => {
    return navigator.onLine
  }, [])

  useEffect(() => {
    async function init() {
      try {
        // Use direct REST call to bypass Supabase client JWT verification
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/token?grant_type=password`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({
              email: import.meta.env.VITE_KIOSK_EMAIL,
              password: import.meta.env.VITE_KIOSK_PASSWORD,
            }),
          }
        )
        const data = await res.json()
        if (!res.ok || !data.access_token) {
          setError(`Login failed: ${data.error_description || data.msg || 'Unknown error'}`)
          return
        }
        // Use the access token directly without client-side JWT verification
        setSession({ access_token: data.access_token, user: data.user })
      } catch (err: any) {
        setError(`Login error: ${err.message}`)
      }
    }
    init()
  }, [])

  useEffect(() => {
    // Zone config is now hardcoded, skip fetch
  }, [])

  useEffect(() => {
    function handleOnline() {
      if (state === 'offline') setState('idle')
    }
    function handleOffline() {
      if (state !== 'offline') setState('offline')
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [state])

  useEffect(() => {
    let interval: number | undefined
    if (state === 'qr-display' && countdown > 0) {
      interval = window.setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [state, countdown])

  useEffect(() => {
    if (countdown === 0 && state === 'qr-display') {
      setTimeout(() => {
        setState('idle')
        setMintedToken(null)
      }, 2000)
    }
  }, [countdown, state])

  async function handleMint() {
    if (!checkNetwork()) return
    if (!session) {
      setError('Kiosk not signed in. Reload the page.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mint-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ zone_id: zoneConfig.zone_id }),
      })
      const data = await res.json()
      if (!res.ok || !data?.token_id) {
        setError(data?.message || 'Failed to mint token')
        return
      }
      setMintedToken({ token_id: data.token_id, expires_at: data.expires_at })
      setCountdown(30)
      setState('qr-display')
    } catch (err) {
      console.error('mint-token error', err)
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white flex flex-col">
      {/* Offline Banner */}
      {(!checkNetwork() || state === 'offline') && (
        <div className="bg-amber-500 text-black px-4 py-2 text-center text-sm font-medium">
          Connection lost. Please try again in a moment.
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {/* Header: Store Logo */}
        <div className="absolute top-6 left-6">
          <img
            src="/logo.jpg"
            alt={storeName}
            className="h-10 w-auto object-contain rounded"
          />
        </div>

        {state === 'idle' && (
          <>
            {/* Big Green Smiley */}
            <div className="text-8xl mb-6">😊</div>
            {error && <div className="text-red-400 text-sm mb-4 px-4 py-2 bg-red-900/30 rounded">{error}</div>}
            <h2 className="text-2xl font-bold text-center mb-2">{storeName === 'The Chennai Silks' ? "We'd love your feedback!" : ""}</h2>
            <p className="text-gray-400 text-center mb-8">Help us serve you better. It takes less than a minute.</p>
            <Button
              onClick={handleMint}
              disabled={!checkNetwork() || loading}
              className="w-full max-w-sm h-14 text-lg bg-green-600 hover:bg-green-700 text-white"
            >
              {loading ? 'Minting...' : 'Tap to share feedback'}
            </Button>
            <p className="text-gray-500 text-xs mt-6">Your response is anonymous</p>
          </>
        )}

        {state === 'qr-display' && mintedToken && (
          <>
            <div className="bg-white p-4 rounded-xl mb-6">
              <QRCodeSVG
                value={`${import.meta.env.VITE_CUSTOMER_FORM_URL}/f/${zoneConfig?.zone_id}/${mintedToken.token_id}`}
                size={240}
              />
            </div>
            <p className="text-lg font-bold mb-1">Scan with your phone camera</p>
            <p className="text-gray-400 mb-6">This QR is just for you</p>
            {countdown > 0 ? (
              <p className="text-2xl font-bold text-green-400">Expires in {countdown}s</p>
            ) : (
              <p className="text-xl font-bold text-red-500">● Expired — returning to welcome</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}