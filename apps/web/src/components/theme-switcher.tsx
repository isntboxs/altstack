import { IconMoon, IconSun } from '@tabler/icons-react'
import { useTheme } from 'next-themes'

import { Button } from '@altstack/ui/components/button'

export const ThemeSwitcher = () => {
	const { resolvedTheme, setTheme } = useTheme()

	const switchTheme = () => {
		setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
	}

	return (
		<Button
			variant="ghost"
			size="icon-sm"
			aria-label="Theme Toggle"
			onClick={switchTheme}
		>
			<IconMoon className="hidden [html.dark_&]:block" />
			<IconSun className="hidden [html.light_&]:block" />
		</Button>
	)
}
