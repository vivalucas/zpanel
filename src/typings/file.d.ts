declare namespace File {

	interface Info extends Common.InfoBase {
		src: string
		userId: number
		ownerId: number
		fileName: string
		originalName: string
		method: number
		ext: string
		mimeType: string
		size: number
		sha256: string
		objectKey: string
		relativePath: string
		visibility: 'private' | 'public' | 'system'
		purpose: 'icon' | 'wallpaper' | 'avatar' | 'site_icon' | 'attachment' | 'backup'
		status: 'active' | 'orphaned' | 'deleted' | 'delete_failed'
	}


}
