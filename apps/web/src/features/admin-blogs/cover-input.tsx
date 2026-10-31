import { useCallback, useState } from 'react'

import {
	blogCoverKeySchema,
	externalBlogCoverSchema,
} from '@altstack/shared/schemas'
import { screenshotKeySchema } from '@altstack/shared/schemas/upload'

import {
	Field,
	FieldDescription,
	FieldLabel,
} from '@altstack/ui/components/field'
import { Input } from '@altstack/ui/components/input'
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from '@altstack/ui/components/tabs'

import { CoverUploader } from '#/components/image-uploader'
import { resolveFileUrl } from '#/utils/storage'

export function BlogCoverInput({
	value,
	onChange,
	onBusyChange,
	disabled,
	invalid,
	errorId,
}: {
	value: string
	onChange: (value: string) => void
	onBusyChange: (busy: boolean) => void
	disabled: boolean
	invalid: boolean
	errorId?: string
}) {
	const [uploadBusy, setUploadBusy] = useState(false)
	const reportBusy = useCallback(
		(busy: boolean) => {
			setUploadBusy(busy)
			onBusyChange(busy)
		},
		[onBusyChange]
	)
	const external = externalBlogCoverSchema.safeParse(value).success
	const temporary = screenshotKeySchema.safeParse(value).success
	const existing = external || blogCoverKeySchema.safeParse(value).success
	const [source, setSource] = useState(external ? 'url' : 'upload')
	return (
		<Tabs
			value={source}
			onValueChange={(next) => {
				if (!disabled && !uploadBusy && (next === 'url' || next === 'upload')) {
					setSource(next === 'url' ? 'url' : 'upload')
				}
			}}
		>
			<TabsList aria-label="Cover image source">
				<TabsTrigger value="upload" disabled={disabled || uploadBusy}>
					Upload image
				</TabsTrigger>
				<TabsTrigger value="url" disabled={disabled || uploadBusy}>
					Image URL
				</TabsTrigger>
			</TabsList>
			<TabsContent value="upload" keepMounted>
				<div
					inert={disabled}
					aria-disabled={disabled}
					className="flex flex-col gap-3"
				>
					<CoverUploader
						value={temporary ? value : undefined}
						existingUrl={existing ? resolveFileUrl(value) : null}
						onRemoveExisting={() => onChange('')}
						onChange={onChange}
						onBusyChange={reportBusy}
						aria-label="Blog cover upload"
						aria-invalid={invalid}
						aria-describedby={errorId}
					/>
					<FieldDescription>
						Upload PNG, JPG, GIF, or WEBP up to 5 MB. Images are cropped to
						16:9.
					</FieldDescription>
				</div>
			</TabsContent>
			<TabsContent value="url">
				<Field>
					<FieldLabel htmlFor="blog-coverUrl">Cover image URL</FieldLabel>
					<Input
						id="blog-coverUrl"
						type="url"
						value={
							temporary || blogCoverKeySchema.safeParse(value).success
								? ''
								: value
						}
						maxLength={2000}
						disabled={disabled}
						aria-invalid={invalid}
						aria-describedby={errorId}
						onChange={(event) => onChange(event.target.value)}
					/>
					<FieldDescription>
						Use an HTTPS image URL. Pasting a URL replaces the current cover.
					</FieldDescription>
					{existing && (
						<img
							src={resolveFileUrl(value)}
							alt="Blog cover preview"
							width={960}
							height={540}
							className="aspect-video w-full rounded-lg object-cover"
						/>
					)}
				</Field>
			</TabsContent>
		</Tabs>
	)
}
