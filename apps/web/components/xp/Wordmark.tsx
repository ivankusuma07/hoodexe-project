/** `hood` + orange `.` + grey `exe`, Georgia italic. */
export function Wordmark({ size = 28, dark = false }: { size?: number; dark?: boolean }) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-display)',
        fontStyle: 'italic',
        fontWeight: 700,
        fontSize: size,
        lineHeight: 1,
        letterSpacing: '-0.5px',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ color: dark ? '#fff' : 'var(--hood-brand-lo)' }}>hood</span>
      <span style={{ color: 'var(--hood-accent)' }}>.</span>
      <span style={{ color: dark ? '#9a9a9a' : '#7a7a7a' }}>exe</span>
    </span>
  );
}
