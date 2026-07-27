import { config } from 'dotenv'
import { resolve } from 'node:path'

/** Load dashboard .env.local then .env so the worker shares Next secrets. */
export function loadWorkerEnv(): void {
  const root = resolve(__dirname, '../..')
  config({ path: resolve(root, '.env.local') })
  config({ path: resolve(root, '.env') })
}
