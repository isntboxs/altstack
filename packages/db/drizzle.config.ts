import dotenv from 'dotenv'
import { defineConfig } from 'drizzle-kit'

dotenv.config({
	path: '../../apps/web/.env',
})

const dbUrl = process.env.DATABASE_URL

if (!dbUrl) {
	throw new Error('DATABASE_URL is not defined')
}

export default defineConfig({
	schema: './src/schema',
	out: './src/migrations',
	dialect: 'postgresql',
	dbCredentials: {
		url: dbUrl,
	},
})
