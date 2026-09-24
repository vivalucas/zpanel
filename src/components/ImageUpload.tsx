import { Button, Upload } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { uploadImage } from '@/lib/api'
import { useFeedback } from '@/lib/feedback'

export function ImageUpload({ onChange }: { onChange: (url: string) => void }) {
	const { t, error } = useFeedback()
	return (
		<Upload
			accept=".png,.jpg,.jpeg,.webp,.gif,.ico"
			showUploadList={false}
			customRequest={async (options) => {
				try {
					const data = await uploadImage(options.file as Blob)
					onChange(data.imageUrl)
					options.onSuccess?.(data)
				} catch (err) {
					error(err)
					options.onError?.(err as Error)
				}
			}}
		>
			<Button icon={<UploadOutlined aria-hidden="true" />}>{t('iconItem.selectUpload')}</Button>
		</Upload>
	)
}
