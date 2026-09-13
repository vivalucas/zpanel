import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary, Providers } from './app/Providers'
import Application from './app/App'
import './locales'
import 'antd/dist/reset.css'
import './app/styles.css'
createRoot(document.getElementById('app')!).render(
	<StrictMode>
		<ErrorBoundary>
			<Providers>
				<Application />
			</Providers>
		</ErrorBoundary>
	</StrictMode>,
)
