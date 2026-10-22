import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Account {
	token: string
	user: User.Info
}
interface Preferences {
	theme: 'light' | 'dark' | 'auto'
	language: string
	network: 'lan' | 'wan'
	token: string | null
	accounts: Account[]
	homeEditHintDismissed: boolean
	setPreference: (
		patch: Partial<Pick<Preferences, 'theme' | 'language' | 'network' | 'homeEditHintDismissed'>>,
	) => void
	signIn: (account: Account) => void
	selectAccount: (token: string | null) => void
	forgetAccount: (token: string) => void
}
export const usePreferences = create<Preferences>()(
	persist(
		(set) => ({
			theme: 'auto',
			language: 'zh-CN',
			network: 'wan',
			token: null,
			accounts: [],
			homeEditHintDismissed: false,
			setPreference: (patch) => set(patch),
			signIn: (account) =>
				set((s) => ({
					token: account.token,
					accounts: [...s.accounts.filter((a) => a.user.id !== account.user.id), account],
				})),
			selectAccount: (token) => set({ token }),
			forgetAccount: (token) =>
				set((s) => ({
					accounts: s.accounts.filter((a) => a.token !== token),
					token: s.token === token ? null : s.token,
				})),
		}),
		{ name: 'zpanel-preferences', version: 1 },
	),
)
