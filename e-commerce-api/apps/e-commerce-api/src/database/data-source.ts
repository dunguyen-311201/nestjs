import 'dotenv/config'

import { createPostgresDataSource } from '#database/create-data-source'

export const AppDataSource = createPostgresDataSource()
