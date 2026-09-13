import { useUnsavedChanges } from '@/lib/unsaved'
import { useSessionRequest } from '@/lib/session'
import { randomId } from '@/lib/id'
import { useFeedback } from '@/lib/feedback'
import { useEffect, useState } from 'react'
import { Button, Form, Input, Select, Space, Switch } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMonitorConfig, useSearchConfig } from '@/lib/queries'
import { saveModule } from '@/lib/api'
import type { SearchConfig } from '@/lib/api'
import { Loading, QueryError, Section } from '@/components/shared'
import { isSafeNavigationUrl } from '@/utils/navigation'
export default function Modules() {
	const request = useSessionRequest()
	const search = useSearchConfig()
	const monitors = useMonitorConfig()
	const client = useQueryClient()
	const { t, error, message } = useFeedback()
	const [searchForm] = Form.useForm()
	const [monitorForm] = Form.useForm()
	const [busy, setBusy] = useState<string | null>(null)
	const [searchDirty, setSearchDirty] = useState(false)
	const [monitorDirty, setMonitorDirty] = useState(false)
	useUnsavedChanges(searchDirty || monitorDirty)
	const engineList = Form.useWatch('searchEngineList', searchForm) || []
	const paths = useQuery({
		queryKey: ['mountpoints'],
		queryFn: ({ signal }) =>
			request<SystemMonitor.Mountpoint[]>('/system/monitor/getDiskMountpoints', {}, { signal }),
	})
	useEffect(() => {
		if (search.data && !searchDirty)
			searchForm.setFieldsValue({
				...search.data,
				selected: search.data.searchEngineList.findIndex(
					(e) => e.url === search.data.currentSearchEngine.url,
				),
			})
	}, [search.data, searchForm, searchDirty])
	useEffect(() => {
		if (monitors.data && !monitorDirty) monitorForm.setFieldsValue(monitors.data)
	}, [monitors.data, monitorForm, monitorDirty])
	if (search.isPending || monitors.isPending) return <Loading />
	if (search.error || monitors.error)
		return (
			<QueryError
				error={search.error || monitors.error}
				retry={() => {
					void search.refetch()
					void monitors.refetch()
				}}
			/>
		)
	return (
		<>
			<Section title={t('ui.searchEngines')} description={t('ui.searchEnginesDescription')}>
				<Form
					form={searchForm}
					onValuesChange={() => setSearchDirty(true)}
					disabled={busy !== null}
					layout="vertical"
					onFinish={async (values) => {
						const engines = values.searchEngineList as SearchConfig['searchEngineList']
						if (!engines?.length) return error(new Error(t('ui.oneEngineRequired')))
						setBusy('search')
						try {
							await saveModule('deskModuleSearchBox', {
								searchEngineList: engines,
								currentSearchEngine: engines[values.selected] || engines[0],
								newWindowOpen: values.newWindowOpen,
							})
							await client.invalidateQueries({ queryKey: ['search'] })
							setSearchDirty(false)
							void message.success(t('common.success'))
						} catch (err) {
							error(err)
						} finally {
							setBusy(null)
						}
					}}
				>
					<Form.List name="searchEngineList">
						{(fields, { add, remove }) => (
							<>
								{fields.map((field, index) => (
									<div className="repeat-card" key={field.key}>
										<div className="repeat-header">
											<strong>
												{t('ui.searchEngine')} {index + 1}
											</strong>
											<Button
												danger
												type="text"
												aria-label={t('common.delete')}
												icon={<DeleteOutlined aria-hidden="true" />}
												disabled={busy !== null || fields.length <= 1}
												onClick={() => {
													const selected = searchForm.getFieldValue('selected')
													remove(field.name)
													searchForm.setFieldValue(
														'selected',
														selected === index ? 0 : selected > index ? selected - 1 : selected,
													)
												}}
											/>
										</div>
										<div className="form-grid">
											<Form.Item
												name={[field.name, 'title']}
												label={t('common.title')}
												rules={[{ required: true, whitespace: true }]}
											>
												<Input />
											</Form.Item>
											<Form.Item
												name={[field.name, 'url']}
												label={t('iconItem.url')}
												rules={[
													{ required: true },
													{
														validator: (_, value) =>
															value && /^https?:\/\//i.test(value) && isSafeNavigationUrl(value)
																? Promise.resolve()
																: Promise.reject(new Error(t('review.invalidUrl'))),
													},
												]}
											>
												<Input placeholder="https://www.google.com/search?q=%s" />
											</Form.Item>
											<Form.Item name={[field.name, 'iconSrc']} label={t('ui.imageUrl')}>
												<Input />
											</Form.Item>
										</div>
									</div>
								))}
								<Button
									icon={<PlusOutlined aria-hidden="true" />}
									onClick={() => add({ title: '', url: '', iconSrc: '' })}
								>
									{t('deskModule.searchBox.addEngine')}
								</Button>
							</>
						)}
					</Form.List>
					<Form.Item name="selected" label={t('ui.defaultEngine')} className="spaced">
						<Select
							options={engineList.map((_: unknown, index: number) => ({
								value: index,
								label: `${index + 1}`,
							}))}
						/>
					</Form.Item>
					<Form.Item
						name="newWindowOpen"
						label={t('deskModule.searchBox.openWithNewOpen')}
						valuePropName="checked"
					>
						<Switch />
					</Form.Item>
					<Button type="primary" htmlType="submit" loading={busy === 'search'}>
						{t('common.save')}
					</Button>
				</Form>
			</Section>
			<Section title={t('apps.baseSettings.systemMonitorStatus')} description={t('ui.monitorDescription')}>
				{paths.error && <QueryError error={paths.error} retry={() => paths.refetch()} />}
				<Form
					form={monitorForm}
					onValuesChange={() => setMonitorDirty(true)}
					disabled={busy !== null}
					layout="vertical"
					onFinish={async (values) => {
						setBusy('monitors')
						try {
							await saveModule('systemMonitor', values)
							await client.invalidateQueries({ queryKey: ['monitors'] })
							setMonitorDirty(false)
							void message.success(t('common.success'))
						} catch (err) {
							error(err)
						} finally {
							setBusy(null)
						}
					}}
				>
					<Form.List name="list">
						{(fields, { add, remove, move }) => (
							<>
								{fields.map((field, index) => (
									<div className="repeat-card" key={field.key}>
										<div className="repeat-header">
											<strong>
												{t('ui.monitorCard')} {index + 1}
											</strong>
											<Space>
												<Button
													size="small"
													disabled={busy !== null || index === 0}
													onClick={() => move(index, index - 1)}
												>
													{t('ui.moveUp')}
												</Button>
												<Button
													danger
													size="small"
													aria-label={t('common.delete')}
													icon={<DeleteOutlined aria-hidden="true" />}
													onClick={() => remove(field.name)}
												/>
											</Space>
										</div>
										<Form.Item name={[field.name, 'key']} hidden>
											<Input />
										</Form.Item>
										<div className="form-grid">
											<Form.Item name={[field.name, 'monitorType']} label={t('ui.type')}>
												<Select
													options={[
														{ value: 'cpu', label: 'CPU' },
														{ value: 'memory', label: t('deskModule.systemMonitor.memoryState') },
														{ value: 'disk', label: t('deskModule.systemMonitor.diskState') },
													]}
												/>
											</Form.Item>
											<Form.Item name={[field.name, 'description']} label={t('common.description')}>
												<Input />
											</Form.Item>
											<Form.Item
												noStyle
												shouldUpdate={(a, b) =>
													a.list?.[field.name]?.monitorType !== b.list?.[field.name]?.monitorType
												}
											>
												{({ getFieldValue }) =>
													getFieldValue(['list', field.name, 'monitorType']) === 'disk' && (
														<Form.Item
															name={[field.name, 'extendParam', 'path']}
															label={t('deskModule.systemMonitor.diskMountPoint')}
															rules={[{ required: true }]}
														>
															<Select
																loading={paths.isPending}
																options={paths.data?.map((p) => ({
																	value: p.mountpoint,
																	label: `${p.mountpoint} · ${p.device}`,
																}))}
															/>
														</Form.Item>
													)
												}
											</Form.Item>
											{['progressColor', 'progressRailColor', 'color', 'backgroundColor'].map((key) => (
												<Form.Item key={key} name={[field.name, 'extendParam', key]} label={t(`ui.${key}`)}>
													<Input allowClear placeholder={t('ui.followTheme')} />
												</Form.Item>
											))}
										</div>
									</div>
								))}
								<Space>
									<Button
										icon={<PlusOutlined aria-hidden="true" />}
										onClick={() =>
											add({ key: randomId(), monitorType: 'cpu', description: '', extendParam: {} })
										}
									>
										{t('common.add')}
									</Button>
									<Button type="primary" htmlType="submit" loading={busy === 'monitors'}>
										{t('common.save')}
									</Button>
								</Space>
							</>
						)}
					</Form.List>
				</Form>
			</Section>
		</>
	)
}
