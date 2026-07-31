import { useTranslation } from "react-i18next";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";

export function SortableWidget({
  id,
  onRemove,
  children,
}: {
  id: string;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group/widget min-w-0">
      {/* Drag handle + close button overlay */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1 opacity-0 group-hover/widget:opacity-100 transition-opacity">
        <button
          type="button"
          className="cursor-grab active:cursor-grabbing p-1 rounded bg-white/80 hover:bg-slate-100 text-slate-400 hover:text-slate-600 shadow-sm border border-slate-200"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="p-1 rounded bg-white/80 hover:bg-red-50 text-slate-400 hover:text-red-500 cursor-pointer shadow-sm border border-slate-200"
          title={t("sidebar.hide_widget")}
        >
          <X size={12} />
        </button>
      </div>
      {children}
    </div>
  );
}
