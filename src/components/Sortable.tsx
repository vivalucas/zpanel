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
	getItemLabel,
	onSort,
	children,
	className,
	disabled,
}: {
	items: T[]
	getItemLabel: (item: T) => string
	onSort: (items: T[]) => void
	children: (item: T) => ReactNode
	className?: string
	disabled?: boolean
}) {
	const { t } = useTranslation()
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	)
	const announce = (key: string, activeId: string | number, overId = activeId) => {
		const activeItem = items.find((item) => item.id === activeId)
		const position = items.findIndex((item) => item.id === overId) + 1
		if (!activeItem || !position) return undefined
		return t(key, { name: getItemLabel(activeItem), position, count: items.length })
	}
	return (
		<DndContext
			sensors={sensors}
			collisionDetection={closestCenter}
			accessibility={{
				screenReaderInstructions: { draggable: t('ui.sortInstructions') },
				announcements: {
					onDragStart: ({ active }) => announce('ui.sortStart', active.id),
					onDragOver: ({ active, over }) => {
						if (over) return announce('ui.sortMove', active.id, over.id)
						const item = items.find((item) => item.id === active.id)
						return item ? t('ui.sortOutside', { name: getItemLabel(item) }) : undefined
					},
					onDragEnd: ({ active, over }) =>
						announce(over ? 'ui.sortEnd' : 'ui.sortCancel', active.id, over?.id),
					onDragCancel: ({ active }) => announce('ui.sortCancel', active.id),
				},
			}}
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
						<SortableItem key={item.id} id={item.id} disabled={disabled} label={getItemLabel(item)}>
							{children(item)}
						</SortableItem>
					))}
				</div>
			</SortableContext>
		</DndContext>
	)
}
function SortableItem({
	id,
	disabled,
	children,
	label,
}: {
	id: number
	disabled?: boolean
	children: ReactNode
	label: string
}) {
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
					type="button"
					ref={setActivatorNodeRef}
					className="drag-handle"
					{...attributes}
					{...listeners}
					aria-label={t('ui.sortHandle', { name: label })}
					aria-roledescription={t('ui.sortRole')}
				>
					<HolderOutlined aria-hidden="true" />
				</button>
			)}
		</div>
	)
}
