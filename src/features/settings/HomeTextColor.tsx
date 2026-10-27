import { Input, Select } from 'antd'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { homeTextPreset } from '@/lib/homeText'

export default function HomeTextColor({
	id,
	value,
	onChange,
}: {
	id?: string
	value?: string
	onChange?: (value: string) => void
}) {
	const { t } = useTranslation()
	const preset = homeTextPreset(value)
	const detailsRef = useRef<HTMLDetailsElement>(null)
	useEffect(() => {
		// Reveal a stored custom color without closing the editor as its value is typed or cleared.
		if (preset === 'custom' && detailsRef.current) detailsRef.current.open = true
	}, [preset])
	return (
		<div>
			<Select
				id={id}
				aria-label={t('ui.textColor')}
				style={{ width: '100%' }}
				value={preset}
				options={[
					{ value: 'white', label: t('ui.whiteText') },
					{ value: 'black', label: t('ui.blackText') },
					...(preset === 'custom' ? [{ value: 'custom', label: t('ui.customColor') }] : []),
				]}
				onChange={(choice) => {
					if (choice !== 'custom') onChange?.(choice === 'black' ? '#202733' : '#ffffff')
				}}
			/>
			<details ref={detailsRef} style={{ marginTop: 10 }}>
				<summary>{t('ui.customColor')}</summary>
				<Input
					style={{ marginTop: 8 }}
					aria-label={t('ui.customTextColor')}
					value={value || ''}
					placeholder="#ffffff"
					allowClear
					onChange={(event) => onChange?.(event.target.value)}
				/>
			</details>
		</div>
	)
}
