import { useEffect, useRef, useState } from 'react'
import { Button, Space, Upload } from 'antd'
import type { UploadFile } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { uploadImage } from '@/lib/api'
import { useSessionRequest } from '@/lib/session'
import { useFeedback } from '@/lib/feedback'

type UploadResultHandler = (url: string) => void | Promise<void>
type ImageUploadProps = {
	multiple?: boolean
	disabled?: boolean
	onUploadingChange?: (uploading: boolean) => void
} & (
	| { onChange: UploadResultHandler; onStart?: () => UploadResultHandler }
	| { onChange?: UploadResultHandler; onStart: () => UploadResultHandler }
)

export function ImageUpload({
	onChange,
	onStart,
	multiple = false,
	disabled = false,
	onUploadingChange,
}: ImageUploadProps) {
	const { t, error } = useFeedback()
	const request = useSessionRequest()
	const [files, setFiles] = useState<UploadFile[]>([])
	const pendingRef = useRef(new Set<string>())
	const uploading = files.some((file) => file.status === 'uploading')
	useEffect(() => {
		onUploadingChange?.(uploading)
		return () => onUploadingChange?.(false)
	}, [uploading, onUploadingChange])
	const upload = async (file: File, uid: string) => {
		if (disabled || pendingRef.current.has(uid)) return
		pendingRef.current.add(uid)
		setFiles((list) => list.map((entry) => (entry.uid === uid ? { ...entry, status: 'uploading' } : entry)))
		try {
			// Capture the caller's draft before sending, including when retrying an upload.
			const applyResult = onStart?.() || onChange
			const result = await uploadImage(file, request)
			setFiles((list) =>
				list.map((entry) =>
					entry.uid === uid ? { ...entry, status: 'done', url: result.imageUrl, response: result } : entry,
				),
			)
			try {
				await applyResult?.(result.imageUrl)
			} catch (err) {
				error(err)
			}
			return result
		} catch (err) {
			setFiles((list) =>
				list.map((entry) => (entry.uid === uid ? { ...entry, status: 'error', error: err } : entry)),
			)
			error(err)
			throw err
		} finally {
			pendingRef.current.delete(uid)
		}
	}
	return (
		<div className="image-upload">
			<Upload
				multiple={multiple}
				disabled={disabled || (!multiple && uploading)}
				accept=".png,.jpg,.jpeg,.webp,.gif,.ico"
				fileList={files}
				showUploadList={{ showRemoveIcon: (file) => file.status !== 'uploading' }}
				onChange={({ fileList }) => setFiles(fileList)}
				beforeUpload={(file) => {
					if (file.size > 10 * 1024 * 1024 || !/\.(?:png|jpe?g|webp|gif|ico)$/i.test(file.name)) {
						error(new Error(t('review.imageSizeType')))
						return Upload.LIST_IGNORE
					}
					return true
				}}
				customRequest={(options) => {
					const file = options.file as File & { uid: string }
					void upload(file, file.uid)
						.then((result) => options.onSuccess?.(result))
						.catch((err: Error) => options.onError?.(err))
				}}
				itemRender={(node, file) => (
					<Space className="upload-row">
						{node}
						{file.status === 'error' && (
							<Button
								size="small"
								disabled={disabled || (!multiple && uploading)}
								onClick={() => {
									if (file.originFileObj) void upload(file.originFileObj, file.uid).catch(() => {})
								}}
							>
								{t('ui.retry')}
							</Button>
						)}
					</Space>
				)}
			>
				<Button disabled={disabled || (!multiple && uploading)} icon={<UploadOutlined aria-hidden="true" />}>
					{t('iconItem.selectUpload')}
				</Button>
			</Upload>
		</div>
	)
}
