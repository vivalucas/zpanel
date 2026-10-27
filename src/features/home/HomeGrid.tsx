import { lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import { OptionalModuleBoundary, OptionalModuleFailure } from '@/components/OptionalModuleBoundary'

type Item = Panel.ItemInfo & { id: number }
const SortableGrid = lazy(() =>
	import('@/components/Sortable').then((module) => ({ default: module.SortableGrid<Item> })),
)

// Ordinary navigation needs the same layout, without mounting a drag sensor for every item.
export default function HomeGrid({
	sorting,
	onCancel,
	...props
}: {
	sorting: boolean
	onCancel: () => void
	items: Item[]
	getItemLabel: (item: Item) => string
	onSort: (items: Item[]) => void
	children: (item: Item) => ReactNode
	className: string
	disabled: boolean
}) {
	const display = (
		<div className={props.className} aria-busy={sorting || undefined} inert={sorting}>
			{props.items.map((item) => (
				<div className="sortable-item" key={item.id}>
					{props.children(item)}
				</div>
			))}
		</div>
	)
	return sorting ? (
		<OptionalModuleBoundary
			fallback={
				<>
					<div className="home-navigation-state home-module-failure">
						<OptionalModuleFailure onCancel={onCancel} compact />
					</div>
					{display}
				</>
			}
		>
			<Suspense fallback={display}>
				<SortableGrid {...props} />
			</Suspense>
		</OptionalModuleBoundary>
	) : (
		display
	)
}
