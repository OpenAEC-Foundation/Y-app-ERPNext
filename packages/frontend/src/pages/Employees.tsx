import { useEffect, useState, useMemo, useRef } from "react";
import { fetchList, getErpNextLinkUrl } from "../lib/erpnext";
import { fetchShiftHoursMap } from "../lib/shiftHours";
import { Users, RefreshCw, Search, Filter, Cake, CalendarClock, FileWarning, Clock, Palmtree, Thermometer, UserPlus, X, Plus, Check, Printer, Trash2, Tag, ListChecks, FileText, CreditCard, Info } from "lucide-react";
import CompanySelect from "../components/CompanySelect";
import InfoOverlay from "../components/InfoOverlay";
import { useTranslation } from "react-i18next";
import { getActiveCompany } from "../lib/instances";

interface Employee {
  name: string;
  employee_name: string;
  designation: string;
  department: string;
  status: string;
  company: string;
  date_of_joining: string;
  date_of_birth: string;
  contract_end_date: string;
  cell_phone: string;
  personal_email: string;
  company_email: string;
  image: string;
}

interface LeaveAllocation {
  employee: string;
  leave_type: string;
  total_leaves_allocated: number;
}

interface LeaveApplication {
  employee: string;
  leave_type: string;
  total_leave_days: number;
  status: string;
}

interface LeaveSummary {
  vakantieAllocated: number;
  vakantieUsed: number;
  ziekteDagen: number;
}

const statusColors: Record<string, string> = {
  Active: "bg-green-100 text-green-700",
  Inactive: "bg-slate-100 text-slate-600",
  Suspended: "bg-orange-100 text-orange-700",
  Left: "bg-red-100 text-red-700",
};

const MONTH_KEYS_LOWER = [
  "employees.month_january_lower", "employees.month_february_lower", "employees.month_march_lower",
  "employees.month_april_lower", "employees.month_may_lower", "employees.month_june_lower",
  "employees.month_july_lower", "employees.month_august_lower", "employees.month_september_lower",
  "employees.month_october_lower", "employees.month_november_lower", "employees.month_december_lower",
];

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function getColor(name: string): string {
  const colors = [
    "bg-y-teal", "bg-green-500", "bg-purple-500", "bg-pink-500",
    "bg-indigo-500", "bg-teal-500", "bg-orange-500", "bg-cyan-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

/** Format date as "15 maart" */
function formatDutchDate(dateStr: string, t: (key: string) => string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `${d.getDate()} ${t(MONTH_KEYS_LOWER[d.getMonth()])}`;
}

/** Days until next occurrence of a month/day anniversary from today */
function daysUntilAnniversary(dateStr: string): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thisYear = today.getFullYear();

  let next = new Date(thisYear, d.getMonth(), d.getDate());
  next.setHours(0, 0, 0, 0);
  if (next < today) {
    next = new Date(thisYear + 1, d.getMonth(), d.getDate());
    next.setHours(0, 0, 0, 0);
  }
  return Math.round((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/** Calculate years of service */
function yearsOfService(dateOfJoining: string): number {
  if (!dateOfJoining) return 0;
  const join = new Date(dateOfJoining);
  const today = new Date();
  let years = today.getFullYear() - join.getFullYear();
  const monthDiff = today.getMonth() - join.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < join.getDate())) {
    years--;
  }
  return Math.max(0, years);
}

/** Days until a specific date (negative = past) */
function daysUntilDate(dateStr: string): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/** Get urgency class for upcoming dates */
function urgencyClass(days: number | null): string {
  if (days === null) return "";
  if (days < 0) return "text-red-600 font-semibold";
  if (days < 14) return "text-red-600 font-semibold";
  if (days < 30) return "text-amber-600 font-semibold";
  return "";
}

/** Get urgency badge for days remaining */
function urgencyBadge(days: number | null): string {
  if (days === null) return "";
  if (days < 0) return "bg-red-100 text-red-700";
  if (days < 14) return "bg-red-100 text-red-700";
  if (days < 30) return "bg-amber-100 text-amber-700";
  return "";
}

// ── localStorage helpers (exported for external use) ──

const ACTIVITY_TYPES_KEY = "erpnext_employee_activity_types";
const CONTRACT_HOURS_KEY = "erpnext_employee_contract_hours";

export function getEmployeeActivityTypes(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(ACTIVITY_TYPES_KEY) || "{}");
  } catch {
    return {};
  }
}


export function getEmployeeContractHours(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(CONTRACT_HOURS_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveContractHours(data: Record<string, number>) {
  localStorage.setItem(CONTRACT_HOURS_KEY, JSON.stringify(data));
}

// ── Onboarding types & helpers ──

interface OnboardingStep {
  id: string;
  label: string;
  done: boolean;
  completedDate: string | null;
  custom?: boolean;
}

const DEFAULT_ONBOARDING_STEPS: Omit<OnboardingStep, "id">[] = [
  { label: "employees.onboarding_email_account", done: false, completedDate: null },
  { label: "employees.onboarding_erpnext_account", done: false, completedDate: null },
  { label: "employees.onboarding_nextcloud_account", done: false, completedDate: null },
  { label: "employees.onboarding_laptop", done: false, completedDate: null },
  { label: "employees.onboarding_team_intro", done: false, completedDate: null },
  { label: "employees.onboarding_contract_signed", done: false, completedDate: null },
  { label: "employees.onboarding_bank_details", done: false, completedDate: null },
];

function getOnboardingSteps(employeeId: string): OnboardingStep[] {
  try {
    const raw = localStorage.getItem(`onboarding_${employeeId}`);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return DEFAULT_ONBOARDING_STEPS.map((s, i) => ({ ...s, id: `step_${i}` }));
}

function saveOnboardingSteps(employeeId: string, steps: OnboardingStep[]) {
  localStorage.setItem(`onboarding_${employeeId}`, JSON.stringify(steps));
}

// ── Employee profile (functieomschrijving) types & helpers ──

interface EmployeeProfile {
  skills: string[];
  responsibilities: string[];
  tasks: string[];
  notes: string;
}

function getEmployeeProfile(employeeId: string): EmployeeProfile {
  try {
    const raw = localStorage.getItem(`employee_profile_${employeeId}`);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { skills: [], responsibilities: [], tasks: [], notes: "" };
}

function saveEmployeeProfile(employeeId: string, profile: EmployeeProfile) {
  localStorage.setItem(`employee_profile_${employeeId}`, JSON.stringify(profile));
}

// ── Employee Detail Modal ──

type DetailTab = "onboarding" | "functie" | "visitekaartje";

function EmployeeDetailModal({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<DetailTab>("onboarding");
  const [steps, setSteps] = useState<OnboardingStep[]>(() => getOnboardingSteps(employee.name));
  const [profile, setProfile] = useState<EmployeeProfile>(() => getEmployeeProfile(employee.name));
  const [newStepLabel, setNewStepLabel] = useState("");
  const [newSkill, setNewSkill] = useState("");
  const [newResp, setNewResp] = useState("");
  const [newTask, setNewTask] = useState("");
  const printRef = useRef<HTMLDivElement>(null);

  // Save onboarding whenever steps change
  useEffect(() => { saveOnboardingSteps(employee.name, steps); }, [steps, employee.name]);
  // Save profile whenever it changes
  useEffect(() => { saveEmployeeProfile(employee.name, profile); }, [profile, employee.name]);

  const completedCount = steps.filter((s) => s.done).length;
  const progressPct = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;

  function toggleStep(id: string) {
    setSteps((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, done: !s.done, completedDate: !s.done ? new Date().toISOString().slice(0, 10) : null }
          : s
      )
    );
  }

  function addCustomStep() {
    if (!newStepLabel.trim()) return;
    setSteps((prev) => [...prev, { id: `custom_${Date.now()}`, label: newStepLabel.trim(), done: false, completedDate: null, custom: true }]);
    setNewStepLabel("");
  }

  function removeStep(id: string) {
    setSteps((prev) => prev.filter((s) => s.id !== id));
  }

  function addSkill() {
    if (!newSkill.trim() || profile.skills.includes(newSkill.trim())) return;
    setProfile((p) => ({ ...p, skills: [...p.skills, newSkill.trim()] }));
    setNewSkill("");
  }

  function removeSkill(skill: string) {
    setProfile((p) => ({ ...p, skills: p.skills.filter((s) => s !== skill) }));
  }

  function addListItem(field: "responsibilities" | "tasks", value: string, setter: (v: string) => void) {
    if (!value.trim()) return;
    setProfile((p) => ({ ...p, [field]: [...p[field], value.trim()] }));
    setter("");
  }

  function removeListItem(field: "responsibilities" | "tasks", idx: number) {
    setProfile((p) => ({ ...p, [field]: p[field].filter((_, i) => i !== idx) }));
  }

  function handlePrint() {
    if (!printRef.current) return;
    const w = window.open("", "_blank", "width=450,height=300");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>${t("employees.business_card")}</title><style>
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f1f5f9; }
      .card { width: 90mm; height: 50mm; background: white; border-radius: 8px; padding: 16px 20px; box-sizing: border-box; box-shadow: 0 1px 3px rgba(0,0,0,.1); display: flex; flex-direction: column; justify-content: center; }
      .name { font-size: 16px; font-weight: 700; color: #0d9488; margin-bottom: 2px; }
      .title { font-size: 11px; color: #64748b; margin-bottom: 8px; }
      .company { font-size: 10px; color: #94a3b8; margin-bottom: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; }
      .info { font-size: 10px; color: #334155; line-height: 1.6; }
      .bar { width: 40px; height: 3px; background: #0d9488; border-radius: 2px; margin-bottom: 8px; }
      @media print { body { background: white; } .card { box-shadow: none; } }
    </style></head><body>
      <div class="card">
        <div class="bar"></div>
        <div class="name">${employee.employee_name}</div>
        <div class="title">${employee.designation || ""}</div>
        <div class="company">${employee.company || ""}</div>
        <div class="info">
          ${employee.company_email ? employee.company_email + "<br>" : ""}
          ${employee.cell_phone || ""}
        </div>
      </div>
    </body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); }, 300);
  }

  const tabs: { key: DetailTab; labelKey: string; icon: typeof ListChecks }[] = [
    { key: "onboarding", labelKey: "employees.tab_onboarding", icon: ListChecks },
    { key: "functie", labelKey: "employees.tab_functie", icon: FileText },
    { key: "visitekaartje", labelKey: "employees.tab_visitekaartje", icon: CreditCard },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-4 p-5 border-b border-slate-200">
          <div className={`w-12 h-12 rounded-full ${getColor(employee.employee_name)} flex items-center justify-center text-white font-bold text-lg`}>
            {getInitials(employee.employee_name)}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-slate-800 truncate">{employee.employee_name}</h3>
            <p className="text-sm text-slate-500">{employee.designation || "-"} &middot; {employee.department || "-"}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg cursor-pointer"><X size={20} className="text-slate-400" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-5">
          {tabs.map((tabItem) => (
            <button key={tabItem.key} onClick={() => setTab(tabItem.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 cursor-pointer transition-colors ${
                tab === tabItem.key ? "border-y-teal text-y-teal" : "border-transparent text-slate-400 hover:text-slate-600"
              }`}>
              <tabItem.icon size={15} />
              {t(tabItem.labelKey)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* ── Onboarding tab ── */}
          {tab === "onboarding" && (
            <div>
              {/* Progress bar */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-600">{t("projects.detail.progress")}</span>
                  <span className="text-sm font-bold text-y-teal">{progressPct}%</span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-y-teal rounded-full transition-all duration-300" style={{ width: `${progressPct}%` }} />
                </div>
                <p className="text-xs text-slate-400 mt-1">{t("employees.steps_completed", { completed: completedCount, total: steps.length })}</p>
              </div>

              {/* Checklist */}
              <div className="space-y-2">
                {steps.map((step) => (
                  <div key={step.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    step.done ? "bg-green-50 border-green-200" : "bg-white border-slate-200"
                  }`}>
                    <button onClick={() => toggleStep(step.id)}
                      className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors ${
                        step.done ? "bg-green-500 text-white" : "border-2 border-slate-300 hover:border-y-teal"
                      }`}>
                      {step.done && <Check size={14} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm ${step.done ? "line-through text-slate-400" : "text-slate-700"}`}>{step.label.startsWith("employees.") ? t(step.label) : step.label}</span>
                      {step.completedDate && (
                        <span className="text-[10px] text-green-600 ml-2">{step.completedDate}</span>
                      )}
                    </div>
                    {step.custom && (
                      <button onClick={() => removeStep(step.id)} className="p-1 hover:bg-red-50 rounded cursor-pointer">
                        <Trash2 size={14} className="text-red-400" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add custom step */}
              <div className="mt-4 flex items-center gap-2">
                <input type="text" placeholder={t("employees.new_step_placeholder")} value={newStepLabel}
                  onChange={(e) => setNewStepLabel(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCustomStep()}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal" />
                <button onClick={addCustomStep}
                  className="px-3 py-2 bg-y-teal text-white rounded-lg hover:bg-y-teal-dark text-sm flex items-center gap-1 cursor-pointer">
                  <Plus size={14} /> {t("common.add")}
                </button>
              </div>
            </div>
          )}

          {/* ── Functieomschrijving tab ── */}
          {tab === "functie" && (
            <div className="space-y-6">
              {/* Skills */}
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5"><Tag size={14} /> {t("employees.skills")}</h4>
                <div className="flex flex-wrap gap-2 mb-2">
                  {profile.skills.map((skill) => (
                    <span key={skill} className="inline-flex items-center gap-1 px-2.5 py-1 bg-y-teal/10 text-y-teal text-xs font-medium rounded-full">
                      {skill}
                      <button onClick={() => removeSkill(skill)} className="hover:text-red-500 cursor-pointer"><X size={12} /></button>
                    </span>
                  ))}
                  {profile.skills.length === 0 && <span className="text-xs text-slate-400">{t("employees.no_skills")}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <input type="text" placeholder={t("employees.add_skill_placeholder")} value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addSkill()}
                    className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal" />
                  <button onClick={addSkill} className="px-2.5 py-1.5 bg-y-teal text-white rounded-lg text-xs cursor-pointer hover:bg-y-teal-dark">
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {/* Responsibilities */}
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2">{t("employees.responsibilities")}</h4>
                <ul className="space-y-1.5 mb-2">
                  {profile.responsibilities.map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-slate-700 bg-slate-50 px-3 py-2 rounded-lg">
                      <span className="flex-1">{item}</span>
                      <button onClick={() => removeListItem("responsibilities", i)} className="hover:text-red-500 cursor-pointer text-slate-400"><X size={14} /></button>
                    </li>
                  ))}
                  {profile.responsibilities.length === 0 && <li className="text-xs text-slate-400">{t("employees.no_responsibilities")}</li>}
                </ul>
                <div className="flex items-center gap-2">
                  <input type="text" placeholder={t("employees.add_responsibility_placeholder")} value={newResp}
                    onChange={(e) => setNewResp(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addListItem("responsibilities", newResp, setNewResp)}
                    className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal" />
                  <button onClick={() => addListItem("responsibilities", newResp, setNewResp)} className="px-2.5 py-1.5 bg-y-teal text-white rounded-lg text-xs cursor-pointer hover:bg-y-teal-dark">
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {/* Tasks */}
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2">{t("nav.tasks")}</h4>
                <ul className="space-y-1.5 mb-2">
                  {profile.tasks.map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-slate-700 bg-slate-50 px-3 py-2 rounded-lg">
                      <span className="flex-1">{item}</span>
                      <button onClick={() => removeListItem("tasks", i)} className="hover:text-red-500 cursor-pointer text-slate-400"><X size={14} /></button>
                    </li>
                  ))}
                  {profile.tasks.length === 0 && <li className="text-xs text-slate-400">{t("employees.no_tasks_added")}</li>}
                </ul>
                <div className="flex items-center gap-2">
                  <input type="text" placeholder={t("employees.add_task_placeholder")} value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addListItem("tasks", newTask, setNewTask)}
                    className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal" />
                  <button onClick={() => addListItem("tasks", newTask, setNewTask)} className="px-2.5 py-1.5 bg-y-teal text-white rounded-lg text-xs cursor-pointer hover:bg-y-teal-dark">
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2">{t("employees.notes")}</h4>
                <textarea
                  value={profile.notes}
                  onChange={(e) => setProfile((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Notities over deze medewerker..."
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal resize-y"
                />
              </div>
            </div>
          )}

          {/* ── Visitekaartje tab ── */}
          {tab === "visitekaartje" && (
            <div>
              <div ref={printRef} className="mx-auto" style={{ width: "340px", height: "190px" }}>
                <div className="w-full h-full bg-white border-2 border-slate-200 rounded-xl p-5 flex flex-col justify-center shadow-sm">
                  <div className="w-10 h-1 bg-y-teal rounded-full mb-3" />
                  <h3 className="text-lg font-bold text-y-teal">{employee.employee_name}</h3>
                  {employee.designation && <p className="text-xs text-slate-500 mb-1">{employee.designation}</p>}
                  {employee.company && <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-3">{employee.company}</p>}
                  <div className="text-xs text-slate-600 space-y-0.5">
                    {employee.company_email && <p>{employee.company_email}</p>}
                    {employee.cell_phone && <p>{employee.cell_phone}</p>}
                  </div>
                </div>
              </div>
              <div className="flex justify-center mt-4">
                <button onClick={handlePrint}
                  className="flex items-center gap-2 px-4 py-2 bg-y-teal text-white rounded-lg hover:bg-y-teal-dark text-sm cursor-pointer">
                  <Printer size={16} /> Afdrukken
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Employees() {
  const { t } = useTranslation();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const [statusFilter, setStatusFilter] = useState("Active");
  const [company, setCompany] = useState(getActiveCompany());
  const [contractHours, setContractHours] = useState<Record<string, number>>(getEmployeeContractHours());
  const [missingShiftEmployees, setMissingShiftEmployees] = useState<Set<string>>(new Set());
  const [leaveSummary, setLeaveSummary] = useState<Record<string, LeaveSummary>>({});
  const [overurenSaldo, setOverurenSaldo] = useState<Record<string, number>>({});
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const filters: unknown[][] = [];
      if (statusFilter) filters.push(["status", "=", statusFilter]);
      if (company) filters.push(["company", "=", company]);
      const list = await fetchList<Employee>("Employee", {
        fields: [
          "name", "employee_name", "designation", "department", "status",
          "company", "date_of_joining", "date_of_birth", "contract_end_date",
          "company_email", "image",
        ],
        filters,
        limit_page_length: 200,
        order_by: "employee_name asc",
      });
      setEmployees(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.unknown_error"));
    } finally {
      setLoading(false);
    }
  }

  // Load shift assignments and calculate contract hours (shared utility)
  async function loadContractHours() {
    try {
      const result = await fetchShiftHoursMap();
      setContractHours(result.hoursMap);
      saveContractHours(result.hoursMap);
      setMissingShiftEmployees(result.missingEmployees);
    } catch {
      // silently fail — not critical
    }
  }

  useEffect(() => { loadData(); }, [statusFilter, company]);
  async function loadLeaveData() {
    try {
      const year = new Date().getFullYear();
      const [allocs, apps] = await Promise.all([
        fetchList<LeaveAllocation>("Leave Allocation", {
          fields: ["employee", "leave_type", "total_leaves_allocated"],
          filters: [
            ["docstatus", "=", 1],
            ["from_date", "<=", `${year}-12-31`],
            ["to_date", ">=", `${year}-01-01`],
          ],
          limit_page_length: 500,
        }),
        fetchList<LeaveApplication>("Leave Application", {
          fields: ["employee", "leave_type", "total_leave_days", "status"],
          filters: [
            ["status", "in", ["Approved", "Open"]],
            ["from_date", "<=", `${year}-12-31`],
            ["to_date", ">=", `${year}-01-01`],
          ],
          limit_page_length: 500,
        }),
      ]);

      const summary: Record<string, LeaveSummary> = {};
      const isZiekte = (lt: string) => lt.toLowerCase().includes("ziekte");

      for (const a of allocs) {
        if (!summary[a.employee]) summary[a.employee] = { vakantieAllocated: 0, vakantieUsed: 0, ziekteDagen: 0 };
        if (!isZiekte(a.leave_type)) {
          summary[a.employee].vakantieAllocated += a.total_leaves_allocated;
        }
      }

      for (const app of apps) {
        if (!summary[app.employee]) summary[app.employee] = { vakantieAllocated: 0, vakantieUsed: 0, ziekteDagen: 0 };
        if (isZiekte(app.leave_type)) {
          summary[app.employee].ziekteDagen += app.total_leave_days;
        } else {
          summary[app.employee].vakantieUsed += app.total_leave_days;
        }
      }

      setLeaveSummary(summary);
    } catch {
      // silently fail
    }
  }

  async function loadOverurenData() {
    try {
      const year = new Date().getFullYear();
      const [tsList, appsList] = await Promise.all([
        fetchList<{ name: string; employee: string; start_date: string; total_hours: number }>("Timesheet", {
          fields: ["name", "employee", "start_date", "total_hours"],
          filters: [
            ["start_date", ">=", `${year}-01-01`],
            ["start_date", "<=", `${year}-12-31`],
            ["docstatus", "=", 1],
          ],
          limit_page_length: 0,
          order_by: "start_date asc",
        }),
        fetchList<{ employee: string; leave_type: string; from_date: string; to_date: string; total_leave_days: number; status: string }>("Leave Application", {
          fields: ["employee", "leave_type", "from_date", "to_date", "total_leave_days", "status"],
          filters: [
            ["status", "=", "Approved"],
            ["from_date", "<=", `${year}-12-31`],
            ["to_date", ">=", `${year}-01-01`],
          ],
          limit_page_length: 500,
        }),
      ]);

      const getISOWeek = (d: Date): number => {
        const tmp = new Date(d.getTime());
        tmp.setHours(0, 0, 0, 0);
        tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
        const w1 = new Date(tmp.getFullYear(), 0, 4);
        return 1 + Math.round(((tmp.getTime() - w1.getTime()) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7);
      };
      const now = new Date();
      const currentWeek = now.getFullYear() === year ? getISOWeek(now) : 53;
      const lastCompletedWeek = Math.max(0, currentWeek - 1);

      const empWeeks = new Map<string, Map<number, number>>();
      for (const ts of tsList) {
        if (!empWeeks.has(ts.employee)) empWeeks.set(ts.employee, new Map());
        const week = getISOWeek(new Date(ts.start_date));
        const m = empWeeks.get(ts.employee)!;
        m.set(week, (m.get(week) || 0) + ts.total_hours);
      }
      for (const la of appsList) {
        if (!empWeeks.has(la.employee)) empWeeks.set(la.employee, new Map());
        const dailyH = contractHours[la.employee] ? contractHours[la.employee] / 5 : 0;
        if (!dailyH) continue; // skip if no shift data
        const from = new Date(la.from_date);
        const to = new Date(la.to_date);
        const d = new Date(from);
        while (d <= to) {
          if (d.getDay() !== 0 && d.getDay() !== 6 && d.getFullYear() === year) {
            const week = getISOWeek(d);
            const m = empWeeks.get(la.employee)!;
            m.set(week, (m.get(week) || 0) + dailyH);
          }
          d.setDate(d.getDate() + 1);
        }
      }

      const saldo: Record<string, number> = {};
      for (const [empId, weeks] of empWeeks) {
        const weeklyHours = contractHours[empId];
        // Skip employees without shift data — no reliable fallback
        if (!weeklyHours || missingShiftEmployees.has(empId)) continue;
        let s = 0;
        for (const [w, total] of weeks) {
          if (w <= lastCompletedWeek && total > 0) {
            s += total - weeklyHours;
          }
        }
        saldo[empId] = Math.round(s * 10) / 10;
      }
      setOverurenSaldo(saldo);
    } catch {
      // silently fail
    }
  }

  useEffect(() => { loadContractHours(); loadLeaveData(); loadOverurenData(); }, []);


  const filtered = useMemo(() => {
    if (!search.trim()) return employees;
    const q = search.toLowerCase();
    return employees.filter(
      (e) =>
        e.employee_name?.toLowerCase().includes(q) ||
        e.designation?.toLowerCase().includes(q) ||
        e.department?.toLowerCase().includes(q) ||
        e.name.toLowerCase().includes(q)
    );
  }, [employees, search]);

  const departments = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of filtered) {
      const dept = e.department || t("common.unknown");
      map.set(dept, (map.get(dept) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  return (
    <div className="p-3 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">{t("nav.employees")}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInfo(true)}
            className="flex items-center gap-1.5 px-2.5 py-2 text-xs text-slate-500 hover:text-y-teal hover:bg-slate-100 rounded-lg cursor-pointer"
            title="Hoe werken contracturen, shifts en verlof?"
          >
            <Info size={14} />
            Hoe werkt dit?
          </button>
          <a href={`${getErpNextLinkUrl()}/employee/new`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm cursor-pointer">
            <UserPlus size={16} />
            {t("employees.new_employee")}
          </a>
          <button onClick={loadData} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-y-teal text-white rounded-lg hover:bg-y-teal-dark disabled:opacity-50 cursor-pointer">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            {t("common.refresh")}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
      )}

      <div className="mb-4 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3 bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="p-2 bg-y-teal/10 rounded-lg">
            <Users className="text-y-teal" size={20} />
          </div>
          <div>
            <p className="text-sm text-slate-500">{t("nav.employees")}</p>
            <p className="text-2xl font-bold text-slate-800">{loading ? "..." : filtered.length}</p>
          </div>
        </div>

        {departments.slice(0, 4).map(([dept, count]) => (
          <div key={dept} className="bg-white rounded-xl shadow-sm border border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-400">{dept}</p>
            <p className="text-lg font-bold text-slate-700">{count}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 flex items-center gap-3">
        <Filter size={16} className="text-slate-400" />
        <CompanySelect value={company} onChange={setCompany} />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal">
          <option value="">{t("common.all_statuses")}</option>
          <option value="Active">{t("employees.active")}</option>
          <option value="Inactive">{t("employees.inactive")}</option>
          <option value="Left">{t("employees.left_status")}</option>
        </select>
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder={t("employees.search_placeholder")}
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-y-teal text-sm" />
        </div>
      </div>

      {/* Card grid view */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">{t("common.loading")}</div>
      ) : filtered.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-slate-400">{t("employees.no_employees")}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((emp) => {
            const birthdayDays = daysUntilAnniversary(emp.date_of_birth);
            const joiningDays = daysUntilAnniversary(emp.date_of_joining);
            const serviceYears = yearsOfService(emp.date_of_joining);
            const contractDays = daysUntilDate(emp.contract_end_date);
            const weekHours = contractHours[emp.name];
            const ls = leaveSummary[emp.name];

            return (
              <div key={emp.name} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedEmployee(emp)}>
                <div className="flex items-center gap-4 mb-3">
                  <div className={`w-12 h-12 rounded-full ${getColor(emp.employee_name)} flex items-center justify-center text-white font-bold text-lg`}>
                    {getInitials(emp.employee_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-slate-800 truncate">{emp.employee_name}</h3>
                    <p className="text-sm text-slate-500 truncate">{emp.designation || "-"}</p>
                  </div>
                  <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${statusColors[emp.status] ?? "bg-slate-100 text-slate-600"}`}>
                    {emp.status}
                  </span>
                </div>
                <div className="space-y-1.5 text-sm">
                  {emp.department && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">{t("employees.department")}</span>
                      <span className="text-slate-700">{emp.department}</span>
                    </div>
                  )}
                  {emp.company_email && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">{t("employees.email")}</span>
                      <span className="text-slate-700 truncate ml-2">{emp.company_email}</span>
                    </div>
                  )}

                  {/* Verjaardag */}
                  {emp.date_of_birth && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Cake size={13} />
                        {t("employees.birthday")}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className={urgencyClass(birthdayDays)}>
                          {formatDutchDate(emp.date_of_birth, t)}
                        </span>
                        {birthdayDays !== null && birthdayDays <= 30 && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${urgencyBadge(birthdayDays)}`}>
                            {birthdayDays === 0 ? t("employees.today_short") : `${birthdayDays}d`}
                          </span>
                        )}
                      </span>
                    </div>
                  )}

                  {/* In dienst sinds + dienstjaren */}
                  {emp.date_of_joining && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 flex items-center gap-1">
                        <CalendarClock size={13} />
                        {t("employees.in_service_since")}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className={urgencyClass(joiningDays)}>
                          {formatDutchDate(emp.date_of_joining, t)}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
                          {t("employees.years_short", { years: serviceYears })}
                        </span>
                        {joiningDays !== null && joiningDays <= 30 && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${urgencyBadge(joiningDays)}`}>
                            {joiningDays === 0 ? t("employees.jubilee") : `${joiningDays}d`}
                          </span>
                        )}
                      </span>
                    </div>
                  )}

                  {/* Contract einddatum */}
                  {emp.contract_end_date && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 flex items-center gap-1">
                        <FileWarning size={13} />
                        {t("employees.contract_end")}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className={urgencyClass(contractDays)}>
                          {formatDutchDate(emp.contract_end_date, t)}
                        </span>
                        {contractDays !== null && contractDays < 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                            {t("employees.expired")}
                          </span>
                        )}
                        {contractDays !== null && contractDays >= 0 && contractDays <= 30 && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${urgencyBadge(contractDays)}`}>
                            {contractDays === 0 ? t("employees.today_short") : `${contractDays}d`}
                          </span>
                        )}
                      </span>
                    </div>
                  )}

                  {/* Contracturen */}
                  {weekHours !== undefined && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Clock size={13} />
                        {t("employees.contract_hours")}
                      </span>
                      <span className="text-slate-700 font-medium">{t("employees.hours_per_week", { hours: weekHours })}</span>
                    </div>
                  )}

                  {/* Vakantiedagen */}
                  {ls && ls.vakantieAllocated > 0 && (() => {
                    const remaining = ls.vakantieAllocated - ls.vakantieUsed;
                    const pct = (remaining / ls.vakantieAllocated) * 100;
                    const barColor = remaining <= 3 ? "bg-red-500" : remaining <= 5 ? "bg-amber-400" : "bg-y-teal";
                    return (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 flex items-center gap-1 flex-shrink-0">
                          <Palmtree size={13} />
                          {t("employees.vacation")}
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
                          </div>
                          <span className="text-slate-700 text-xs w-16 text-right">{t("employees.days_of", { remaining, total: ls.vakantieAllocated })}</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Ziektedagen */}
                  {ls && ls.ziekteDagen > 0 && (() => {
                    const SICK_MAX = 20;
                    const pct = Math.min(100, (ls.ziekteDagen / SICK_MAX) * 100);
                    return (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 flex items-center gap-1 flex-shrink-0">
                          <Thermometer size={13} />
                          {t("employees.sickness")}
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-orange-400" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-slate-700 text-xs w-16 text-right">{t("employees.days_count", { count: ls.ziekteDagen })}</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Overuren saldo */}
                  {overurenSaldo[emp.name] !== undefined && overurenSaldo[emp.name] !== 0 && (() => {
                    const s = overurenSaldo[emp.name];
                    const isPositive = s > 0;
                    return (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 flex items-center gap-1 flex-shrink-0">
                          <Clock size={13} />
                          {t("employees.overtime")}
                        </span>
                        <span className={`text-xs font-semibold ${isPositive ? "text-red-600" : "text-blue-600"}`}>
                          {isPositive ? "+" : ""}{s}u
                        </span>
                      </div>
                    );
                  })()}

                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-400">
                  {emp.name}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Employee detail modal */}
      {selectedEmployee && (
        <EmployeeDetailModal employee={selectedEmployee} onClose={() => setSelectedEmployee(null)} />
      )}

      {/* Info-overlay: hoe werken contracturen, shifts en verlof. Korte
          voorzet — wordt later door Piet aangevuld (zie
          docs/employees-contract-hours.md voor de volledige stub). */}
      <InfoOverlay
        open={showInfo}
        title="Contracturen, shifts & verlof"
        onClose={() => setShowInfo(false)}
        footer={<>Volledige uitleg: <code className="text-y-teal">docs/employees-contract-hours.md</code> · wordt nog aangevuld.</>}
      >
        <p>
          Voor elke medewerker is "hoeveel uur moet die werken" en
          "welke dagen zijn vrij" verdeeld over meerdere ERPNext-doctypes.
          Y-app combineert die om contracturen, verwachte uren per dag,
          missende werkdagen en verlof-saldo te tonen.
        </p>

        <div>
          <h4 className="font-semibold text-slate-800 mb-1">De vier sleutel-doctypes</h4>
          <ul className="list-disc list-inside space-y-1">
            <li>
              <strong>Shift Type</strong> — definieert een werkpatroon
              (uren per dag van de week). Bv. "40u / week" of
              "32u / 4 dagen".
            </li>
            <li>
              <strong>Shift Assignment</strong> — koppelt een medewerker
              aan een Shift Type voor een periode (from_date / to_date).
              Eén medewerker kan meerdere assignments hebben
              (parttime → fulltime midden in het jaar).
            </li>
            <li>
              <strong>Holiday List</strong> — lijst van feestdagen +
              (optioneel) weekenddagen. Per medewerker via
              <code className="text-xs">Employee.holiday_list</code>;
              Y-app valt anders terug op een NL-fallback-lijst.
            </li>
            <li>
              <strong>Leave Application</strong> — ingediende verlof-
              aanvraag (vakantie, ziek, ouderschap, …). Y-app filtert op
              <em> Approved</em> en sluit die dagen uit van "missende
              uren"-checks.
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold text-slate-800 mb-1">Wat Y-app waar gebruikt</h4>
          <table className="w-full text-xs border border-slate-200 rounded">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="text-left px-2 py-1.5">Y-app onderdeel</th>
                <th className="text-left px-2 py-1.5">Bron in ERPNext</th>
              </tr>
            </thead>
            <tbody className="text-slate-600">
              <tr className="border-t border-slate-100">
                <td className="px-2 py-1.5">"Uren vandaag"</td>
                <td className="px-2 py-1.5">Shift Assignment → Shift Type</td>
              </tr>
              <tr className="border-t border-slate-100">
                <td className="px-2 py-1.5">"Missende werkdagen" widget</td>
                <td className="px-2 py-1.5">Shift workdays − Holiday List − Leave − pre-joining</td>
              </tr>
              <tr className="border-t border-slate-100">
                <td className="px-2 py-1.5">Goedkeuren-tab ± delta</td>
                <td className="px-2 py-1.5">Verwachte uren in periode − geboekte uren</td>
              </tr>
              <tr className="border-t border-slate-100">
                <td className="px-2 py-1.5">Vakantieplanning</td>
                <td className="px-2 py-1.5">Holiday List + bestaande Leave Apps + workdays</td>
              </tr>
              <tr className="border-t border-slate-100">
                <td className="px-2 py-1.5">Verlofsaldo</td>
                <td className="px-2 py-1.5">Leave Allocation − goedgekeurde Leave Apps</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-xs text-slate-500 italic">
          Belangrijk: Y-app rekent <strong>per medewerker</strong> met
          de juiste Holiday List + Shift Assignment, niet generiek. Een
          parttimer met een eigen Shift Type krijgt andere "missende
          dagen" en een ander verlof-saldo dan een fulltimer.
        </p>
      </InfoOverlay>
    </div>
  );
}
