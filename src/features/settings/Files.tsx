import { useSessionRequest } from '@/lib/session'
import { useFeedback } from '@/lib/feedback'
import { useEffect, useState } from 'react'
import { Button, Empty, Image, Modal, Pagination, Select, Space, Tabs, Upload } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { usePanel } from '@/lib/queries'
import { uploadImage } from '@/lib/api'
import { Loading, QueryError, Section } from '@/components/shared'
import { bytes } from '@/lib/format'
interface Usage {
	kind: string
	title: string
	id: string
}
export default function Files({ user }: { user: User.Info }) {
	const request = useSessionRequest()
	const [tab, setTab] = useState('own')
	const [page, setPage] = useState(1)
	const [selected, setSelected] = useState<File.Info | null>(null)
	const [replacementPage, setReplacementPage] = useState(1)
	const [replacementTab, setReplacementTab] = useState('own')
	const [replacement, setReplacement] = useState<number>()
	const [busy, setBusy] = useState(false)
	const panel = usePanel()
	const client = useQueryClient()
	const { t, error, message, modal } = useFeedback()
	const files = useQuery({
		queryKey: ['files', tab, page],
		queryFn: ({ signal }) =>
			request<Common.ListResponse<File.Info[]>>(
				tab === 'own' ? '/file/getList' : '/file/getPublicList',
				{ page, limit: 24 },
				{ signal },
			),
	})
	const lastPage = files.data ? Math.max(1, Math.ceil(files.data.count / 24)) : page
	useEffect(() => {
		// Ant Pagination clamps only its display; synchronize the query page after deletion.
		// eslint-disable-next-line react/set-state-in-effect
		if (page > lastPage) setPage(lastPage)
	}, [page, lastPage])

	const replacements = useQuery({
		queryKey: ['files', 'replacement', replacementTab, replacementPage],
		enabled: !!selected,
		queryFn: ({ signal }) =>
			request<Common.ListResponse<File.Info[]>>(
				replacementTab === 'own' ? '/file/getList' : '/file/getPublicList',
				{ page: replacementPage, limit: 24 },
				{ signal },
			),
	})

	const usage = useQuery({
		queryKey: ['file-usage', selected?.id],
		enabled: !!selected,
		queryFn: ({ signal }) => request<Usage[]>('/file/usage', { id: selected?.id }, { signal }),
	})
	const refresh = () => client.invalidateQueries({ queryKey: ['files'] })
	return (
		<Section
			title={t('ui.files')}
			extra={
				<Upload
					multiple
					accept=".png,.jpg,.jpeg,.gif,.webp,.ico"
					showUploadList={false}
					customRequest={async (options) => {
						try {
							const result = await uploadImage(options.file as Blob)
							options.onSuccess?.(result)
							await refresh()
							void message.success(t('common.success'))
						} catch (err) {
							error(err)
							options.onError?.(err as Error)
						}
					}}
				>
					<Button type="primary" icon={<UploadOutlined aria-hidden="true" />}>
						{t('iconItem.selectUpload')}
					</Button>
				</Upload>
			}
		>
			{panel.error && <QueryError error={panel.error} retry={() => panel.refetch()} />}
			<Tabs
				activeKey={tab}
				items={[
					{ key: 'own', label: t('ui.myFiles') },
					{ key: 'public', label: t('ui.publicGallery') },
				]}
				onChange={(value) => {
					setTab(value)
					setPage(1)
				}}
			/>
			{files.error ? (
				<QueryError error={files.error} retry={() => files.refetch()} />
			) : files.isPending ? (
				<Loading />
			) : !files.data.list.length ? (
				<Empty />
			) : (
				<>
					<Image.PreviewGroup>
						<div className="file-grid">
							{files.data.list.map((file) => (
								<article key={file.id} className="file-card">
									<div className="file-image">
										<Image src={file.src} alt={file.originalName} />
									</div>
									<div className="file-copy">
										<strong title={file.originalName}>{file.originalName}</strong>
										<span className="muted">{bytes(file.size)}</span>
										<Space wrap>
											<Button
												size="small"
												loading={busy}
												disabled={!panel.data}
												onClick={async () => {
													setBusy(true)
													try {
														await request('/panel/userConfig/set', {
															...panel.data,
															panel: { ...panel.data!.panel, backgroundImageSrc: file.src },
														})
														await client.invalidateQueries({ queryKey: ['panel'] })
														void message.success(t('common.success'))
													} catch (err) {
														error(err)
													} finally {
														setBusy(false)
													}
												}}
											>
												{t('ui.setWallpaper')}
											</Button>
											<Button
												size="small"
												onClick={() => {
													setSelected(file)
													setReplacement(undefined)
													setReplacementPage(1)
													setReplacementTab('own')
												}}
											>
												{t('review.usage')}
											</Button>
											{file.ownerId === user.id && (
												<Button
													size="small"
													danger
													onClick={() =>
														modal.confirm({
															title: t('ui.deleteFile'),
															content: file.originalName,
															okButtonProps: { danger: true },
															onOk: async () => {
																try {
																	const result = await request<{ deletedIds: number[]; failedIds: number[] }>(
																		'/file/deletes',
																		{ ids: [file.id] },
																	)
																	await refresh()
																	if (!result.deletedIds.includes(file.id!) || result.failedIds.length)
																		throw new Error(t('common.failed'))
																} catch (err) {
																	error(err)
																	throw err
																}
															},
														})
													}
												>
													{t('common.delete')}
												</Button>
											)}
										</Space>
									</div>
								</article>
							))}
						</div>
					</Image.PreviewGroup>
				</>
			)}
			{files.data && (
				<Pagination
					className="spaced"
					current={page}
					pageSize={24}
					total={files.data.count}
					showSizeChanger={false}
					onChange={setPage}
				/>
			)}
			<Modal
				open={!!selected}
				title={t('review.usage')}
				footer={null}
				onCancel={() => setSelected(null)}
				destroyOnHidden
			>
				{usage.isPending ? (
					<Loading />
				) : usage.error ? (
					<QueryError error={usage.error} retry={() => usage.refetch()} />
				) : (
					<>
						<div className="usage-list">
							{usage.data.length ? (
								usage.data.map((item) => (
									<p key={`${item.kind}-${item.id}-${item.title}`}>
										{t(`review.usage_${item.kind}`, { defaultValue: item.kind })} ·{' '}
										{item.title || t('review.privateUsage')}
									</p>
								))
							) : (
								<p>{t('review.unused')}</p>
							)}
						</div>
						{selected?.ownerId === user.id && (
							<>
								<p className="muted">{t('review.replaceHelp')}</p>
								<Tabs
									activeKey={replacementTab}
									items={[
										{ key: 'own', label: t('ui.myFiles') },
										{ key: 'public', label: t('ui.publicGallery') },
									]}
									onChange={(value) => {
										setReplacementTab(value)
										setReplacementPage(1)
										setReplacement(undefined)
									}}
								/>
								{replacements.error && (
									<QueryError error={replacements.error} retry={() => replacements.refetch()} />
								)}
								<Select
									style={{ width: '100%' }}
									value={replacement}
									placeholder={t('ui.selectReplacement')}
									loading={replacements.isFetching}
									options={replacements.data?.list
										.filter((file) => file.id !== selected?.id)
										.map((file) => ({ value: file.id, label: file.originalName }))}
									onChange={setReplacement}
									aria-label={t('ui.selectReplacement')}
								/>
								<Pagination
									className="spaced"
									size="small"
									current={replacementPage}
									pageSize={24}
									total={replacements.data?.count}
									showSizeChanger={false}
									onChange={(value) => {
										setReplacementPage(value)
										setReplacement(undefined)
									}}
								/>
								<Button
									className="spaced"
									loading={busy}
									disabled={!replacement}
									onClick={async () => {
										setBusy(true)
										try {
											await request('/file/replace', { id: selected?.id, replacementId: replacement })
											await client.invalidateQueries()
											setSelected(null)
											void message.success(t('review.replaced'))
										} catch (err) {
											error(err)
										} finally {
											setBusy(false)
										}
									}}
								>
									{t('review.replaceUsage')}
								</Button>
							</>
						)}
					</>
				)}
			</Modal>
		</Section>
	)
}
