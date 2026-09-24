import limax from 'limax'

export function slugify(value: string): string {
	return limax(value)
}
