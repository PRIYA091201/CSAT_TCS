import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

type FormScreen = 'loading' | 'no-token' | 'demographics' | 'ratings' | 'thankyou' | 'error' | 'timeout' | 'already-used'

interface TokenInfo {
  token_id: string
  zone_id: string
  zone_type: string
  product_section: string
}

interface FormData {
  gender?: string
  age_group?: string
  rating_price?: string
  rating_design?: string
  rating_handling?: string
  rating_overall?: string
}

export function CustomerForm() {
  const [screen, setScreen] = useState<FormScreen>('loading')
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null)
  const [formData, setFormData] = useState<FormData>({})
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  // Parse token from URL: /f/{zone_id}/{token_id}
  useEffect(() => {
    async function validateToken() {
      const path = window.location.pathname
      const match = path.match(/^\/f\/([^/]+)\/([^/]+)$/)
      if (!match) {
        // No token in URL — show a friendly landing page instead of error
        setScreen('no-token')
        return
      }

      const [, zone_id, token_id] = match

      // Call validate-token edge function
      try {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validate-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ token_id })
        })
        const data = await res.json()

        if (!data?.valid) {
          if (data?.error_code === 'used') {
            setScreen('already-used')
          } else if (data?.error_code === 'expired') {
            setScreen('timeout')
          } else {
            setErrorMsg(data?.message || 'Link expired')
            setScreen('error')
          }
          return
        }

        setTokenInfo({
          token_id,
          zone_id: data.zone_id,
          zone_type: data.zone_type,
          product_section: data.product_section
        })
        setScreen('demographics')
      } catch (err) {
        console.error('validate-token error', err)
        setErrorMsg('Something went wrong')
        setScreen('error')
      }
    }

    validateToken()
  }, [])

  async function handleSubmit() {
    if (!tokenInfo) return
    setSubmitting(true)

    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          token_id: tokenInfo.token_id,
          gender: formData.gender || null,
          age_group: formData.age_group || null,
          rating_price: formData.rating_price,
          rating_design: formData.rating_design,
          rating_handling: formData.rating_handling,
          rating_overall: formData.rating_overall
        })
      })
      const data = await res.json()

      if (data?.success) {
        setScreen('thankyou')
      } else {
        setErrorMsg(data?.message || 'Failed to submit')
        if (data?.error_code === 'used') setScreen('already-used')
        else setScreen('error')
      }
    } catch (err) {
      console.error('submit-feedback error', err)
      setErrorMsg('Network error')
      setScreen('error')
    } finally {
      setSubmitting(false)
    }
  }

  // ============ SCREENS ============

  if (screen === 'loading') {
    return (
      <div className="min-h-screen bg-[#1a1a1a] text-white flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    )
  }

  if (screen === 'no-token') {
    return (
      <div className="min-h-screen bg-[#1a1a1a] text-white flex flex-col items-center justify-center p-6 text-center">
        <img
          src="/logo.png"
          alt="The Chennai Silks"
          className="h-12 w-auto object-contain mb-6"
          onError={(e) => {
            const target = e.currentTarget as HTMLImageElement
            target.style.display = 'none'
            const fallback = target.nextElementSibling as HTMLElement
            if (fallback) fallback.style.display = 'block'
          }}
        />
        <p className="text-sm font-semibold text-white hidden">The Chennai Silks</p>
        <div className="text-6xl mb-4">😊</div>
        <h1 className="text-2xl font-bold mb-2">The Chennai Silks</h1>
        <p className="text-gray-400 mb-2">We'd love your feedback!</p>
        <p className="text-gray-500 text-sm">Please scan the QR code at the kiosk or on your invoice to share your experience.</p>
      </div>
    )
  }

  if (screen === 'error' || screen === 'timeout' || screen === 'already-used') {
    return (
      <div className="min-h-screen bg-[#1a1a1a] text-white flex flex-col items-center justify-center p-6 text-center">
        <img
          src="/logo.png"
          alt="The Chennai Silks"
          className="h-12 w-auto object-contain mb-6"
          onError={(e) => {
            const target = e.currentTarget as HTMLImageElement
            target.style.display = 'none'
            const fallback = target.nextElementSibling as HTMLElement
            if (fallback) fallback.style.display = 'block'
          }}
        />
        <p className="text-sm font-semibold text-white hidden">The Chennai Silks</p>
        <div className="text-6xl mb-4">{screen === 'already-used' ? '✅' : '⏰'}</div>
        <h1 className="text-xl font-bold mb-2">
          {screen === 'already-used' && 'Thanks! We have already received your feedback.'}
          {screen === 'timeout' && 'Your feedback window has closed.'}
          {screen === 'error' && (errorMsg || 'Something went wrong')}
        </h1>
        <p className="text-gray-400 text-sm mt-2">
          {tokenInfo?.zone_type === 'billing' && 'Purchased customers have 30 minutes from billing.'}
          {tokenInfo?.zone_type === 'browse' && 'Please request a new QR at the kiosk.'}
        </p>
      </div>
    )
  }

  if (screen === 'thankyou') {
    return (
      <div className="min-h-screen bg-[#1a1a1a] text-white flex flex-col items-center justify-center p-6 text-center">
        <img
          src="/logo.png"
          alt="The Chennai Silks"
          className="h-10 w-auto object-contain mb-4"
          onError={(e) => {
            const target = e.currentTarget as HTMLImageElement
            target.style.display = 'none'
            const fallback = target.nextElementSibling as HTMLElement
            if (fallback) fallback.style.display = 'block'
          }}
        />
        <p className="text-sm font-semibold text-white hidden">The Chennai Silks</p>
        <div className="text-6xl mb-4">🙏</div>
        <h1 className="text-2xl font-bold mb-2">Thank you for your feedback!</h1>
      </div>
    )
  }

  // Demo graphics screen
  if (screen === 'demographics') {
    return (
      <div className="min-h-screen bg-[#1a1a1a] text-white flex flex-col p-6">
        <div className="mb-6">
          <img
            src="/logo.png"
            alt="The Chennai Silks"
            className="h-8 w-auto object-contain mb-2"
            onError={(e) => {
              const target = e.currentTarget as HTMLImageElement
              target.style.display = 'none'
              const fallback = target.nextElementSibling as HTMLElement
              if (fallback) fallback.style.display = 'block'
            }}
          />
          <p className="text-sm font-semibold text-white hidden">The Chennai Silks</p>
          <h1 className="text-xl font-bold">How was your experience?</h1>
        </div>

        {/* Gender */}
        <div className="mb-6">
          <p className="text-sm text-gray-400 mb-3">Gender (optional)</p>
          <div className="flex gap-2">
            {['male', 'female', 'other', 'prefer_not_to_say'].map(g => (
              <button
                key={g}
                onClick={() => setFormData(f => ({ ...f, gender: g }))}
                className={cn(
                  'flex-1 py-3 rounded-lg border text-sm',
                  formData.gender === g ? 'border-green-500 bg-green-500/20' : 'border-gray-600'
                )}
              >
                {g === 'male' && '👨 Male'}
                {g === 'female' && '👩 Female'}
                {g === 'other' && '🧑 Other'}
                {g === 'prefer_not_to_say' && 'prefer not to say'}
              </button>
            ))}
          </div>
        </div>

        {/* Age */}
        <div className="mb-8">
          <p className="text-sm text-gray-400 mb-3">Age (optional)</p>
          <div className="grid grid-cols-4 gap-2">
            {['18-25', '26-35', '36-45', '46+'].map(a => (
              <button
                key={a}
                onClick={() => setFormData(f => ({ ...f, age_group: a }))}
                className={cn(
                  'py-3 rounded-lg border text-sm',
                  formData.age_group === a ? 'border-green-500 bg-green-500/20' : 'border-gray-600'
                )}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => setScreen('ratings')}
          className="w-full py-4 bg-green-600 rounded-lg font-medium"
        >
          Continue
        </button>
      </div>
    )
  }

  // Ratings screen
  if (screen === 'ratings') {
    const dims = [
      { key: 'rating_price', label: 'Pricing' },
      { key: 'rating_design', label: 'Design' },
      { key: 'rating_handling', label: 'Handling' },
      { key: 'rating_overall', label: 'Overall experience' }
    ]

    const canSubmit = formData.rating_price && formData.rating_design && formData.rating_handling && formData.rating_overall

    return (
      <div className="min-h-screen bg-[#1a1a1a] text-white flex flex-col p-6">
        <div className="mb-4">
          <img
            src="/logo.png"
            alt="The Chennai Silks"
            className="h-8 w-auto object-contain mb-2"
            onError={(e) => {
              const target = e.currentTarget as HTMLImageElement
              target.style.display = 'none'
              const fallback = target.nextElementSibling as HTMLElement
              if (fallback) fallback.style.display = 'block'
            }}
          />
          <p className="text-sm font-semibold text-white hidden">The Chennai Silks</p>
          <h1 className="text-xl font-bold">How was your experience?</h1>
          <p className="text-sm text-gray-500">Tap one per row</p>
        </div>

        {dims.map(dim => (
          <div key={dim.key} className="mb-4">
            <p className="text-sm font-medium mb-2">{dim.label}</p>
            <div className="flex gap-2">
              {[
                { v: 'happy', e: '😊' },
                { v: 'neutral', e: '😐' },
                { v: 'sad', e: '😞' }
              ].map(opt => (
                <button
                  key={opt.v}
                  onClick={() => setFormData(f => ({ ...f, [dim.key]: opt.v }))}
                  className={cn(
                    'flex-1 py-4 rounded-lg border flex flex-col items-center',
                    formData[dim.key as keyof FormData] === opt.v
                      ? opt.v === 'happy' ? 'border-green-500 bg-green-500/20'
                        : opt.v === 'neutral' ? 'border-amber-500 bg-amber-500/20'
                        : 'border-red-500 bg-red-500/20'
                      : 'border-gray-600'
                  )}
                >
                  <span className="text-2xl">{opt.e}</span>
                  <span className="text-xs mt-1">{opt.v}</span>
                </button>
              ))}
            </div>
          </div>
        ))}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className={cn(
            'w-full py-4 rounded-lg font-medium mt-4',
            canSubmit ? 'bg-green-600' : 'bg-gray-600 opacity-50'
          )}
        >
          {submitting ? 'Submitting...' : canSubmit ? 'Submit feedback' : 'Select all ratings to submit'}
        </button>
      </div>
    )
  }

  return null
}