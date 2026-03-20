import 'dotenv/config'

import { createPostgresDataSource } from './create-data-source'

export const SeedDataSource = createPostgresDataSource({
  migrations: ['src/database/seeds/*{.js,.ts}'],
})
