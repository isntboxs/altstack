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
import { IconAt } from '@tabler/icons-react'
import { useQueryClient } from '@tanstack/react-query'
import { createElement, useCallback, useEffect, useRef } from 'react'

import { toast } from '@altstack/ui/components/toast'

import type { ContentEditor } from '#/components/block-note/schema'
import { ProjectLogo } from '#/components/project-media'
import { projectORPC } from '#/utils/orpc'

function ProjectSuggestions(
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
					'No projects found'
				)
			: props.items.map((item, index) =>
					createElement(Menu.Item, {
						key: item.subtext ?? item.title,
						id: `bn-suggestion-menu-item-${index}`,
						className: 'bn-suggestion-menu-item',
						item,
						isSelected: index === props.selectedIndex,
						onClick: () => props.onItemClick?.(item),
					})
				)
	// These vendor components reject extra props, including the source
	// attributes our devtools inject into JSX. Keep their props explicit.
	return createElement(
		Menu.Root,
		{ id: 'bn-suggestion-menu', className: 'bn-suggestion-menu' },
		createElement(
			Menu.Label,
			{ className: 'bn-suggestion-menu-label' },
			'Projects'
		),
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
	const getProjects = useCallback(
		async (query: string): Promise<Array<DefaultReactSuggestionItem>> => {
			const current = ++request.current
			resolvedQuery.current = null
			await new Promise((resolve) => setTimeout(resolve, 200))
			if (current !== request.current) return []
			try {
				const { projects } = await queryClient.query({
					...projectORPC.mentions.queryOptions({
						input: { query: { q: query.trim().slice(0, 100) } },
					}),
					staleTime: 30_000,
					retry: false,
				})
				if (current === request.current) resolvedQuery.current = query
				return projects.map((project) => {
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
				})
			} catch {
				if (current === request.current) {
					resolvedQuery.current = query
					toast.add({
						type: 'error',
						title: 'Could not load projects',
						description: 'Try typing the project name again.',
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
				getItems={getProjects}
				suggestionMenuComponent={ProjectSuggestions}
			/>
			<SuggestionMenuController
				triggerCharacter="/"
				getItems={(query) =>
					Promise.resolve(
						filterSuggestionItems(
							[
								...getDefaultReactSlashMenuItems(editor),
								{
									title: 'Project mention',
									subtext: 'Find and mention a listed project',
									aliases: ['mention', 'project', 'reference'],
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
