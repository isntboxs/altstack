import type { Dispatch, SetStateAction } from 'react'

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@altstack/ui/components/dialog'

import { SignInForm, signInDescription } from '#/components/sign-in-form'

interface AuthDialogProps {
	open: boolean
	onOpenChange: Dispatch<SetStateAction<boolean>>
	returnTo?: string
}

export const AuthDialog = ({
	open,
	onOpenChange,
	returnTo,
}: AuthDialogProps) => (
	<Dialog open={open} onOpenChange={onOpenChange}>
		<DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-sm">
			<DialogHeader className="text-left">
				<DialogTitle>Sign in</DialogTitle>
				<DialogDescription>{signInDescription}</DialogDescription>
			</DialogHeader>
			{open && <SignInForm returnTo={returnTo} />}
		</DialogContent>
	</Dialog>
)
