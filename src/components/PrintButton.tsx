'use client';

export default function PrintButton() {
  return (
    <button className="secondary-btn no-print" onClick={() => window.print()}>
      Print / save as PDF
    </button>
  );
}
