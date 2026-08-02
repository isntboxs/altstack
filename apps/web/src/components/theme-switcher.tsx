import { IconMoon, IconSun } from '@tabler/icons-react'

import { Button } from '@altstack/ui/components/button'
import { useTheme } from '@altstack/ui/components/customs/theme-provider'

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
