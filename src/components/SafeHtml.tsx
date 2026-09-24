import DOMPurify from 'dompurify'

/* eslint-disable react/dom-no-dangerously-set-innerhtml -- This component sanitizes all HTML with DOMPurify. */
export function SafeHtml({ html, className }: { html?: string; className?: string }) {
	// Only sanitized HTML is injected; arbitrary scripts are handled by the explicit site setting.
	return (
		<div
			className={className}
			dangerouslySetInnerHTML={{
				__html: DOMPurify.sanitize(html || '', { ADD_ATTR: ['target'], FORBID_TAGS: ['style'] }),
			}}
		/>
	)
}
/* eslint-enable react/dom-no-dangerously-set-innerhtml */
