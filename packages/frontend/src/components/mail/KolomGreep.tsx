/**
 * De greep op de rechterrand van een mailkolom, om hem breder of smaller te
 * slepen. Dubbelklikken zet de standaardbreedte terug.
 *
 * De greep is breder dan de lijn die oplicht: een lijn van één pixel raak je
 * met de muis niet. De kolom zelf moet `relative` zijn.
 */

import type { MouseEvent as ReactMouseEvent } from "react";

export default function KolomGreep({ label, onStart, onReset }: {
  label: string;
  onStart: (e: ReactMouseEvent<HTMLElement>) => void;
  onReset: () => void;
}) {
  return (
    <div role="separator" aria-orientation="vertical" aria-label={label} title={label}
      data-kolom-greep
      onMouseDown={onStart}
      onDoubleClick={onReset}
      className="group absolute inset-y-0 -right-1.5 z-20 flex w-3 cursor-col-resize justify-center">
      <span className="h-full w-0.5 bg-transparent transition-colors group-hover:bg-blue-400 group-active:bg-blue-500" />
    </div>
  );
}
