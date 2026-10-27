import type { ReactNode } from 'react'

import { Alert, AlertDescription } from '@altstack/ui/components/alert'
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@altstack/ui/components/alert-dialog'

export function ActionConfirmation({
	open,
	title,
	description,
	pending,
	error,
	onClose,
	onConfirm,
	children,
	disabled = false,
}: {
	open: boolean
	title: string
	description: string
	pending: boolean
	error?: string
	onClose: () => void
	onConfirm: () => void
	children?: ReactNode
	disabled?: boolean
}) {
	return (
		<AlertDialog
			open={open}
			onOpenChange={(value) => {
				if (!value && !pending) onClose()
			}}
		>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					<AlertDialogDescription>{description}</AlertDialogDescription>
				</AlertDialogHeader>
				{children}
				{error && (
					<Alert variant="destructive">
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}
				<AlertDialogFooter>
					<AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
					<AlertDialogAction disabled={pending || disabled} onClick={onConfirm}>
						{pending ? 'Saving…' : 'Confirm'}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}
