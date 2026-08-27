import { useState, useEffect, useRef, type RefObject } from "react";

type Position = "above" | "below";

interface UseDropdownPositionOptions {
  isOpen: boolean;
  preferAbove?: boolean;
  margin?: number;
}

export function useDropdownPosition(
  triggerRef: RefObject<HTMLElement | null>,
  options: UseDropdownPositionOptions,
): { position: Position; dropdownRef: RefObject<HTMLDivElement | null> } {
  const { isOpen, preferAbove = true, margin = 8 } = options;
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position>(preferAbove ? "above" : "below");

  useEffect(() => {
    if (!isOpen || !triggerRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const dropdownHeight = dropdownRef.current?.offsetHeight || 150;
    const spaceAbove = triggerRect.top;
    const spaceBelow = window.innerHeight - triggerRect.bottom;

    if (preferAbove) {
      setPosition(spaceAbove >= dropdownHeight + margin ? "above" : "below");
    } else {
      setPosition(spaceBelow >= dropdownHeight + margin ? "below" : "above");
    }
  }, [isOpen, preferAbove, margin]);

  return { position, dropdownRef };
}
