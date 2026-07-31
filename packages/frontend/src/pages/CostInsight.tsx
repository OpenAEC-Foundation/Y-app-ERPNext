import React, { useEffect, useState, useMemo } from "react";
import { fetchAll, getErpNextLinkUrl } from "../lib/erpnext";
import {
  PieChart,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  TrendingUp,
  Calendar,
  BarChart3,
} from "lucide-react";
import CompanySelect from "../components/CompanySelect";
import { useTranslation } from "react-i18next";
import { getActiveCompany } from "../lib/instances";

// ─── Interfaces ────────────────────────────────────────────────────────────────

interface GLEntry {
  account: string;
  debit: number;
  credit: number;
  posting_date: string;
  voucher_no?: string;
  voucher_type?: string;
  party?: string;
  party_type?: string;
  against?: string;
}

interface Account {
  name: string;
  account_name: string;
  root_type: string;
  parent_account: string;
  is_group: number;
}

interface Segment {
  label: string;
  value: number;
  pct: number;
  color: string;
  key: string;
}

interface CostSection {
  kind: "costs" | "credits";
  label: string;
  total: number;
  categoryMap: Map<string, Map<string, GLEntry[]>>;
}

type DateFilterMode = "year" | "quarter" | "month";

interface DateFilter {
  mode: DateFilterMode;
  quarter: number; // 1-4
  month: number;   // 0-11
}

/** What we're comparing the current period against */
interface CompareTarget {
  year: number;
  quarter: number; // 1-4
  month: number;   // 0-11
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const currentYear = new Date().getFullYear();
const years = [2022, 2023, 2024, 2025, 2026];

const monthNameKeys = [
  "kosteninzicht.month_january", "kosteninzicht.month_february", "kosteninzicht.month_march",
  "kosteninzicht.month_april", "kosteninzicht.month_may", "kosteninzicht.month_june",
  "kosteninzicht.month_july", "kosteninzicht.month_august", "kosteninzicht.month_september",
  "kosteninzicht.month_october", "kosteninzicht.month_november", "kosteninzicht.month_december",
];

const CATEGORY_HEX = [
  "#3b82f6", "#22c55e", "#a855f7", "#ec4899", "#6366f1",
  "#14b8a6", "#f97316", "#06b6d4", "#f43f5e", "#f59e0b",
  "#84cc16", "#10b981", "#d946ef", "#0ea5e9", "#8b5cf6", "#ef4444",
];

// Parent account categories to exclude (balance sheet items, not costs)
const EXCLUDED_PARENTS = new Set([
  "accounts receivable",
  "bank accounts",
  "accounts payable",
  "temporary accounts",
]);

// Translation map for common ERPNext parent account names → NL
// Keys are lowercase for case-insensitive lookup
const CATEGORY_NL: Record<string, string> = {
  "indirect expenses": "Indirecte kosten",
  "direct expenses": "Directe kosten",
  "expenses": "Overige kosten",
  "fixed assets": "Vaste activa",
  "current assets": "Vlottende activa",
  "current liabilities": "Kortlopende schulden",
  "equity": "Eigen vermogen",
  "cost of goods sold": "Kostprijs omzet",
  "stock expenses": "Voorraadkosten",
  "depreciation": "Afschrijvingen",
  "loans and advances (assets)": "Leningen en voorschotten",
  "accounts payable": "Crediteuren",
  "accounts receivable": "Debiteuren",
  "bank accounts": "Bankrekeningen",
  "cash in hand": "Kas",
  "taxes payable": "Te betalen belastingen",
  "duties and taxes": "Heffingen en belastingen",
  "stock assets": "Voorraadactiva",
  "capital account": "Kapitaalrekening",
  "temporary accounts": "Tussenrekeningen",
  "round off": "Afrondingen",
  "salary": "Salaris",
  "payroll payable": "Te betalen lonen",
  "salary component": "Salariscomponent",
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function euro(value: number): string {
  return value.toLocaleString("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function stripSuffix(parentAccount: string): string {
  return parentAccount.replace(/\s*-\s*\w+$/, "").trim();
}

function colorForIndex(idx: number): string {
  return CATEGORY_HEX[idx % CATEGORY_HEX.length];
}

function translateCategory(name: string): string {
  // TODO: re-enable when translations are verified
  void CATEGORY_NL;
  // return CATEGORY_NL[name.toLowerCase()] ?? name;
  return name;
}

function matchesDateFilter(postingDate: string, filter: DateFilter): boolean {
  if (filter.mode === "year") return true;
  const m = new Date(postingDate).getMonth();
  if (filter.mode === "quarter") {
    const start = (filter.quarter - 1) * 3;
    return m >= start && m <= start + 2;
  }
  return m === filter.month;
}

/** Compute % change: positive = increase. Returns null if no previous data. */
function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? null : null;
  return ((current - previous) / previous) * 100;
}

/** Trend badge: ▲ red for increase, ▼ green for decrease, → grey for ~0% */
function TrendBadge({ current, previous, invert }: { current: number; previous: number; invert?: boolean }) {
  const pct = pctChange(current, previous);
  if (pct === null) return null;
  const absPct = Math.abs(pct);
  if (absPct < 0.5) {
    return <span className="text-xs text-slate-400 whitespace-nowrap">→ 0%</span>;
  }
  // For costs: increase is bad (red), decrease is good (green)
  // For credits/income (invert): increase is good (green), decrease is bad (red)
  const isUp = pct > 0;
  const isGood = invert ? isUp : !isUp;
  const color = isGood ? "text-emerald-600" : "text-red-600";
  const arrow = isUp ? "▲" : "▼";
  return (
    <span className={`text-xs font-medium whitespace-nowrap ${color}`}>
      {arrow} {isUp ? "+" : "−"}{absPct.toFixed(1)}%
    </span>
  );
}

/** Label for the compare target based on filter mode */
function compareLabel(mode: DateFilterMode, target: CompareTarget, t: (k: string) => string): string {
  if (mode === "year") return `${target.year}`;
  if (mode === "quarter") return `Q${target.quarter} ${target.year}`;
  return `${t(monthNameKeys[target.month]).slice(0, 3)} ${target.year}`;
}

function buildSegments(map: Map<string, number>, labelFn: (key: string) => string): Segment[] {
  const sorted = [...map.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((s, [, v]) => s + v, 0);
  return sorted.map(([key, val], idx) => ({
    label: labelFn(key),
    value: val,
    pct: total > 0 ? val / total : 0,
    color: colorForIndex(idx),
    key,
  }));
}

// ─── SunburstDonut ─────────────────────────────────────────────────────────────

interface RingDef {
  segments: Segment[];
  onSegmentClick?: (key: string) => void;
}

interface SunburstDonutProps {
  rings: RingDef[];          // inner → outer
  size?: number;
  centerLabel?: string;
  centerValue?: string;
  /** Start/end angle of expanded slice (fraction 0-1) for outer ring alignment */
  expandedSlice?: { startPct: number; endPct: number } | null;
}

function SunburstDonut({
  rings,
  size = 280,
  centerLabel,
  centerValue,
  expandedSlice,
}: SunburstDonutProps) {
  const [hovered, setHovered] = useState<{ ring: number; key: string } | null>(null);
  const svgW = size;
  const svgH = size;
  const cx = svgW / 2;
  const cy = size / 2;
  const ringWidth = size * 0.09;
  const ringGap = size * 0.015;
  const innerR = size * 0.22;
  const outerRingIdx = rings.length - 1;

  const tooltipSeg = hovered
    ? rings[hovered.ring]?.segments.find((s) => s.key === hovered.key)
    : null;

  return (
    <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} style={{ display: "block", overflow: "visible" }}>
      {rings.map((ring, ringIdx) => {
        const r = innerR + ringIdx * (ringWidth + ringGap);
        const circumference = 2 * Math.PI * r;
        const isActiveRing = ringIdx === outerRingIdx;
        const isDimmed = !isActiveRing && rings.length > 1;

        const sliceStart = ringIdx > 0 && expandedSlice ? expandedSlice.startPct : 0;
        const sliceSpan = ringIdx > 0 && expandedSlice
          ? expandedSlice.endPct - expandedSlice.startPct
          : 1;

        // Background ring
        const bgElements = [];
        if (ringIdx === 0) {
          bgElements.push(
            <circle key={`bg-${ringIdx}`} cx={cx} cy={cy} r={r} fill="none"
              stroke={isDimmed ? "#f1f5f9" : "#f1f5f9"} strokeWidth={ringWidth} />
          );
        } else if (expandedSlice) {
          const bgDashArray = sliceSpan * circumference;
          const bgDashOffset = circumference * (1 - sliceStart) - circumference;
          bgElements.push(
            <circle key={`bg-${ringIdx}`} cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9"
              strokeWidth={ringWidth} strokeDasharray={`${bgDashArray} ${circumference}`}
              strokeDashoffset={bgDashOffset} strokeLinecap="butt"
              transform={`rotate(-90, ${cx}, ${cy})`} />
          );
        }

        let cumPct = sliceStart;
        const arcs = ring.segments.map((seg) => {
          const segSpan = seg.pct * sliceSpan;
          const dashArray = segSpan * circumference;
          const dashOffset = circumference * (1 - cumPct) - circumference;
          const midPct = cumPct + segSpan / 2;
          const arc = { ...seg, dashArray, dashOffset, ringIdx, midPct, segSpan };
          cumPct += segSpan;
          return arc;
        });

        return (
          <g key={ringIdx} style={{ opacity: isDimmed ? 0.35 : 1, transition: "opacity 0.3s" }}>
            {bgElements}
            {arcs.map((arc) => {
              const isHovered = hovered?.ring === ringIdx && hovered?.key === arc.key;
              const sw = isHovered ? ringWidth * 1.2 : ringWidth;
              return (
                <circle
                  key={`${ringIdx}-${arc.key}`}
                  cx={cx} cy={cy} r={r}
                  fill="none" stroke={arc.color} strokeWidth={sw}
                  strokeDasharray={`${arc.dashArray} ${circumference}`}
                  strokeDashoffset={arc.dashOffset}
                  strokeLinecap="butt"
                  transform={`rotate(-90, ${cx}, ${cy})`}
                  style={{
                    cursor: ring.onSegmentClick ? "pointer" : "default",
                    transition: "stroke-width 0.15s, stroke-dasharray 0.3s, stroke-dashoffset 0.3s",
                  }}
                  onMouseEnter={() => setHovered({ ring: ringIdx, key: arc.key })}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => ring.onSegmentClick?.(arc.key)}
                />
              );
            })}
          </g>
        );
      })}

      {/* Center: hover shows segment info, otherwise default label */}
      {tooltipSeg ? (
        <g pointerEvents="none">
          <text x={cx} y={cy - size * 0.04} textAnchor="middle" dominantBaseline="middle"
            fontSize={size * 0.034} fontWeight="600" fill="#475569">
            {tooltipSeg.label.length > 20 ? tooltipSeg.label.slice(0, 18) + "\u2026" : tooltipSeg.label}
          </text>
          <text x={cx} y={cy + size * 0.015} textAnchor="middle" dominantBaseline="middle"
            fontSize={size * 0.049} fontWeight="700" fill="#1e293b">
            {euro(tooltipSeg.value)}
          </text>
          <text x={cx} y={cy + size * 0.06} textAnchor="middle" dominantBaseline="middle"
            fontSize={size * 0.03} fill="#64748b">
            {(tooltipSeg.pct * 100).toFixed(1)}%
          </text>
        </g>
      ) : (
        <g>
          {centerValue && (
            <text x={cx} y={cy - size * 0.025} textAnchor="middle" dominantBaseline="middle"
              fontSize={size * 0.053} fontWeight="700" fill="#1e293b">
              {centerValue}
            </text>
          )}
          {centerLabel && (
            <text x={cx} y={cy + size * 0.045} textAnchor="middle" dominantBaseline="middle"
              fontSize={size * 0.034} fill="#64748b">
              {centerLabel}
            </text>
          )}
        </g>
      )}

      <defs>
        <filter id="sb-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.12" />
        </filter>
      </defs>
    </svg>
  );
}

// ─── BarTrendChart ─────────────────────────────────────────────────────────────

interface BarGroupedData {
  years: number[];
  periods: string[];
  data: number[][]; // data[periodIdx][yearIdx]
}

interface BarTrendChartProps {
  data: number[];
  prevData?: number[];
  labels: string[];
  color: string;
  title: string;
  compareLabelText?: string;
  height?: number;
  grouped?: BarGroupedData;
  onBarClick?: (label: string, year?: number) => void;
}

const BarTrendChart = React.memo(function BarTrendChart({ data, labels, color, title, height = 180, grouped, onBarClick }: BarTrendChartProps) {
  const [hoveredGroup, setHoveredGroup] = useState<number | null>(null);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  const padLeft = 60;
  const padRight = 8;
  const padTop = 36;
  const padBottom = 38;
  const chartW = 800;
  const chartH = height;
  const innerW = chartW - padLeft - padRight;
  const innerH = chartH - padTop - padBottom;

  // Grouped mode: multiple bars per period group (one per year, newest = full color, older = fading)
  if (grouped && grouped.years.length > 0 && grouped.periods.length > 0) {
    const { years, periods, data: gData } = grouped;
    const numYears = years.length;
    const numPeriods = periods.length;
    const allVals = gData.flat();
    const maxVal = Math.max(...allVals, 1);

    const groupGap = innerW / numPeriods;
    const groupW = groupGap * 0.8;
    const singleBarW = Math.min(groupW / numYears, 40);
    const totalBarsW = singleBarW * numYears;

    const ticks = [0.25, 0.5, 0.75, 1.0].map((f) => ({
      val: maxVal * f,
      y: padTop + innerH * (1 - f),
    }));

    return (
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-2">
          <p className="text-sm font-semibold text-slate-600">{title}</p>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            {years.map((yr, yi) => {
              const opacity = 0.2 + 0.8 * ((yi + 1) / numYears);
              return (
                <span key={yr} className="flex items-center gap-1">
                  <span className="inline-block w-3 h-2 rounded-sm" style={{ backgroundColor: color, opacity }} />
                  <span>{yr}</span>
                </span>
              );
            })}
          </div>
        </div>
        <svg viewBox={`0 0 ${chartW} ${chartH}`} width="100%" height={height} style={{ display: "block" }}>
          {ticks.map((tick) => (
            <g key={tick.val}>
              <line x1={padLeft} y1={tick.y} x2={chartW - padRight} y2={tick.y} stroke="#f1f5f9" strokeWidth={1} />
              <text x={padLeft - 6} y={tick.y + 4} textAnchor="end" fontSize={10} fill="#94a3b8">
                {tick.val >= 1000 ? `\u20AC${(tick.val / 1000).toFixed(0)}k` : `\u20AC${tick.val.toFixed(0)}`}
              </text>
            </g>
          ))}
          {periods.map((period, pi) => {
            const groupX = padLeft + pi * groupGap + (groupGap - totalBarsW) / 2;
            const isGroupHovered = hoveredGroup === pi;
            const periodValues = gData[pi] || [];

            return (
              <g key={period}>
                {years.map((yr, yi) => {
                  const val = periodValues[yi] || 0;
                  if (val <= 0) return null;
                  const barH = innerH * (val / maxVal);
                  const bx = groupX + yi * singleBarW;
                  const by = padTop + innerH - barH;
                  // Newer years = more opaque, oldest = most faded
                  const baseOpacity = 0.15 + 0.7 * ((yi + 1) / numYears);
                  const opacity = (isGroupHovered && hoveredBar === yi) ? Math.min(baseOpacity + 0.2, 1) : baseOpacity;

                  return (
                    <rect key={yr} x={bx} y={by} width={Math.max(singleBarW - 1, 2)} height={Math.max(barH, 1)}
                      fill={color} opacity={opacity} rx={2}
                      style={{ transition: "opacity 0.1s" }}
                      onMouseEnter={() => { setHoveredGroup(pi); setHoveredBar(yi); }}
                      onMouseLeave={() => { setHoveredGroup(null); setHoveredBar(null); }}
                      onClick={() => onBarClick?.(period, yr)}
                      className="cursor-pointer"
                    />
                  );
                })}
                {/* Period label */}
                <text x={groupX + totalBarsW / 2} y={padTop + innerH + 14} textAnchor="middle" fontSize={10} fill="#64748b">
                  {period}
                </text>
                {/* Year labels under each bar */}
                {years.map((yr, yi) => (
                  <text key={yr} x={groupX + yi * singleBarW + (singleBarW - 1) / 2} y={padTop + innerH + 26}
                    textAnchor="middle" fontSize={8} fill="#94a3b8">
                    {`'${String(yr).slice(2)}`}
                  </text>
                ))}
                {/* Tooltip */}
                {isGroupHovered && hoveredBar !== null && (() => {
                  const val = periodValues[hoveredBar] || 0;
                  const yr = years[hoveredBar];
                  const label = `${yr}: \u20AC${val.toLocaleString("nl-NL", { maximumFractionDigits: 0 })}`;
                  const tw = label.length * 6.5 + 16;
                  const bx = groupX + hoveredBar * singleBarW;
                  const barH = innerH * (val / maxVal);
                  const tx = Math.min(Math.max(bx + singleBarW / 2 - tw / 2, padLeft), chartW - padRight - tw);
                  const ty = padTop + innerH - barH - 24;
                  return (
                    <g pointerEvents="none">
                      <rect x={tx} y={Math.max(ty, 2)} width={tw} height={18} rx={4} fill="white" stroke="#e2e8f0" strokeWidth={1} />
                      <text x={tx + tw / 2} y={Math.max(ty, 2) + 12} textAnchor="middle" fontSize={10} fill="#1e293b" fontWeight="600">
                        {label}
                      </text>
                    </g>
                  );
                })()}
              </g>
            );
          })}
          <line x1={padLeft} y1={padTop + innerH} x2={chartW - padRight} y2={padTop + innerH} stroke="#e2e8f0" strokeWidth={1} />
        </svg>
      </div>
    );
  }

  // Fallback: simple single-bar chart (should not normally be reached with grouped data)
  const maxVal = Math.max(...data, 1);
  const barCount = data.length || 1;
  const barGap = innerW / barCount;
  const fullBarW = Math.min(barGap * 0.7, 60);

  const ticks = [0.25, 0.5, 0.75, 1.0].map((f) => ({
    val: maxVal * f,
    y: padTop + innerH * (1 - f),
  }));

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-3 mb-2">
        <p className="text-sm font-semibold text-slate-600">{title}</p>
      </div>
      <svg viewBox={`0 0 ${chartW} ${chartH}`} width="100%" height={height} style={{ display: "block" }}>
        {ticks.map((tick) => (
          <g key={tick.val}>
            <line x1={padLeft} y1={tick.y} x2={chartW - padRight} y2={tick.y} stroke="#f1f5f9" strokeWidth={1} />
            <text x={padLeft - 6} y={tick.y + 4} textAnchor="end" fontSize={10} fill="#94a3b8">
              {tick.val >= 1000 ? `\u20AC${(tick.val / 1000).toFixed(0)}k` : `\u20AC${tick.val.toFixed(0)}`}
            </text>
          </g>
        ))}
        {data.map((val, i) => {
          const bx = padLeft + i * barGap + (barGap - fullBarW) / 2;
          const barH = innerH * (val / maxVal);
          const by = padTop + innerH - barH;
          const isHovered = hoveredGroup === i;
          return (
            <g key={i} onMouseEnter={() => setHoveredGroup(i)} onMouseLeave={() => setHoveredGroup(null)} onClick={() => onBarClick?.(labels[i])} className="cursor-pointer">
              <rect x={bx} y={by} width={fullBarW} height={Math.max(barH, 1)} fill={color}
                opacity={isHovered ? 1 : 0.75} rx={2} style={{ transition: "opacity 0.1s" }} />
              <text x={bx + fullBarW / 2} y={padTop + innerH + 16} textAnchor="middle" fontSize={10} fill="#64748b">
                {labels[i]}
              </text>
              {isHovered && val > 0 && (() => {
                const label = `\u20AC${val.toLocaleString("nl-NL", { maximumFractionDigits: 0 })}`;
                const tw = label.length * 6.5 + 16;
                const tx = Math.min(Math.max(bx + fullBarW / 2 - tw / 2, padLeft), chartW - padRight - tw);
                const ty = by - 24;
                return (
                  <g pointerEvents="none">
                    <rect x={tx} y={Math.max(ty, 2)} width={tw} height={18} rx={4} fill="white" stroke="#e2e8f0" strokeWidth={1} />
                    <text x={tx + tw / 2} y={Math.max(ty, 2) + 12} textAnchor="middle" fontSize={10} fill="#1e293b" fontWeight="600">
                      {label}
                    </text>
                  </g>
                );
              })()}
            </g>
          );
        })}
        <line x1={padLeft} y1={padTop + innerH} x2={chartW - padRight} y2={padTop + innerH} stroke="#e2e8f0" strokeWidth={1} />
      </svg>
    </div>
  );
});

// ─── CostTree ─────────────────────────────────────────────────────────────────

interface CostTreeProps {
  categorySegments: Segment[];
  filteredCategoryMap: Map<string, Map<string, GLEntry[]>>;
  accountMap: Map<string, Account>;
  selectedCat: string | null;
  selectedAcct: { account: string; account_name: string } | null;
  expandedSupplier: string | null;
  onSelectCat: (key: string | null) => void;
  onSelectAcct: (acct: { account: string; account_name: string } | null) => void;
  onToggleSupplier: (key: string) => void;
  netValue: (e: GLEntry) => number;
  erpNextUrl: string;
  prevCategoryTotal: (catKey: string) => number;
  prevAccountTotal: (catKey: string, acctKey: string) => number;
  isCredits?: boolean;
  year: number;
  compareLabelText: string;
}

function CostTree({
  categorySegments,
  filteredCategoryMap,
  accountMap,
  selectedCat,
  selectedAcct,
  expandedSupplier,
  onSelectCat,
  onSelectAcct,
  onToggleSupplier,
  netValue,
  erpNextUrl,
  prevCategoryTotal,
  prevAccountTotal,
  isCredits,
  year,
  compareLabelText,
}: CostTreeProps) {
  const { t } = useTranslation();

  return (
    <div className="flex-1 min-w-0 max-h-[500px] overflow-y-auto text-sm">
      {categorySegments.length === 0 ? (
        <p className="text-slate-400 py-2">{t("kosteninzicht.no_cost_data")}</p>
      ) : (
        <div>
          {/* Column header */}
          <div className="flex items-center gap-2 px-2 py-1 mb-1 border-b border-slate-200 text-xs text-slate-400">
            <span className="flex-1" />
            <span className="flex-shrink-0 w-10 text-right">%</span>
            <span className="flex-shrink-0 w-24 text-right">{year}</span>
            <span className="flex-shrink-0 w-20 text-right">vs {compareLabelText}</span>
          </div>
          {categorySegments.map((cat) => {
            const isCatOpen = selectedCat === cat.key;
            return (
              <div key={cat.key}>
                {/* Category row */}
                <button
                  onClick={() => {
                    onSelectCat(isCatOpen ? null : cat.key);
                    onToggleSupplier("");
                  }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors text-left ${isCatOpen ? "bg-slate-50" : ""}`}
                >
                  {isCatOpen
                    ? <ChevronDown size={14} className="text-slate-400 flex-shrink-0" />
                    : <ChevronRight size={14} className="text-slate-400 flex-shrink-0" />}
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="truncate flex-1 font-medium text-slate-700">{cat.label}</span>
                  <span className="text-xs text-slate-400 flex-shrink-0 w-10 text-right">{(cat.pct * 100).toFixed(0)}%</span>
                  <span className="font-medium text-slate-600 flex-shrink-0 w-24 text-right">{euro(cat.value)}</span>
                  <span className="flex-shrink-0 w-20 text-right"><TrendBadge current={cat.value} previous={prevCategoryTotal(cat.key)} invert={isCredits} /></span>
                </button>

                {/* Accounts (level 1) */}
                {isCatOpen && (() => {
                  const acctMap = filteredCategoryMap.get(cat.key);
                  if (!acctMap) return null;
                  const acctTotals = [...acctMap.entries()]
                    .map(([acct, entries]) => ({
                      acct,
                      name: accountMap.get(acct)?.account_name ?? acct,
                      total: entries.reduce((s, e) => s + netValue(e), 0),
                      entries,
                    }))
                    .filter((a) => a.total > 0)
                    .sort((a, b) => b.total - a.total);

                  return (
                    <div className="ml-5 border-l-2 border-slate-100 pl-2">
                      {acctTotals.map((acctItem, acctIdx) => {
                        const isAcctOpen = selectedAcct?.account === acctItem.acct;
                        const acctColor = colorForIndex(acctIdx);
                        return (
                          <div key={acctItem.acct}>
                            {/* Account row */}
                            <button
                              onClick={() => {
                                if (isAcctOpen) {
                                  onSelectAcct(null);
                                } else {
                                  onSelectAcct({ account: acctItem.acct, account_name: acctItem.name });
                                }
                                onToggleSupplier("");
                              }}
                              className={`w-full flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors text-left ${isAcctOpen ? "bg-blue-50/50" : ""}`}
                            >
                              {isAcctOpen
                                ? <ChevronDown size={12} className="text-slate-400 flex-shrink-0" />
                                : <ChevronRight size={12} className="text-slate-400 flex-shrink-0" />}
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: acctColor }} />
                              <span className="truncate flex-1 text-slate-600">{acctItem.name}</span>
                              <span className="font-medium text-slate-600 flex-shrink-0 w-24 text-right">{euro(acctItem.total)}</span>
                              <span className="flex-shrink-0 w-20 text-right"><TrendBadge current={acctItem.total} previous={prevAccountTotal(cat.key, acctItem.acct)} invert={isCredits} /></span>
                            </button>

                            {/* Suppliers (level 2) — grouped by party within account */}
                            {isAcctOpen && (() => {
                              const supplierMap = new Map<string, GLEntry[]>();
                              for (const e of acctItem.entries) {
                                const name = e.party || e.against || t("common.unknown");
                                if (!supplierMap.has(name)) supplierMap.set(name, []);
                                supplierMap.get(name)!.push(e);
                              }
                              const suppliers = [...supplierMap.entries()]
                                .map(([name, entries]) => ({
                                  name,
                                  total: entries.reduce((s, e) => s + netValue(e), 0),
                                  entries: entries.sort((a, b) => (b.posting_date ?? "").localeCompare(a.posting_date ?? "")),
                                }))
                                .filter((s) => s.total > 0)
                                .sort((a, b) => b.total - a.total);

                              return (
                                <div className="ml-5 border-l-2 border-slate-100 pl-2">
                                  {suppliers.map((supplier, idx) => {
                                    const supplierKey = `${acctItem.acct}:${supplier.name}`;
                                    const isSupOpen = expandedSupplier === supplierKey;
                                    return (
                                      <div key={supplier.name}>
                                        <button
                                          onClick={() => onToggleSupplier(supplierKey)}
                                          className={`w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 cursor-pointer transition-colors text-left ${isSupOpen ? "bg-emerald-50/50" : ""}`}
                                        >
                                          {isSupOpen
                                            ? <ChevronDown size={10} className="text-slate-300 flex-shrink-0" />
                                            : <ChevronRight size={10} className="text-slate-300 flex-shrink-0" />}
                                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: colorForIndex(idx) }} />
                                          <span className="truncate flex-1 text-slate-500">{supplier.name}</span>
                                          <span className="text-xs text-slate-400 flex-shrink-0">({supplier.entries.length})</span>
                                          <span className="text-xs font-medium text-slate-500 flex-shrink-0 w-24 text-right">{euro(supplier.total)}</span>
                                        </button>

                                        {/* Invoices (level 3) */}
                                        {isSupOpen && (
                                          <div className="ml-5 pl-2 border-l border-slate-100">
                                            {supplier.entries.map((entry, i) => (
                                              <div key={`${entry.voucher_no}-${i}`} className="flex items-center gap-2 px-2 py-0.5 text-xs text-slate-400">
                                                <span className="flex-shrink-0 w-20">{entry.posting_date}</span>
                                                <a
                                                  href={`${erpNextUrl}/${(entry.voucher_type ?? "gl-entry").toLowerCase().replace(/\s+/g, "-")}/${entry.voucher_no}`}
                                                  target="_blank" rel="noopener noreferrer"
                                                  className="text-y-teal hover:text-y-teal-dark hover:underline truncate flex-1"
                                                >
                                                  {entry.voucher_no}
                                                </a>
                                                <span className="flex-shrink-0 w-20 text-right text-slate-500">
                                                  {euro(Math.abs(entry.debit - entry.credit))}
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── CostSectionPanel ─────────────────────────────────────────────────────────

interface CostSectionPanelProps {
  section: CostSection;
  prevSection?: CostSection;
  accountMap: Map<string, Account>;
  erpNextUrl: string;
  dateFilter: DateFilter;
  compareTarget: CompareTarget;
  year: number;
  /** All GL entries for the current year (for bar chart) */
  glEntries: GLEntry[];
  prevGlEntries: GLEntry[];
  allGlEntries: GLEntry[];
  onNavigatePeriod?: (label: string, year?: number) => void;
}

function CostSectionPanel({ section, prevSection, accountMap, erpNextUrl, dateFilter, compareTarget, year, glEntries, prevGlEntries, allGlEntries, onNavigatePeriod }: CostSectionPanelProps) {
  const { t } = useTranslation();
  const isCredits = section.kind === "credits";

  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [selectedAcct, setSelectedAcct] = useState<{ account: string; account_name: string } | null>(null);
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);

  function netValue(e: GLEntry): number {
    const n = e.debit - e.credit;
    return isCredits ? Math.abs(n) : n;
  }

  // Filter entries by date
  const filteredCategoryMap = useMemo((): Map<string, Map<string, GLEntry[]>> => {
    if (dateFilter.mode === "year") return section.categoryMap;
    const result = new Map<string, Map<string, GLEntry[]>>();
    for (const [cat, acctMap] of section.categoryMap) {
      const newAcctMap = new Map<string, GLEntry[]>();
      for (const [acct, entries] of acctMap) {
        const filtered = entries.filter((e) => matchesDateFilter(e.posting_date, dateFilter));
        if (filtered.length > 0) newAcctMap.set(acct, filtered);
      }
      if (newAcctMap.size > 0) result.set(cat, newAcctMap);
    }
    return result;
  }, [section.categoryMap, dateFilter]);

  // Previous period filtered map — uses compareTarget's quarter/month
  const prevFilteredCategoryMap = useMemo((): Map<string, Map<string, GLEntry[]>> => {
    if (!prevSection) return new Map();
    if (dateFilter.mode === "year") return prevSection.categoryMap;
    // Build a DateFilter from compareTarget so matchesDateFilter works on prev entries
    const prevFilter: DateFilter = {
      mode: dateFilter.mode,
      quarter: compareTarget.quarter,
      month: compareTarget.month,
    };
    const result = new Map<string, Map<string, GLEntry[]>>();
    for (const [cat, acctMap] of prevSection.categoryMap) {
      const newAcctMap = new Map<string, GLEntry[]>();
      for (const [acct, entries] of acctMap) {
        const filtered = entries.filter((e) => matchesDateFilter(e.posting_date, prevFilter));
        if (filtered.length > 0) newAcctMap.set(acct, filtered);
      }
      if (newAcctMap.size > 0) result.set(cat, newAcctMap);
    }
    return result;
  }, [prevSection, dateFilter.mode, compareTarget]);

  /** Sum all entries in a category map for a given category key */
  function prevCategoryTotal(catKey: string): number {
    const acctMap = prevFilteredCategoryMap.get(catKey);
    if (!acctMap) return 0;
    let sum = 0;
    for (const entries of acctMap.values()) for (const e of entries) sum += netValue(e);
    return sum;
  }

  /** Sum all entries in a category map for a given category + account key */
  function prevAccountTotal(catKey: string, acctKey: string): number {
    const acctMap = prevFilteredCategoryMap.get(catKey);
    if (!acctMap) return 0;
    const entries = acctMap.get(acctKey);
    if (!entries) return 0;
    return entries.reduce((s, e) => s + netValue(e), 0);
  }

  // Ring 0: categories (always shown)
  const categorySegments = useMemo((): Segment[] => {
    const totals = new Map<string, number>();
    for (const [cat, acctMap] of filteredCategoryMap) {
      let sum = 0;
      for (const entries of acctMap.values()) for (const e of entries) sum += netValue(e);
      if (sum > 0) totals.set(cat, sum);
    }
    return buildSegments(totals, translateCategory);
  }, [filteredCategoryMap, isCredits]);

  // Ring 1: accounts within selected category (shown when category clicked)
  const accountSegments = useMemo((): Segment[] => {
    if (!selectedCat) return [];
    const acctMap = filteredCategoryMap.get(selectedCat);
    if (!acctMap) return [];
    const totals = new Map<string, number>();
    for (const [acct, entries] of acctMap) {
      const sum = entries.reduce((s, e) => s + netValue(e), 0);
      if (sum > 0) totals.set(acct, sum);
    }
    return buildSegments(totals, (k) => accountMap.get(k)?.account_name ?? k);
  }, [selectedCat, filteredCategoryMap, accountMap, isCredits]);

  // Ring 2: parties within selected account (shown when account clicked)
  const partySegments = useMemo((): Segment[] => {
    if (!selectedAcct || !selectedCat) return [];
    const acctMap = filteredCategoryMap.get(selectedCat);
    const entries = acctMap?.get(selectedAcct.account) ?? [];
    const partyTotals = new Map<string, number>();
    for (const e of entries) {
      const name = e.party || e.against || e.voucher_no || t("common.unknown");
      partyTotals.set(name, (partyTotals.get(name) ?? 0) + netValue(e));
    }
    return buildSegments(partyTotals, (k) => k);
  }, [selectedAcct, selectedCat, filteredCategoryMap, t, isCredits]);

  const totalValue = categorySegments.reduce((s, seg) => s + seg.value, 0);

  // Compute the angular position of the selected category for outer ring alignment
  const expandedCatSlice = useMemo(() => {
    if (!selectedCat) return null;
    let cumPct = 0;
    for (const seg of categorySegments) {
      if (seg.key === selectedCat) {
        return { startPct: cumPct, endPct: cumPct + seg.pct };
      }
      cumPct += seg.pct;
    }
    return null;
  }, [selectedCat, categorySegments]);

  // Compute the angular position of selected account within the account ring
  const expandedAcctSlice = useMemo(() => {
    if (!selectedAcct || !expandedCatSlice) return null;
    const sliceStart = expandedCatSlice.startPct;
    const sliceSpan = expandedCatSlice.endPct - expandedCatSlice.startPct;
    let cumPct = sliceStart;
    for (const seg of accountSegments) {
      const segSpan = seg.pct * sliceSpan;
      if (seg.key === selectedAcct.account) {
        return { startPct: cumPct, endPct: cumPct + segSpan };
      }
      cumPct += segSpan;
    }
    return null;
  }, [selectedAcct, accountSegments, expandedCatSlice]);

  // Build rings for SunburstDonut
  const rings = useMemo((): RingDef[] => {
    const result: RingDef[] = [{
      segments: categorySegments,
      onSegmentClick: (key) => {
        if (selectedCat === key) {
          // Click same → deselect
          setSelectedCat(null);
          setSelectedAcct(null);
        } else {
          setSelectedCat(key);
          setSelectedAcct(null);
        }
      },
    }];
    if (selectedCat && accountSegments.length > 0) {
      result.push({
        segments: accountSegments,
        onSegmentClick: (key) => {
          if (selectedAcct?.account === key) {
            setSelectedAcct(null);
          } else {
            const acctObj = accountMap.get(key);
            setSelectedAcct({ account: key, account_name: acctObj?.account_name ?? key });
          }
        },
      });
    }
    if (selectedAcct && partySegments.length > 0) {
      result.push({
        segments: partySegments,
        onSegmentClick: (key) => {
          const supplierKey = `${selectedAcct.account}:${key}`;
          setExpandedSupplier((prev) => prev === supplierKey ? null : supplierKey);
        },
      });
    }
    return result;
  }, [categorySegments, accountSegments, partySegments, selectedCat, selectedAcct, accountMap]);

  // Bar chart data — filtered by selection in the tree/donut
  const { barData, barPrevData, barLabels, barTitle, barGrouped } = useMemo(() => {
    // Determine which accounts to include based on selection
    const relevantAccounts = new Set<string>();
    let chartTitle = section.label;
    // Party filter: when a supplier is expanded, filter to that party
    let partyFilter: string | null = null;

    if (expandedSupplier && selectedAcct && selectedCat) {
      // Zoomed into specific supplier within an account
      relevantAccounts.add(selectedAcct.account);
      partyFilter = expandedSupplier.split(":").slice(1).join(":"); // extract party name from "account:party"
      chartTitle = partyFilter;
    } else if (selectedAcct && selectedCat) {
      // Zoomed into specific account
      relevantAccounts.add(selectedAcct.account);
      chartTitle = selectedAcct.account_name;
    } else if (selectedCat) {
      // Zoomed into category — all accounts in that category
      const acctMap = section.categoryMap.get(selectedCat);
      if (acctMap) for (const acct of acctMap.keys()) relevantAccounts.add(acct);
      chartTitle = translateCategory(selectedCat);
    } else {
      // No selection — all cost/credit accounts in this section
      for (const acctMap of section.categoryMap.values())
        for (const acct of acctMap.keys()) relevantAccounts.add(acct);
    }

    // Bucket all entries by year + period for grouped multi-year bar charts
    const grouped = new Map<string, Map<number, number>>();
    const allYears = new Set<number>();

    for (const entry of allGlEntries) {
      if (!relevantAccounts.has(entry.account)) continue;
      // Party filter: match on party, against, or voucher_no
      if (partyFilter) {
        const entryParty = entry.party || entry.against || entry.voucher_no || "";
        if (entryParty !== partyFilter) continue;
      }
      const net = isCredits ? entry.credit - entry.debit : entry.debit - entry.credit;
      if (net <= 0) continue;

      const d = new Date(entry.posting_date);
      const y = d.getFullYear();
      const m = d.getMonth();
      allYears.add(y);

      let period: string;
      if (dateFilter.mode === "year") {
        period = "year"; // single group
      } else if (dateFilter.mode === "quarter") {
        period = `Q${Math.floor(m / 3) + 1}`;
      } else {
        period = t(monthNameKeys[m]).slice(0, 3);
      }

      if (!grouped.has(period)) grouped.set(period, new Map());
      const yearMap = grouped.get(period)!;
      yearMap.set(y, (yearMap.get(y) || 0) + net);
    }

    const sortedYears = [...allYears].sort((a, b) => a - b);

    // For year mode: simple bars, one per year (no grouped sub-bars)
    if (dateFilter.mode === "year") {
      return {
        barData: sortedYears.map((y) => grouped.get("year")?.get(y) || 0),
        barPrevData: [],
        barLabels: sortedYears.map((y) => String(y)),
        barTitle: chartTitle,
        barGrouped: undefined,
      };
    }

    // Quarter/month: periods as groups, years as bars within each group
    const periods = dateFilter.mode === "quarter"
      ? ["Q1", "Q2", "Q3", "Q4"]
      : Array.from({ length: 12 }, (_, i) => t(monthNameKeys[i]).slice(0, 3));

    // Build grouped data: for each period, array of values per year
    const groupedData: number[][] = periods.map((p) => {
      const yearMap = grouped.get(p);
      return sortedYears.map((y) => yearMap?.get(y) || 0);
    });

    return {
      barData: [], // not used in grouped mode
      barPrevData: [],
      barLabels: periods,
      barTitle: chartTitle,
      barGrouped: { years: sortedYears, periods, data: groupedData },
    };
  }, [section, selectedCat, selectedAcct, expandedSupplier, isCredits, glEntries, prevGlEntries, allGlEntries, dateFilter, compareTarget, year, t]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-slate-700">{section.label}</h3>
          <span className="text-sm font-semibold text-slate-500">{euro(totalValue)}</span>
        </div>
      </div>

      {/* Sunburst + tree */}
      <div className="flex flex-col sm:flex-row gap-6 items-start">
        <div className="w-[280px] h-[280px] flex-shrink-0 flex items-center justify-center">
          <SunburstDonut
            rings={rings}
            size={280}
            centerLabel={section.label}
            centerValue={euro(totalValue)}
            expandedSlice={selectedAcct ? expandedAcctSlice : expandedCatSlice}
          />
        </div>

        <CostTree
          categorySegments={categorySegments}
          filteredCategoryMap={filteredCategoryMap}
          accountMap={accountMap}
          selectedCat={selectedCat}
          selectedAcct={selectedAcct}
          expandedSupplier={expandedSupplier}
          onSelectCat={(key) => {
            setSelectedCat(key);
            if (!key) setSelectedAcct(null);
          }}
          onSelectAcct={setSelectedAcct}
          onToggleSupplier={(key) => setExpandedSupplier((prev) => prev === key || key === "" ? null : key)}
          netValue={netValue}
          erpNextUrl={erpNextUrl}
          prevCategoryTotal={prevCategoryTotal}
          prevAccountTotal={prevAccountTotal}
          isCredits={isCredits}
          year={year}
          compareLabelText={compareLabel(dateFilter.mode, compareTarget, t)}
        />
      </div>

      {/* Bar chart — filtered by tree/donut selection */}
      <div className="mt-6">
        <BarTrendChart
          data={barData}
          prevData={barPrevData}
          labels={barLabels}
          color={isCredits ? "#14b8a6" : "#f43f5e"}
          title={barTitle}
          compareLabelText={compareLabel(dateFilter.mode, compareTarget, t)}
          grouped={barGrouped}
          onBarClick={onNavigatePeriod}
        />
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function CostInsight() {
  const { t } = useTranslation();
  const [company, setCompany] = useState(getActiveCompany());
  const [year, setYear] = useState(currentYear);
  const [allGlEntries, setAllGlEntries] = useState<GLEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Global date filter — shared between sections and trend charts
  const [dateFilter, setDateFilter] = useState<DateFilter>({ mode: "year", quarter: 1, month: 0 });

  // Compare target — auto-set to 1 period earlier
  const [compareTarget, setCompareTarget] = useState<CompareTarget>({
    year: currentYear - 1, quarter: 1, month: 0,
  });

  // Auto-update compareTarget when dateFilter or year changes: always compare to 1 period earlier
  useEffect(() => {
    if (dateFilter.mode === "year") {
      setCompareTarget({ year: year - 1, quarter: 1, month: 0 });
    } else if (dateFilter.mode === "quarter") {
      if (dateFilter.quarter === 1) {
        setCompareTarget({ year: year - 1, quarter: 4, month: 0 });
      } else {
        setCompareTarget({ year, quarter: dateFilter.quarter - 1, month: 0 });
      }
    } else {
      // month
      if (dateFilter.month === 0) {
        setCompareTarget({ year: year - 1, quarter: 1, month: 11 });
      } else {
        setCompareTarget({ year, quarter: 1, month: dateFilter.month - 1 });
      }
    }
  }, [dateFilter.mode, dateFilter.quarter, dateFilter.month, year]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const glFields: string[] = ["account", "debit", "credit", "posting_date", "voucher_no", "voucher_type", "party", "party_type", "against"];

      // Single query: fetch all GL entries from earliest year to current year
      const allGlFilters: unknown[][] = [
        ["is_cancelled", "=", 0],
        ["posting_date", ">=", `${years[0]}-01-01`],
        ["posting_date", "<=", `${years[years.length - 1]}-12-31`],
      ];
      if (company) allGlFilters.push(["company", "=", company]);

      const acctFilters: unknown[][] = [["is_group", "=", 0]];
      if (company) acctFilters.push(["company", "=", company]);

      const [allEntries, accts] = await Promise.all([
        fetchAll<GLEntry>("GL Entry", glFields, allGlFilters, "posting_date asc"),
        fetchAll<Account>(
          "Account",
          ["name", "account_name", "root_type", "parent_account", "is_group"],
          acctFilters
        ),
      ]);
      setAllGlEntries(allEntries);
      setAccounts(accts);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.unknown_error"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [company]);

  // Derive current/prev year entries from allGlEntries (avoids extra API calls)
  const glEntries = useMemo(() =>
    allGlEntries.filter((e) => e.posting_date >= `${year}-01-01` && e.posting_date <= `${year}-12-31`),
    [allGlEntries, year]
  );
  const prevGlEntries = useMemo(() =>
    allGlEntries.filter((e) => e.posting_date >= `${compareTarget.year}-01-01` && e.posting_date <= `${compareTarget.year}-12-31`),
    [allGlEntries, compareTarget.year]
  );

  const accountMap = useMemo(() => {
    const map = new Map<string, Account>();
    for (const a of accounts) map.set(a.name, a);
    return map;
  }, [accounts]);

  // Cost account set: exclude Income, VAT/BTW, year-catchup, and balance-sheet parents
  const costAccountSet = useMemo(() => {
    const set = new Set<string>();
    for (const a of accounts) {
      if (a.root_type === "Income") continue;
      const lowerName = a.account_name.toLowerCase();
      if (lowerName.includes("vat") || lowerName.includes("btw")) continue;
      if (/^20\d{2}\s/.test(a.account_name)) continue;
      // Exclude balance sheet parent categories
      const parentStripped = stripSuffix(a.parent_account || "").toLowerCase();
      if (EXCLUDED_PARENTS.has(parentStripped)) continue;
      // Also check the account name itself for these categories
      if (EXCLUDED_PARENTS.has(lowerName)) continue;
      set.add(a.name);
    }
    return set;
  }, [accounts]);

  const incomeAccountSet = useMemo(() => {
    const set = new Set<string>();
    for (const a of accounts) {
      if (a.root_type === "Income") set.add(a.name);
    }
    return set;
  }, [accounts]);

  // Split GL entries into costs (net debit > 0) and credits (net credit > 0, incl. income)
  const costSections = useMemo((): CostSection[] => {
    const costsMap = new Map<string, Map<string, GLEntry[]>>();
    const creditsMap = new Map<string, Map<string, GLEntry[]>>();

    for (const entry of glEntries) {
      const isIncome = incomeAccountSet.has(entry.account);
      if (!isIncome && !costAccountSet.has(entry.account)) continue;
      const acct = accountMap.get(entry.account);
      if (!acct) continue;

      const net = entry.debit - entry.credit;
      if (net === 0) continue;

      const category = stripSuffix(acct.parent_account || t("modules.section.other"));
      // Income accounts always go to credits; cost accounts split by sign
      const target = isIncome ? creditsMap : (net > 0 ? costsMap : creditsMap);

      if (!target.has(category)) target.set(category, new Map());
      const acctMap = target.get(category)!;
      if (!acctMap.has(entry.account)) acctMap.set(entry.account, []);
      acctMap.get(entry.account)!.push(entry);
    }

    function sectionTotal(map: Map<string, Map<string, GLEntry[]>>): number {
      let total = 0;
      for (const acctMap of map.values())
        for (const entries of acctMap.values())
          for (const e of entries) total += Math.abs(e.debit - e.credit);
      return total;
    }

    const result: CostSection[] = [];
    if (costsMap.size > 0)
      result.push({ kind: "costs", label: t("kosteninzicht.section_costs"), total: sectionTotal(costsMap), categoryMap: costsMap });
    if (creditsMap.size > 0)
      result.push({ kind: "credits", label: t("kosteninzicht.section_credits"), total: sectionTotal(creditsMap), categoryMap: creditsMap });
    return result;
  }, [glEntries, costAccountSet, incomeAccountSet, accountMap, t]);

  // Previous year cost sections (same logic, different entries)
  const prevCostSections = useMemo((): CostSection[] => {
    const costsMap = new Map<string, Map<string, GLEntry[]>>();
    const creditsMap = new Map<string, Map<string, GLEntry[]>>();

    for (const entry of prevGlEntries) {
      const isIncome = incomeAccountSet.has(entry.account);
      if (!isIncome && !costAccountSet.has(entry.account)) continue;
      const acct = accountMap.get(entry.account);
      if (!acct) continue;
      const net = entry.debit - entry.credit;
      if (net === 0) continue;
      const category = stripSuffix(acct.parent_account || t("modules.section.other"));
      const target = isIncome ? creditsMap : (net > 0 ? costsMap : creditsMap);
      if (!target.has(category)) target.set(category, new Map());
      const acctMap = target.get(category)!;
      if (!acctMap.has(entry.account)) acctMap.set(entry.account, []);
      acctMap.get(entry.account)!.push(entry);
    }

    function sectionTotal(map: Map<string, Map<string, GLEntry[]>>): number {
      let total = 0;
      for (const acctMap of map.values())
        for (const entries of acctMap.values())
          for (const e of entries) total += Math.abs(e.debit - e.credit);
      return total;
    }

    const result: CostSection[] = [];
    if (costsMap.size > 0)
      result.push({ kind: "costs", label: t("kosteninzicht.section_costs"), total: sectionTotal(costsMap), categoryMap: costsMap });
    if (creditsMap.size > 0)
      result.push({ kind: "credits", label: t("kosteninzicht.section_credits"), total: sectionTotal(creditsMap), categoryMap: creditsMap });
    return result;
  }, [prevGlEntries, costAccountSet, incomeAccountSet, accountMap, t]);

  // Filtered totals: respect current dateFilter for "current", compareTarget for "previous"
  const totalCosts = useMemo(() => {
    const costsSection = costSections.find((s) => s.kind === "costs");
    if (!costsSection) return 0;
    let sum = 0;
    for (const acctMap of costsSection.categoryMap.values())
      for (const entries of acctMap.values())
        for (const e of entries) {
          if (dateFilter.mode !== "year" && !matchesDateFilter(e.posting_date, dateFilter)) continue;
          sum += e.debit - e.credit;
        }
    return sum;
  }, [costSections, dateFilter]);

  const prevTotalCosts = useMemo(() => {
    const costsSection = prevCostSections.find((s) => s.kind === "costs");
    if (!costsSection) return 0;
    const prevFilter: DateFilter = { mode: dateFilter.mode, quarter: compareTarget.quarter, month: compareTarget.month };
    let sum = 0;
    for (const acctMap of costsSection.categoryMap.values())
      for (const entries of acctMap.values())
        for (const e of entries) {
          if (dateFilter.mode !== "year" && !matchesDateFilter(e.posting_date, prevFilter)) continue;
          sum += e.debit - e.credit;
        }
    return sum;
  }, [prevCostSections, dateFilter, compareTarget]);

  const visibleMonthCount = dateFilter.mode === "year" ? 12 : dateFilter.mode === "quarter" ? 3 : 1;
  const avgPerMonth = totalCosts / visibleMonthCount;
  const prevAvgPerMonth = prevTotalCosts / visibleMonthCount;

  const largestCategory = useMemo(() => {
    const costsSection = costSections.find((s) => s.kind === "costs");
    if (!costsSection) return null;
    const catTotals = new Map<string, number>();
    for (const [cat, acctMap] of costsSection.categoryMap) {
      let sum = 0;
      for (const entries of acctMap.values()) for (const e of entries) sum += e.debit - e.credit;
      if (sum > 0) catTotals.set(cat, sum);
    }
    let best: { category: string; total: number } | null = null;
    for (const [cat, total] of catTotals) {
      if (!best || total > best.total) best = { category: cat, total };
    }
    return best;
  }, [costSections]);

  const prevLargestCategory = useMemo(() => {
    const costsSection = prevCostSections.find((s) => s.kind === "costs");
    if (!costsSection) return null;
    const catTotals = new Map<string, number>();
    for (const [cat, acctMap] of costsSection.categoryMap) {
      let sum = 0;
      for (const entries of acctMap.values()) for (const e of entries) sum += e.debit - e.credit;
      if (sum > 0) catTotals.set(cat, sum);
    }
    // Find the same category as current largest
    if (largestCategory) {
      return catTotals.get(largestCategory.category) ?? 0;
    }
    return 0;
  }, [prevCostSections, largestCategory]);





  // Monthly breakdown table (top 6 categories, all months)
  const { monthlyData, topCategories } = useMemo(() => {
    const costsSection = costSections.find((s) => s.kind === "costs");
    const catTotals = new Map<string, number>();
    if (costsSection) {
      for (const [cat, acctMap] of costsSection.categoryMap) {
        let sum = 0;
        for (const entries of acctMap.values()) for (const e of entries) sum += e.debit - e.credit;
        if (sum > 0) catTotals.set(cat, sum);
      }
    }
    const top = [...catTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([category, total]) => ({ category, total }));
    const topCatNames = new Set(top.map((c) => c.category));

    const acctToCategory = new Map<string, string>();
    for (const a of accounts) {
      if (costAccountSet.has(a.name)) {
        acctToCategory.set(a.name, stripSuffix(a.parent_account || t("modules.section.other")));
      }
    }

    const monthly: Record<number, Record<string, number>> = {};
    for (let m = 0; m < 12; m++) {
      monthly[m] = { _totaal: 0 };
      for (const cat of topCatNames) monthly[m][cat] = 0;
    }

    for (const entry of glEntries) {
      if (!costAccountSet.has(entry.account)) continue;
      const category = acctToCategory.get(entry.account);
      if (!category) continue;
      const m = new Date(entry.posting_date).getMonth();
      const net = entry.debit - entry.credit;
      if (topCatNames.has(category)) monthly[m][category] = (monthly[m][category] ?? 0) + net;
      monthly[m]["_totaal"] = (monthly[m]["_totaal"] ?? 0) + net;
    }

    return { monthlyData: monthly, topCategories: top };
  }, [costSections, glEntries, accounts, costAccountSet, t]);

  const erpNextUrl = getErpNextLinkUrl();

  return (
    <div className="p-3 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <PieChart className="text-purple-600" size={24} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">{t("kosteninzicht.title")}</h2>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`${erpNextUrl}/general-ledger?company=${encodeURIComponent(company)}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <ExternalLink size={14} /> ERPNext
          </a>
          <button
            onClick={loadData} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-y-teal text-white rounded-lg hover:bg-y-teal-dark disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> {t("common.refresh")}
          </button>
        </div>
      </div>

      {/* Filters: company, year, date filter */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <CompanySelect value={company} onChange={setCompany} />
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        {/* Date filter: mode buttons + dropdown */}
        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={() => {
              setDateFilter({ ...dateFilter, mode: "year" });
              setCompareTarget((prev) => ({ ...prev, year: year - 1 }));
            }}
            className={`px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
              dateFilter.mode === "year" ? "bg-y-teal text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {t("kosteninzicht.filter_year")}
          </button>
          <button
            onClick={() => {
              setDateFilter({ ...dateFilter, mode: "quarter" });
              setCompareTarget({ year: year - 1, quarter: dateFilter.quarter, month: dateFilter.month });
            }}
            className={`px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
              dateFilter.mode === "quarter" ? "bg-y-teal text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {t("kosteninzicht.filter_quarter")}
          </button>
          <button
            onClick={() => {
              setDateFilter({ ...dateFilter, mode: "month" });
              setCompareTarget({ year: year - 1, quarter: dateFilter.quarter, month: dateFilter.month });
            }}
            className={`px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
              dateFilter.mode === "month" ? "bg-y-teal text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {t("kosteninzicht.filter_month")}
          </button>
          {dateFilter.mode === "quarter" && (
            <select
              value={dateFilter.quarter}
              onChange={(e) => setDateFilter({ ...dateFilter, quarter: Number(e.target.value) })}
              className="ml-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
            >
              <option value={1}>Q1</option>
              <option value={2}>Q2</option>
              <option value={3}>Q3</option>
              <option value={4}>Q4</option>
            </select>
          )}
          {dateFilter.mode === "month" && (
            <select
              value={dateFilter.month}
              onChange={(e) => setDateFilter({ ...dateFilter, month: Number(e.target.value) })}
              className="ml-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
            >
              {monthNameKeys.map((key, i) => (
                <option key={i} value={i}>{t(key)}</option>
              ))}
            </select>
          )}
        </div>

        {/* Compare target selector */}
        <div className="flex items-center gap-1 ml-4 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
          <span className="text-xs text-slate-400 mr-1">vs</span>
          <button
            onClick={() => {
              setCompareTarget((prev) => {
                if (dateFilter.mode === "year") return { ...prev, year: prev.year - 1 };
                if (dateFilter.mode === "quarter") {
                  if (prev.quarter <= 1) return { ...prev, year: prev.year - 1, quarter: 4 };
                  return { ...prev, quarter: prev.quarter - 1 };
                }
                // month
                if (prev.month <= 0) return { ...prev, year: prev.year - 1, month: 11 };
                return { ...prev, month: prev.month - 1 };
              });
            }}
            className="p-1 rounded hover:bg-slate-200 cursor-pointer text-slate-500"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-sm font-medium text-slate-600 min-w-[80px] text-center">
            {compareLabel(dateFilter.mode, compareTarget, t)}
          </span>
          <button
            onClick={() => {
              setCompareTarget((prev) => {
                if (dateFilter.mode === "year") return { ...prev, year: prev.year + 1 };
                if (dateFilter.mode === "quarter") {
                  if (prev.quarter >= 4) return { ...prev, year: prev.year + 1, quarter: 1 };
                  return { ...prev, quarter: prev.quarter + 1 };
                }
                // month
                if (prev.month >= 11) return { ...prev, year: prev.year + 1, month: 0 };
                return { ...prev, month: prev.month + 1 };
              });
            }}
            className="p-1 rounded hover:bg-slate-200 cursor-pointer text-slate-500"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-red-100 rounded-lg">
              <TrendingUp className="text-red-600" size={20} />
            </div>
            <p className="text-sm text-slate-500">{t("kosteninzicht.total_costs")}</p>
          </div>
          <p className="text-2xl font-bold text-slate-800">{loading ? "..." : euro(totalCosts)}</p>
          {!loading && prevTotalCosts > 0 && (
            <div className="mt-1 flex items-center gap-2">
              <TrendBadge current={totalCosts} previous={prevTotalCosts} />
              <span className="text-xs text-slate-400">vs {compareLabel(dateFilter.mode, compareTarget, t)} ({euro(prevTotalCosts)})</span>
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-y-teal/10 rounded-lg">
              <Calendar className="text-y-teal" size={20} />
            </div>
            <p className="text-sm text-slate-500">{t("kosteninzicht.avg_per_month")}</p>
          </div>
          <p className="text-2xl font-bold text-slate-800">{loading ? "..." : euro(avgPerMonth)}</p>
          {!loading && prevAvgPerMonth > 0 && (
            <div className="mt-1 flex items-center gap-2">
              <TrendBadge current={avgPerMonth} previous={prevAvgPerMonth} />
              <span className="text-xs text-slate-400">vs {compareLabel(dateFilter.mode, compareTarget, t)}</span>
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <BarChart3 className="text-purple-600" size={20} />
            </div>
            <p className="text-sm text-slate-500">{t("kosteninzicht.largest_category")}</p>
          </div>
          <p className="text-lg font-bold text-slate-800">
            {loading ? "..." : largestCategory ? translateCategory(largestCategory.category) : "—"}
          </p>
          {!loading && largestCategory && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">{euro(largestCategory.total)}</span>
              {prevLargestCategory != null && prevLargestCategory > 0 && (
                <TrendBadge current={largestCategory.total} previous={prevLargestCategory} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Cost sections */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 mb-6 flex items-center justify-center text-slate-400">
          {t("common.loading")}
        </div>
      ) : costSections.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 mb-6 flex items-center justify-center text-slate-400">
          {t("kosteninzicht.no_sections")}
        </div>
      ) : (
        costSections.map((section) => (
          <CostSectionPanel
            key={section.kind}
            section={section}
            prevSection={prevCostSections.find((s) => s.kind === section.kind)}
            accountMap={accountMap}
            erpNextUrl={erpNextUrl}
            dateFilter={dateFilter}
            compareTarget={compareTarget}
            year={year}
            glEntries={glEntries}
            prevGlEntries={prevGlEntries}
            allGlEntries={allGlEntries}
            onNavigatePeriod={(label, clickedYear) => {
              if (dateFilter.mode === "year") {
                // Clicked a year bar → switch to that year
                const y = Number(label);
                if (y && !isNaN(y)) setYear(y);
              } else if (dateFilter.mode === "quarter") {
                // Clicked a quarter bar → switch to that quarter (and year if provided)
                const qMatch = label.match(/Q(\d)/);
                if (qMatch) setDateFilter((prev) => ({ ...prev, quarter: Number(qMatch[1]) }));
                if (clickedYear) setYear(clickedYear);
              } else {
                // Clicked a month bar → find month index from translated label
                const monthLabels = monthNameKeys.map((k) => t(k).slice(0, 3));
                const mIdx = monthLabels.indexOf(label);
                if (mIdx >= 0) setDateFilter((prev) => ({ ...prev, month: mIdx }));
                if (clickedYear) setYear(clickedYear);
              }
            }}
          />
        ))
      )}

      {/* Monthly Breakdown Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="text-lg font-semibold text-slate-700">{t("kosteninzicht.monthly_overview")}</h3>
        </div>
        {loading ? (
          <div className="h-48 flex items-center justify-center text-slate-400">{t("common.loading")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 sticky left-0 bg-white">
                    {t("kosteninzicht.col_month")}
                  </th>
                  {topCategories.map((cat, idx) => (
                    <th key={cat.category} className="text-right px-4 py-3 text-xs font-semibold text-slate-600 whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: colorForIndex(idx) }} />
                        <span>{translateCategory(cat.category)}</span>
                      </div>
                    </th>
                  ))}
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-800 whitespace-nowrap">
                    {t("financial.total")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 12 }, (_, m) => {
                  const row = monthlyData[m];
                  return (
                    <tr key={m} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2.5 text-sm font-medium text-slate-700 sticky left-0 bg-white">
                        {t(monthNameKeys[m])}
                      </td>
                      {topCategories.map((cat) => (
                        <td key={cat.category} className="px-4 py-2.5 text-sm text-slate-600 text-right whitespace-nowrap">
                          {euro(row[cat.category] || 0)}
                        </td>
                      ))}
                      <td className="px-4 py-2.5 text-sm font-semibold text-slate-800 text-right whitespace-nowrap">
                        {euro(row["_totaal"] || 0)}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-slate-50 font-semibold border-t-2 border-slate-300">
                  <td className="px-4 py-3 text-sm text-slate-800 sticky left-0 bg-slate-50">
                    {t("financial.total")}
                  </td>
                  {topCategories.map((cat) => {
                    const colTotal = Object.values(monthlyData).reduce((s, row) => s + (row[cat.category] || 0), 0);
                    return (
                      <td key={cat.category} className="px-4 py-3 text-sm text-slate-800 text-right whitespace-nowrap">
                        {euro(colTotal)}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-sm text-slate-800 text-right whitespace-nowrap">
                    {euro(totalCosts)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
