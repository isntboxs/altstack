import { env } from '@altstack/env/web'

import { Badge } from '@altstack/ui/components/badge'
import { Button } from '@altstack/ui/components/button'
import {
	DotPattern,
	GridPattern,
} from '@altstack/ui/components/customs/grid-dot-pattern'
import { cn } from '@altstack/ui/lib/utils'

export const HeroSection = () => (
	<section className="relative mx-auto w-full overflow-hidden border-b border-border">
		<GridPattern
			className={cn(
				'opacity-10',
				'bg-size-[20px_20px]',
				'mask-radial-to-90% mask-radial-at-center'
			)}
		/>
		<DotPattern
			className={cn(
				'opacity-30',
				'bg-size-[20px_20px]',
				'mask-radial-to-90% mask-radial-at-center'
			)}
		/>

		<div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center justify-center space-y-2 px-4 pt-22 pb-16 lg:px-16">
			<Button
				size="sm"
				className={cn('bg-card hover:bg-card hover:text-primary')}
			>
				<Badge variant="outline">
					<span className="text-xs text-primary">NEW</span>
				</Badge>

				<span className="text-primary">Introducing {env.VITE_APP_NAME}</span>
			</Button>

			<div className="flex w-full flex-col items-center justify-center gap-y-4 text-center">
				<h1 className="max-w-[14em] text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl md:text-5xl">
					Discover open-source software you'll actually use.
				</h1>

				<p className="max-w-[35em] text-pretty text-muted-foreground md:text-lg lg:mt-2">
					Find quality projects, compare alternatives, and follow trending
					developer tools all in one place.
				</p>

				<div className="mt-2 flex items-center justify-center gap-2 lg:mt-4">
					<Button>
						<span>Explore Projects</span>
					</Button>

					<Button variant="secondary">
						<span>Submit Project</span>
					</Button>
				</div>
			</div>
		</div>
	</section>
)
