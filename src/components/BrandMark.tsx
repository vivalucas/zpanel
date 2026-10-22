import logo from '@/assets/logo.svg?no-inline'

export function BrandMark({ small = false }: { small?: boolean }) {
	return <img className={`brand-mark${small ? ' small' : ''}`} src={logo} alt="" aria-hidden="true" />
}
