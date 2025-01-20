import { beforeAll, afterEach, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client with test environment credentials
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

beforeAll(async () => {
  // Setup: Any global test setup like auth or database seeding
})

afterEach(async () => {
  // Cleanup: Reset database state after each test
})

afterAll(async () => {
  // Cleanup: Any final cleanup after all tests complete
})

export { supabase } 