/** Rolling-hills wallpaper drawn from gradients only (no Microsoft image). */
export function Wallpaper() {
  return (
    <svg
      viewBox="0 0 1600 1000"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
    >
      <defs>
        <linearGradient id="wp-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--sky-top)" />
          <stop offset=".42" stopColor="var(--sky-mid)" />
          <stop offset=".66" stopColor="var(--sky-low)" />
        </linearGradient>
        <radialGradient id="wp-cloud" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#fff" stopOpacity=".9" />
          <stop offset=".6" stopColor="#fff" stopOpacity=".45" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="wp-back" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--hill-mid)" />
          <stop offset="1" stopColor="var(--hill-dark)" />
        </linearGradient>
        <radialGradient id="wp-front" cx=".38" cy=".05" r="1.05">
          <stop offset="0" stopColor="#a3d063" />
          <stop offset=".22" stopColor="var(--hill-light)" />
          <stop offset=".55" stopColor="var(--hill-mid)" />
          <stop offset=".82" stopColor="var(--hill-dark)" />
          <stop offset="1" stopColor="var(--hill-deep)" />
        </radialGradient>
        <linearGradient id="wp-sheen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset=".4" stopColor="#fffbd0" stopOpacity=".22" />
          <stop offset=".75" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect width="1600" height="1000" fill="url(#wp-sky)" />

      <g>
        <ellipse cx="300" cy="170" rx="260" ry="55" fill="url(#wp-cloud)" />
        <ellipse cx="430" cy="140" rx="170" ry="48" fill="url(#wp-cloud)" />
        <ellipse cx="1080" cy="120" rx="300" ry="60" fill="url(#wp-cloud)" />
        <ellipse cx="1260" cy="160" rx="200" ry="45" fill="url(#wp-cloud)" />
        <ellipse cx="760" cy="300" rx="240" ry="38" fill="url(#wp-cloud)" opacity=".7" />
        <ellipse cx="1420" cy="340" rx="180" ry="30" fill="url(#wp-cloud)" opacity=".6" />
        <ellipse cx="140" cy="380" rx="160" ry="26" fill="url(#wp-cloud)" opacity=".55" />
      </g>

      <path d="M560 660 C 820 600, 1180 585, 1600 615 L1600 1000 L560 1000 Z" fill="url(#wp-back)" />
      <path
        d="M0 690 C 220 590, 560 520, 820 552 C 1080 584, 1330 690, 1600 742 L1600 1000 L0 1000 Z"
        fill="url(#wp-front)"
      />
      <path
        d="M0 690 C 220 590, 560 520, 820 552 C 1080 584, 1330 690, 1600 742 L1600 790 C 1300 735, 1060 640, 820 610 C 560 580, 240 640, 0 740 Z"
        fill="url(#wp-sheen)"
      />
    </svg>
  );
}
