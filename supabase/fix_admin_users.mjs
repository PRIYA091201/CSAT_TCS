// One-time script to confirm emails and set roles for admin users
// Run: node supabase/fix_admin_users.mjs <SERVICE_ROLE_KEY>
//
// Get service role key from:
// https://supabase.com/dashboard/project/mxfuufwztkgirdjjxkci/settings/api
// It starts with: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

const SUPABASE_URL = 'https://mxfuufwztkgirdjjxkci.supabase.co'
const SERVICE_ROLE_KEY = process.argv[2]

if (!SERVICE_ROLE_KEY) {
  console.error('Usage: node fix_admin_users.mjs <SERVICE_ROLE_KEY>')
  console.error('Get key from: https://supabase.com/dashboard/project/mxfuufwztkgirdjjxkci/settings/api')
  process.exit(1)
}

const headers = {
  'apikey': SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
}

async function updateUser(email, role) {
  // First get the user ID
  const listRes = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
    { headers }
  )
  const listData = await listRes.json()
  const user = listData.users?.find(u => u.email === email)
  
  if (!user) {
    console.error(`User not found: ${email}`)
    return false
  }

  // Update role in app_metadata and confirm email
  const updateRes = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users/${user.id}`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        email_confirm: true,
        app_metadata: { provider: 'email', providers: ['email'], role },
      }),
    }
  )
  
  const updated = await updateRes.json()
  if (updateRes.ok) {
    console.log(`✅ ${email} → role: ${updated.app_metadata?.role}, confirmed: ${!!updated.email_confirmed_at}`)
    return true
  } else {
    console.error(`❌ Failed to update ${email}:`, updated)
    return false
  }
}

async function main() {
  console.log('Setting up admin users...\n')
  await updateUser('admin@chennaisilks.com', 'admin')
  await updateUser('md@chennaisilks.com', 'md')
  console.log('\nDone. Try logging in at http://localhost:3002/login')
  console.log('Admin: admin@chennaisilks.com / Admin@1234')
  console.log('MD:    md@chennaisilks.com / MD@1234')
}

main().catch(console.error)
