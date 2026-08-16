import { IconBrandGithub } from '@tabler/icons-react'
import { log } from 'evlog/client'
import type { Dispatch, SetStateAction } from 'react'

import { authClient } from '@altstack/auth/client'

import { env } from '@altstack/env/web'

import { Button } from '@altstack/ui/components/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@altstack/ui/components/dialog'

interface AuthDialogpros {
	open: boolean
	onOpenChange: Dispatch<SetStateAction<boolean>>
}

export const AuthDialog = ({ open, onOpenChange }: AuthDialogpros) => {
	const signIn = async () =>
		await authClient.signIn.social({
			provider: 'github',
			callbackURL: env.VITE_APP_URL,
			fetchOptions: {
				onSuccess: () => onOpenChange(false),
				onError: (ctx) => {
					onOpenChange(false)
					log.error({ error: ctx.error })
				},
			},
		})

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-sm">
				<DialogHeader>
					<DialogTitle className="text-lg font-medium">
						Welcome back!
					</DialogTitle>
					<DialogDescription>
						Sign in to discover curated developer tools and manage your saved
						open-source projects.
					</DialogDescription>
				</DialogHeader>

				<div className="flex items-center justify-center">
					<Button variant="outline" className="w-full" onClick={signIn}>
						<span>Continue with Github</span>
						<IconBrandGithub />
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	)
}
