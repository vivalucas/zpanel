import { useSessionRequest } from '@/lib/session'
import { useFeedback } from '@/lib/feedback'
import { useQuery } from '@tanstack/react-query'
import { Descriptions } from 'antd'
import MarkdownIt from 'markdown-it'
import { QueryError, SafeHtml, Section } from '@/components/shared'
const markdown = new MarkdownIt({ html: false, linkify: true })
export default function About() {
	const request = useSessionRequest()
	const { t } = useFeedback()
	const version = useQuery({
		queryKey: ['version'],
		queryFn: ({ signal }) => request<{ versionName: string }>('/about', {}, { signal }),
	})
	const description = useQuery({
		queryKey: ['about-description'],
		queryFn: ({ signal }) =>
			request<string>('/openness/getAboutDescription', undefined, { signal, method: 'GET' }),
	})
	return (
		<Section title="ZPanel" description={t('ui.aboutDescription')}>
			<Descriptions
				className="spaced"
				column={1}
				items={[
					{
						key: 'front',
						label: t('apps.about.frontVersionText'),
						children: import.meta.env.VITE_APP_VERSION,
					},
					{ key: 'backend', label: t('ui.backendVersion'), children: version.data?.versionName || '—' },
				]}
			/>
			{version.error && <QueryError error={version.error} retry={() => version.refetch()} />}
			<p>
				<a href="https://github.com/vivalucas/zpanel" target="_blank" rel="noopener noreferrer">
					GitHub ↗
				</a>
			</p>
			<p className="muted">{t('ui.attribution')}</p>
			{description.error ? (
				<QueryError error={description.error} retry={() => description.refetch()} />
			) : (
				<SafeHtml html={markdown.render(description.data || '')} />
			)}
		</Section>
	)
}
