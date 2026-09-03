import dotenv from 'dotenv'
import { defineConfig } from 'drizzle-kit'

dotenv.config({
	path: '../../.env',
})

const dbUrl = process.env.DATABASE_URL

if (!dbUrl) {
	throw new Error('DATABASE_URL is not defined')
}

export default defineConfig({
	schema: './src/schemas.ts',
	out: './src/migrations',
	dialect: 'postgresql',
	dbCredentials: {
		url: dbUrl,
	},
})
