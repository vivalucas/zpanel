import type { CSSProperties, ReactNode } from 'react'
import { HomeClock } from './HomeClock'

// Public presentation only: never read account queries or the persisted home snapshot.
export function HomeStartupShell({ label, children }: { label?: string; children?: ReactNode }) {
	return (
		<main className="home-startup-shell" data-home-text-tone="dark">
			<div
				className="home-content"
				style={{ maxWidth: 1200, '--home-margin-top': 10, paddingInline: 15 } as CSSProperties}
			>
				<section className="home-hero">
					<div className="home-identity">
						<strong className="home-logo-text">ZPanel</strong>
						<span className="home-identity-divider" aria-hidden="true" />
						<HomeClock />
					</div>
					<div className="search-box home-startup-search" aria-hidden="true">
						<span className="home-startup-search-icon" />
						<span className="home-startup-line" />
					</div>
				</section>
				<div className="home-startup-status">{children || (label && <p role="status">{label}</p>)}</div>
				<div className="app-grid icon-grid home-startup-placeholders" aria-hidden="true">
					{Array.from({ length: 12 }, (_, index) => (
						<div className="home-startup-item" key={index}>
							<span className="home-startup-icon" />
							<span className="home-startup-line" />
						</div>
					))}
				</div>
			</div>
		</main>
	)
}
