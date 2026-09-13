import {
	DndContext,
	KeyboardSensor,
	PointerSensor,
	closestCenter,
	useSensor,
	useSensors,
} from '@dnd-kit/core'
import {
	SortableContext,
	arrayMove,
	rectSortingStrategy,
	sortableKeyboardCoordinates,
	useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { HolderOutlined } from '@ant-design/icons'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
export function SortableGrid<T extends { id: number }>({
	items,
	onSort,
	children,
	className,
	disabled,
}: {
	items: T[]
	onSort: (items: T[]) => void
	children: (item: T) => ReactNode
	className?: string
	disabled?: boolean
}) {
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	)
	return (
		<DndContext
			sensors={sensors}
			collisionDetection={closestCenter}
			onDragEnd={({ active, over }) => {
				if (!over || active.id === over.id || disabled) return
				onSort(
					arrayMove(
						items,
						items.findIndex((item) => item.id === active.id),
						items.findIndex((item) => item.id === over.id),
					),
				)
			}}
		>
			<SortableContext items={items} strategy={rectSortingStrategy}>
				<div className={className}>
					{items.map((item) => (
						<SortableItem key={item.id} id={item.id} disabled={disabled}>
							{children(item)}
						</SortableItem>
					))}
				</div>
			</SortableContext>
		</DndContext>
	)
}
function SortableItem({ id, disabled, children }: { id: number; disabled?: boolean; children: ReactNode }) {
	const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
		useSortable({
			id,
			disabled,
		})
	const { t } = useTranslation()
	return (
		<div
			ref={setNodeRef}
			className={`sortable-item ${isDragging ? 'dragging' : ''}`}
			style={{ transform: CSS.Transform.toString(transform), transition }}
		>
			{children}
			{!disabled && (
				<button
					ref={setActivatorNodeRef}
					className="drag-handle"
					aria-label={t('ui.dragSort')}
					{...attributes}
					{...listeners}
				>
					<HolderOutlined aria-hidden="true" />
				</button>
			)}
		</div>
	)
}
