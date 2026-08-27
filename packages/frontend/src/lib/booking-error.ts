/**
 * Leesbaar maken van een ERPNext-foutmelding op het uren-boekpad.
 *
 * Frappe levert de reden van een geweigerde boeking aan als `exception`, in de
 * vorm `erpnext.projects.doctype.timesheet.timesheet.OverlapError: Row 1: ...`.
 * Voor een banner is alleen het deel ná de dubbele punt bruikbaar — het
 * Python-pad zegt de boeker niets. Staat er geen herkenbaar exception-pad
 * voor, dan blijft de tekst ongemoeid.
 */
export function cleanBookingError(message: string): string {
  const match = message.match(/^[\w.]*\w*Error:\s*(.+)$/s);
  return (match ? match[1] : message).trim();
}
