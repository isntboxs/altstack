import { describe, expect, it } from 'vite-plus/test'

import {
	collectionBodySchema,
	sourceRepositorySchema,
} from '@altstack/shared/schemas/collection'
const id = '550e8400-e29b-41d4-a716-446655440000'
const valid = {
	name: 'Open Source Indonesia',
	slug: 'open-source-indonesia',
	description: 'Projects from a community-maintained repository.',
	content: '## Community',
	kind: 'repository',
	sourceRepositoryUrl:
		'https://github.com/opensourceindonesia/daftar-proyek-OSS',
	mainProjectId: null,
	status: 'published',
	projectIds: [id],
}
describe('collection editorial contract', () => {
	it('canonicalizes a repository without inventing a catalogue target', () => {
		const value = collectionBodySchema.parse(valid)
		expect(value.sourceRepositoryUrl).toBe(
			'https://github.com/opensourceindonesia/daftar-proyek-oss'
		)
		expect(value.mainProjectId).toBeNull()
		expect(
			sourceRepositorySchema.parse('https://github.com/Owner/Repo.git/')
		).toBe('https://github.com/owner/repo')
	})
	it.each([
		'http://github.com/a/b',
		'https://github.com/a/b/issues',
		'https://user:secret@github.com/a/b',
		'https://github.com/a/b?q=1',
		'https://github.com/a/b#readme',
		'https://example.com/a/b',
		'javascript:alert(1)',
		'https://github.com/a/.git',
	])('rejects unsafe or non-repository source %s', (source) => {
		expect(sourceRepositorySchema.safeParse(source).success).toBe(false)
	})
	it('enforces distinct bounded members, kind shape, publication, limits and server-owned authorship', () => {
		for (const patch of [
			{ projectIds: [id, id] },
			{ projectIds: Array(101).fill(id) },
			{ projectIds: [] },
			{ name: '' },
			{ description: 'x'.repeat(301) },
			{ content: 'x'.repeat(100001) },
			{ slug: 'Invalid Slug' },
			{ authorId: id },
			{ authorName: 'Another writer' },
			{ mainProjectId: id },
			{ kind: 'ecosystem' },
			{ kind: 'alternatives', mainProjectId: id, sourceRepositoryUrl: null },
		]) {
			expect(
				collectionBodySchema.safeParse({ ...valid, ...patch }).success
			).toBe(false)
		}
		expect(
			collectionBodySchema.safeParse({
				...valid,
				status: 'draft',
				projectIds: [],
			}).success
		).toBe(true)
		expect(
			collectionBodySchema.safeParse({
				...valid,
				kind: 'ecosystem',
				mainProjectId: '550e8400-e29b-41d4-a716-446655440001',
				sourceRepositoryUrl: null,
			}).success
		).toBe(true)
	})
})
