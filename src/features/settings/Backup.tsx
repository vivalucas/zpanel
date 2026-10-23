import { useSessionRequest } from '@/lib/session'
import { randomId } from '@/lib/id'
import { useFeedback } from '@/lib/feedback'
import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Checkbox, Radio, Space, Upload } from 'antd'
import { DownloadOutlined, UploadOutlined } from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'
import { exportJson, importJsonString } from '@/utils/jsonImportExport'
import type { ImportJsonResult } from '@/utils/jsonImportExport'
import { useGroups } from '@/lib/queries'
import { fetchGroups, fetchPanel } from '@/lib/api'
import { Section } from '@/components/shared'
export default function Backup() {
	const request = useSessionRequest()
	const existing = useGroups()
	const [selected, setSelected] = useState<ImportJsonResult | null>(null)
	const [filename, setFilename] = useState('')
	const [mode, setMode] = useState('append')
	const [icons, setIcons] = useState(true)
	const [style, setStyle] = useState(true)
	const [busy, setBusy] = useState(false)
	const [confirming, setConfirming] = useState(false)
	const selectionRef = useRef(0)
	useEffect(
		() => () => {
			selectionRef.current++
		},
		[],
	)
	const receiptRef = useRef<{ payload: string; requestId: string } | null>(null)
	const client = useQueryClient()
	const { t, error, message, modal } = useFeedback()
	const doImport = async () => {
		if (busy) return
		const data = {
			mode,
			...(icons && selected?.hasProperty('icons') ? { icons: selected.geticons() } : {}),
			...(style && selected?.getStyleConfig() ? { panel: selected.getStyleConfig() } : {}),
		}
		if (!('icons' in data) && !('panel' in data)) throw new Error(t('ui.selectImportData'))
		if ('icons' in data && mode === 'replace' && existing.error)
			throw new Error(t('review.previewUnavailable'))
		const payload = JSON.stringify(data)
		if (receiptRef.current?.payload !== payload) receiptRef.current = { payload, requestId: randomId() }
		setBusy(true)
		try {
			await request('/panel/userConfig/import', { ...data, requestId: receiptRef.current.requestId })
			await client.invalidateQueries()
			setSelected(null)
			receiptRef.current = null
			void message.success(t('common.success'))
		} catch (err) {
			error(err)
			throw err
		} finally {
			setBusy(false)
		}
	}
	return (
		<>
			<Section title={t('ui.export')} description={t('review.configOnly')}>
				<Space direction="vertical">
					<Checkbox
						disabled={busy || confirming}
						checked={icons}
						onChange={(e) => setIcons(e.target.checked)}
					>
						{t('ui.navigationData')}
					</Checkbox>
					<Checkbox
						disabled={busy || confirming}
						checked={style}
						onChange={(e) => setStyle(e.target.checked)}
					>
						{t('apps.baseSettings.appName')}
					</Checkbox>
					<Button
						type="primary"
						icon={<DownloadOutlined aria-hidden="true" />}
						loading={busy}
						disabled={confirming || (!icons && !style)}
						onClick={async () => {
							setBusy(true)
							try {
								const result = exportJson(import.meta.env.VITE_APP_VERSION)
								if (icons) {
									const groups = await fetchGroups(undefined, request)
									result.addIconsData(
										groups.map((group) => ({
											title: group.title || '',
											sort: group.sort || 0,
											children: group.items.map((item) => ({
												title: item.title,
												sort: item.sort || 0,
												icon: item.icon,
												url: item.url,
												lanUrl: item.lanUrl || '',
												description: item.description || '',
												openMethod: item.openMethod,
											})),
										})),
									)
								}
								if (style) result.addStyleData((await fetchPanel(undefined, request)).panel)
								result.exportFile()
							} catch (err) {
								error(err)
							} finally {
								setBusy(false)
							}
						}}
					>
						{t('ui.export')}
					</Button>
				</Space>
			</Section>
			<Section title={t('ui.import')} description={t('review.importModeHelp')}>
				<Upload
					accept=".json,.zpanel.json"
					disabled={busy || confirming}
					showUploadList={false}
					beforeUpload={async (file) => {
						const current = ++selectionRef.current
						setSelected(null)
						try {
							if (file.size > 5 * 1024 * 1024) throw new Error(t('review.importSize'))
							const parsed = importJsonString(await file.text())
							if (current !== selectionRef.current) return false
							if (!parsed || !parsed.isPassCheckMd5() || !parsed.isPassCheckConfigVersionBest())
								throw new Error(t('ui.invalidBackup'))
							receiptRef.current = null
							setSelected(parsed)
							setFilename(file.name)
							setIcons(parsed.hasProperty('icons'))
							setStyle(!!parsed.getStyleConfig())
						} catch (err) {
							if (current !== selectionRef.current) return false
							error(err)
							setSelected(null)
						}
						return false
					}}
				>
					<Button icon={<UploadOutlined aria-hidden="true" />}>{t('ui.selectBackup')}</Button>
				</Upload>
				{selected && (
					<div className="spaced">
						<p>
							<strong>{filename}</strong>
						</p>
						<Alert
							type="info"
							title={t('ui.importPreview', {
								groups: selected.geticons().length,
								items: selected.geticons().reduce((sum, g) => sum + g.children.length, 0),
							})}
						/>
						<Space direction="vertical" className="spaced">
							<Checkbox
								checked={icons}
								disabled={busy || confirming || !selected.hasProperty('icons')}
								onChange={(e) => setIcons(e.target.checked)}
							>
								{t('ui.navigationData')}
							</Checkbox>
							<Checkbox
								checked={style}
								disabled={busy || confirming || !selected.getStyleConfig()}
								onChange={(e) => setStyle(e.target.checked)}
							>
								{t('apps.baseSettings.appName')}
							</Checkbox>
							<Radio.Group
								disabled={busy || confirming}
								value={mode}
								onChange={(e) => {
									setMode(e.target.value)
									receiptRef.current = null
								}}
								options={[
									{ value: 'append', label: t('review.append') },
									{ value: 'replace', label: t('review.replace') },
								]}
							/>
							{icons && (
								<Alert
									type={mode === 'replace' ? 'warning' : 'info'}
									showIcon
									title={t(
										mode === 'replace' ? 'review.importReplacePreview' : 'review.importAppendPreview',
										{
											groups: selected.geticons().length,
											items: selected.geticons().reduce((sum, group) => sum + group.children.length, 0),
											oldGroups: existing.data?.length ?? '…',
											oldItems: existing.data?.reduce((sum, group) => sum + group.items.length, 0) ?? '…',
										},
									)}
								/>
							)}
							{existing.error && (
								<Alert
									type="error"
									title={t('review.previewUnavailable')}
									action={<Button onClick={() => existing.refetch()}>{t('ui.retry')}</Button>}
								/>
							)}
							{mode === 'replace' && icons && (
								<Alert type="warning" showIcon title={t('review.replaceWarning')} />
							)}
							<Button
								type="primary"
								loading={busy}
								disabled={
									busy ||
									confirming ||
									(mode === 'replace' && icons && (!existing.data || !!existing.error)) ||
									(!(icons && selected.hasProperty('icons')) && !(style && selected.getStyleConfig()))
								}
								onClick={() => {
									if (mode === 'replace' && icons) {
										setConfirming(true)
										modal.confirm({
											title: t('review.replaceWarning'),
											okButtonProps: { danger: true },
											onOk: doImport,
											afterClose: () => setConfirming(false),
										})
									} else void doImport().catch(() => {})
								}}
							>
								{t('ui.import')}
							</Button>
						</Space>
					</div>
				)}
			</Section>
		</>
	)
}
