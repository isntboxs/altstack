import {
	SuggestionMenu,
	filterSuggestionItems,
} from '@blocknote/core/extensions'
import {
	SuggestionMenuController,
	getDefaultReactSlashMenuItems,
	useEditorDOMElement,
	useComponentsContext,
} from '@blocknote/react'
import type {
	DefaultReactSuggestionItem,
	SuggestionMenuProps,
} from '@blocknote/react'
import { IconAt, IconFolders } from '@tabler/icons-react'
import { useQueryClient } from '@tanstack/react-query'
import { createElement, useCallback, useEffect, useRef } from 'react'

import { toast } from '@altstack/ui/components/toast'

import type { ContentEditor } from '#/components/block-note/schema'
import { ProjectLogo } from '#/components/project-media'
import { orpc, projectORPC } from '#/utils/orpc'

function MentionSuggestions(
	props: SuggestionMenuProps<DefaultReactSuggestionItem>
) {
	const components = useComponentsContext()
	if (!components) return null
	const Menu = components.SuggestionMenu
	const loading = props.loadingState !== 'loaded'
	const items = loading
		? createElement(Menu.Loader, { className: 'bn-suggestion-menu-loader' })
		: props.items.length === 0
			? createElement(
					Menu.EmptyItem,
					{ className: 'bn-suggestion-menu-item' },
					'No projects or collections found'
				)
			: props.items.flatMap((item, index) => [
					...(item.group !== props.items[index - 1]?.group
						? [
								createElement(
									Menu.Label,
									{
										key: item.group,
										className: 'bn-suggestion-menu-label',
									},
									item.group
								),
							]
						: []),
					createElement(Menu.Item, {
						key: item.subtext ?? item.title,
						id: `bn-suggestion-menu-item-${index}`,
						className: 'bn-suggestion-menu-item',
						item,
						isSelected: index === props.selectedIndex,
						onClick: () => props.onItemClick?.(item),
					}),
				])
	// These vendor components reject extra props, including the source
	// attributes our devtools inject into JSX. Keep their props explicit.
	return createElement(
		Menu.Root,
		{ id: 'bn-suggestion-menu', className: 'bn-suggestion-menu' },
		items
	)
}

export function ProjectMentionMenus({ editor }: { editor: ContentEditor }) {
	const queryClient = useQueryClient()
	const request = useRef(0)
	const resolvedQuery = useRef<string | null>(null)
	const editorElement = useEditorDOMElement(editor)
	useEffect(() => {
		const root = editorElement?.parentElement
		const guardPendingSelection = (event: KeyboardEvent) => {
			const menu = editor.getExtension(SuggestionMenu)?.store.state
			if (
				event.key === 'Enter' &&
				!event.isComposing &&
				menu?.show &&
				menu.triggerCharacter === '@' &&
				menu.query !== resolvedQuery.current
			) {
				event.preventDefault()
				event.stopImmediatePropagation()
			}
		}
		// Capture before BlockNote's handler, which can select stale async items.
		root?.addEventListener('keydown', guardPendingSelection, true)
		return () =>
			root?.removeEventListener('keydown', guardPendingSelection, true)
	}, [editor, editorElement])
	useEffect(
		() => () => {
			request.current++
		},
		[]
	)
	const getMentions = useCallback(
		async (query: string): Promise<Array<DefaultReactSuggestionItem>> => {
			const current = ++request.current
			resolvedQuery.current = null
			await new Promise((resolve) => setTimeout(resolve, 200))
			if (current !== request.current) return []
			try {
				const input = { query: { q: query.trim().slice(0, 100) } }
				const [projectResult, collectionResult] = await Promise.allSettled([
					queryClient.query({
						...projectORPC.mentions.queryOptions({
							input,
						}),
						staleTime: 30_000,
						retry: false,
					}),
					queryClient.query({
						...orpc.collection.mentions.queryOptions({ input }),
						staleTime: 30_000,
						retry: false,
					}),
				])
				if (current !== request.current) return []
				resolvedQuery.current = query
				if (
					projectResult.status === 'rejected' ||
					collectionResult.status === 'rejected'
				) {
					toast.add({
						type: 'error',
						title: 'Some mentions could not be loaded',
						description: 'Try typing the project or collection name again.',
					})
				}
				const projects =
					projectResult.status === 'fulfilled'
						? projectResult.value.projects
						: []
				const collections =
					collectionResult.status === 'fulfilled'
						? collectionResult.value.collections
						: []
				return [
					...projects.map((project) => {
						return {
							title: project.name,
							subtext: project.tagline
								? `/${project.slug} · ${project.tagline}`
								: `/${project.slug}`,
							group: 'Projects',
							icon: (
								<ProjectLogo
									src={project.logo}
									name={project.name}
									className="size-6"
								/>
							),
							onItemClick: () => {
								editor.insertInlineContent([
									{
										type: 'projectMention',
										props: { slug: project.slug, name: project.name },
									},
									' ',
								])
							},
						}
					}),
					...collections.map((collection) => {
						return {
							title: collection.name,
							subtext: `/collections/${collection.slug} · ${collection.description}`,
							group: 'Collections',
							icon: <IconFolders aria-hidden="true" />,
							onItemClick: () => {
								editor.insertInlineContent([
									{
										type: 'collectionMention',
										props: { slug: collection.slug, name: collection.name },
									},
									' ',
								])
							},
						}
					}),
				]
			} catch {
				if (current === request.current) {
					resolvedQuery.current = query
					toast.add({
						type: 'error',
						title: 'Could not load mentions',
						description: 'Try typing the project or collection name again.',
					})
				}
				return []
			}
		},
		[editor, queryClient]
	)

	return (
		<>
			<SuggestionMenuController
				triggerCharacter="@"
				getItems={getMentions}
				suggestionMenuComponent={MentionSuggestions}
			/>
			<SuggestionMenuController
				triggerCharacter="/"
				getItems={(query) =>
					Promise.resolve(
						filterSuggestionItems(
							[
								...getDefaultReactSlashMenuItems(editor),
								{
									title: 'Project or collection mention',
									subtext: 'Find and mention a listed project or collection',
									aliases: ['mention', 'project', 'collection', 'reference'],
									group: 'References',
									icon: <IconAt />,
									onItemClick: () => {
										editor
											.getExtension(SuggestionMenu)
											?.openSuggestionMenu('@', {
												deleteTriggerCharacter: true,
											})
									},
								},
							],
							query
						)
					)
				}
			/>
		</>
	)
}
