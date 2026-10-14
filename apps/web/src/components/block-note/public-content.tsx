import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Readable initial HTML while the existing BlockNote viewer hydrates. React
// escapes text; raw HTML is skipped and react-markdown filters unsafe URLs.
export function PublicContent({ content }: { content: string }) {
	return (
		<article
			aria-label="Project documentation"
			className="prose prose-neutral dark:prose-invert max-w-none"
		>
			<Markdown
				remarkPlugins={[remarkGfm]}
				skipHtml
				components={{
					h1: ({ children }) => <h2>{children}</h2>,
					h2: ({ children }) => <h3>{children}</h3>,
					h3: ({ children }) => <h4>{children}</h4>,
					a: ({ children, href }) => (
						<a href={href} rel="noopener noreferrer">
							{children}
						</a>
					),
				}}
			>
				{content}
			</Markdown>
		</article>
	)
}
