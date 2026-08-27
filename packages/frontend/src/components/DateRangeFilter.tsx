import React from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

interface DateRangeFilterProps {
  fromDate: string;
  toDate: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}

const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  fromDate,
  toDate,
  onFromChange,
  onToChange,
}) => {
  const { t } = useTranslation();
  const hasValue = fromDate || toDate;

  return (
    <div className="flex flex-wrap items-center gap-2 min-w-0">
      <input
        type="date"
        value={fromDate}
        onChange={(e) => onFromChange(e.target.value)}
        className="min-w-0 flex-1 sm:flex-none px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
        placeholder={t("date_range.from_placeholder")}
        title={t("date_range.from_title")}
      />
      <span className="text-slate-400 text-sm shrink-0">{t("date_range.through")}</span>
      <input
        type="date"
        value={toDate}
        onChange={(e) => onToChange(e.target.value)}
        className="min-w-0 flex-1 sm:flex-none px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
        placeholder={t("date_range.to_placeholder")}
        title={t("date_range.to_title")}
      />
      {hasValue && (
        <button
          onClick={() => {
            onFromChange("");
            onToChange("");
          }}
          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
          title={t("date_range.clear")}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};

export default DateRangeFilter;
