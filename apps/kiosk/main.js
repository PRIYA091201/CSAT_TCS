// Kiosk MVP frontend (vanilla JS, MVP-first)
// - Logs in as per-device kiosk using Supabase Auth
// - Mint token via mint-token edge function
// - Renders a QR for /f/{zone_id}/{token_id}
// - 30s countdown and auto-reset, offline handling

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

let config = null
let supabase = null
let currentSession = null
let countdownTimer = null
let countdownUntil = 0
let currentTokenId = null
let currentTokenExpiresAt = null
let statusPollTimer = null

function $(sel) { return document.querySelector(sel) }

async function loadConfig() {
  const resp = await fetch('./config.json', { cache: 'no-store' })
  if (!resp.ok) throw new Error('Failed to load config')
  config = await resp.json()
}

function showLogin() {
  $('#login').style.display = 'block'
  $('#idle').style.display = 'none'
}

function showIdle() {
  $('#login').style.display = 'none'
  $('#idle').style.display = 'block'
  $('#storeName').textContent = config.store_name
  $('#zoneLabel').textContent = config.zone_label
  $('#qrImg').src = ''
  $('#countdown').textContent = ''
  currentTokenId = null
  currentTokenExpiresAt = null
}

async function signIn(email, password) {
  if (!supabase) {
    // initialize using config keys (anon key is safe for auth in frontend)
    supabase = createClient(config.supabaseUrl, config.supabaseAnonKey)
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  currentSession = data?.session || null
  localStorage.setItem('kiosk_session', JSON.stringify(currentSession))
  return currentSession
}

function ensureOnline() {
  return navigator.onLine
}

function setOfflineBanner(show) {
  const el = $('#offlineBanner')
  if (show) {
    el.style.display = 'inline-block'
  } else {
    el.style.display = 'none'
  }
}

async function mintToken() {
  if (!config || !config.zone_id) {
    alert('Kiosk not configured. Please contact admin.')
    return
  }
  if (!currentSession) {
    alert('Please sign in as kiosk to mint tokens.')
    return
  }
  if (!ensureOnline()) {
    setOfflineBanner(true)
    return
  }

  const url = config.mintTokenUrl
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentSession.access_token}`
      },
      body: JSON.stringify({ zone_id: config.zone_id })
    })
    const data = await res.json()
    if (!res.ok || !data?.token_id) {
      console.error('mint-token error', data)
      alert('Failed to mint token')
      return
    }
    currentTokenId = data.token_id
    currentTokenExpiresAt = new Date(data.expires_at).getTime()
    const tokenUrl = `${config.baseUrl}/f/${config.zone_id}/${currentTokenId}`
    // Render QR via external service
    $('#qrImg').src = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(tokenUrl)}`
    // Start countdown
    startCountdown(currentTokenExpiresAt)
    // Start polling status
    statusPollTimer = setInterval(() => checkTokenStatus(currentTokenId), 2000)
  } catch (err) {
    console.error('[kiosk] mint-token error', err)
    alert('Network error minting token')
  }
}

function startCountdown(expiresAtMs) {
  if (countdownTimer) clearInterval(countdownTimer)
  function tick() {
    const now = Date.now()
    const diff = Math.max(0, Math.floor((expiresAtMs - now) / 1000))
    countdownUntil = diff
    $('#countdown').textContent = diff > 0 ? `Expires in ${diff}s` : 'Expired'
    if (diff <= 0) {
      clearInterval(countdownTimer)
      resetToIdleSoon()
    }
  }
  tick()
  countdownTimer = setInterval(tick, 1000)
}

function resetToIdleSoon() {
  // small delay before returning to idle to allow user to see expiry
  setTimeout(() => showIdle(), 1500)
  if (statusPollTimer) clearInterval(statusPollTimer)
}

async function checkTokenStatus(tokenId) {
  // Re-use validate-token (public) to check if token remains valid
  try {
    const res = await fetch(config.validateTokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token_id: tokenId })
    })
    const data = await res.json()
    if (data?.valid === false) {
      // token consumed/expired
      resetToIdleSoon()
    }
  } catch (e) {
    // ignore poll errors in offline/unstable conditions
  }
}

function bindUI() {
  $('#loginBtn').addEventListener('click', async () => {
    const email = $('#email').value
    const password = $('#password').value
    try {
      await signIn(email, password)
      showIdle()
    } catch (err) {
      $('#loginError').textContent = 'Invalid credentials'
    }
  })

  $('#mintBtn').addEventListener('click', async () => {
    await mintToken()
  })
}

async function init() {
  await loadConfig()
  // Initialize UI visibility
  const stored = localStorage.getItem('kiosk_session')
  if (stored) {
    try {
      currentSession = JSON.parse(stored)
    } catch {}
  }
  if (currentSession) {
    // assume authenticated; show idle
    showIdle()
  } else {
    showLogin()
  }
  bindUI()
  // Online/offline handling
  window.addEventListener('online', () => { $('#offlineBanner').style.display = 'none' })
  window.addEventListener('offline', () => { $('#offlineBanner').style.display = 'inline-block' })
}

init()
