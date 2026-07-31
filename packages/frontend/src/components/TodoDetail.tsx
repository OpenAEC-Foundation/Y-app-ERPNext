import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ListTodo, X, Calendar, Flag, CheckCircle2, Circle,
  ExternalLink, Trash2,
} from "lucide-react";
import { updateDocument, createDocument, getErpNextLinkUrl } from "../lib/erpnext";

export interface ToDo {
  name: string;
  description: string;
  status: string;
  priority: string;
  date: string;
  reference_type: string;
  reference_name: string;
  allocated_to: string;
}

export function stripHtml(html: string): string {
  if (!html) return "";
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}

export function TodoDetail({
  todo,
  mode,
  myEmail,
  onClose,
  onSave,
  onDelete,
}: {
  todo: ToDo | null;
  mode: "create" | "edit";
  myEmail: string;
  onClose: () => void;
  onSave: () => void;
  onDelete?: (todoName: string) => void;
}) {
  const { t } = useTranslation();
  const isCreate = mode === "create";

  const [description, setDescription] = useState(todo?.description ? stripHtml(todo.description) : "");
  const [priority, setPriority] = useState(todo?.priority || "Medium");
  const [date, setDate] = useState(todo?.date || new Date().toISOString().split("T")[0]);
  const [allocatedTo] = useState(todo?.allocated_to || myEmail);
  const [status, setStatus] = useState(todo?.status || "Open");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!description.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (isCreate) {
        await createDocument("ToDo", {
          description: description.trim(),
          priority,
          status: "Open",
          date: date || undefined,
          allocated_to: allocatedTo || undefined,
        });
      } else if (todo) {
        await updateDocument("ToDo", todo.name, {
          description: description.trim(),
          priority,
          date: date || undefined,
          allocated_to: allocatedTo || undefined,
          status,
        });
      }
      onSave();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("todo.create_error"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!todo || !onDelete) return;
    setDeleting(true);
    try {
      await onDelete(todo.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end pt-[env(safe-area-inset-top,0px)]">
      {/* Backdrop */}
      <div className="flex-1 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="w-full max-w-md bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-y-teal/10 rounded-lg">
              <ListTodo className="text-y-teal" size={18} />
            </div>
            <h3 className="font-semibold text-slate-800">
              {isCreate ? t("todo.new_todo") : t("todo.edit_todo")}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer p-1">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              {t("todo.description_placeholder")}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("todo.description_placeholder")}
              rows={5}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal resize-none"
              autoFocus
            />
          </div>

          {/* Priority */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              <Flag size={13} /> {t("tasks.detail.priority")}
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
            >
              <option value="High">{t("todo.priority_high")}</option>
              <option value="Medium">{t("todo.priority_medium")}</option>
              <option value="Low">{t("todo.priority_low")}</option>
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              <Calendar size={13} /> {t("tasks.detail.deadline")}
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
            />
          </div>

          {/* Status (edit only) */}
          {!isCreate && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                {t("todo.status_label")}
              </label>
              <button
                onClick={() => setStatus(status === "Open" ? "Closed" : "Open")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors cursor-pointer ${
                  status === "Closed"
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-orange-50 text-orange-700 border-orange-200"
                }`}
              >
                {status === "Closed" ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                {status === "Closed" ? t("todo.status_done") : t("todo.status_open")}
              </button>
            </div>
          )}

          {/* Reference (edit, read-only) */}
          {!isCreate && todo?.reference_type && todo?.reference_name && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                {t("todo.reference")}
              </label>
              <a
                href={`${getErpNextLinkUrl()}/${todo.reference_type.toLowerCase().replace(/ /g, "-")}/${todo.reference_name}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-y-teal hover:text-y-teal-dark flex items-center gap-1"
              >
                {todo.reference_type}: {todo.reference_name}
                <ExternalLink size={12} />
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center gap-3">
          {/* Delete button (left side) */}
          {!isCreate && onDelete && todo && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 cursor-pointer"
            >
              <Trash2 size={14} />
              {deleting ? "..." : t("common.delete_tooltip")}
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !description.trim()}
            className="px-4 py-2 text-sm bg-y-teal text-white rounded-lg hover:bg-y-teal-dark disabled:opacity-50 cursor-pointer"
          >
            {saving ? t("common.saving") : isCreate ? t("common.create") : t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
