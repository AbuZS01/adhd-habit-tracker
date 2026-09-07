'use client';

export default function PrintButton() {
  return (
    <button className="btn btn-ghost no-print" onClick={() => window.print()}>
      Print to PDF
    </button>
  );
}
