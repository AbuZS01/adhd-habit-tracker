export interface NudgePreviewProps {
  title: string;
  body: string;
}

/**
 * Renders what a notification will look like, entirely through React JSX
 * text interpolation (auto-escaped, SR-2) — never dangerouslySetInnerHTML.
 * A crafted habit name like `<img src=x onerror=alert(1)>` renders as inert
 * text here, matching the same guarantee the real push notification gets
 * from server-side sanitisation (SR-11).
 */
export default function NudgePreview({ title, body }: NudgePreviewProps) {
  return (
    <div className="card" aria-label="Notification preview">
      <strong>{title}</strong>
      <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)' }}>{body}</p>
    </div>
  );
}
