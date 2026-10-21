import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 20, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
    ...rest,
  };
}

/** Andorinha vista de cima: asas varridas e cauda bifurcada. É a insígnia do app. */
export function Swallow({ size = 20, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="currentColor"
      aria-hidden
      focusable={false}
      {...rest}
    >
      <path d="M17.4 10.6C21 8.8 26.5 10.6 31.2 19.6 26.5 16.6 21.8 16.4 17.4 18.6Z" />
      <path d="M14.6 10.6C11 8.8 5.5 10.6 .8 19.6 5.5 16.6 10.2 16.4 14.6 18.6Z" />
      <path d="M16 3.6C17.7 3.6 18.4 5.8 18.1 8.6 18.1 12.6 17.9 16 17.2 19.2L16 21 14.8 19.2C14.1 16 13.9 12.6 13.9 8.6 13.6 5.8 14.3 3.6 16 3.6Z" />
      <path d="M14.8 18.4H17.2L20 30 16 24.2 12 30Z" />
    </svg>
  );
}

export const IconFlag = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 21V4" />
    <path d="M5 5h11l-1.8 3.5L16 12H5" />
  </svg>
);
export const IconBell = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 17V11a6 6 0 1 1 12 0v6l1.5 2h-15z" />
    <path d="M10 21h4" />
  </svg>
);
export const IconBellOff = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 17V11a6 6 0 0 1 .8-3M9.3 5.4A6 6 0 0 1 18 11v4" />
    <path d="M4.5 19 6 17M10 21h4M3 3l18 18" />
  </svg>
);
export const IconUser = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c.8-4 4-6 8-6s7.200 2 8 6" />
  </svg>
);
export const IconPlus = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IconHome = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 11 12 4l8 7" />
    <path d="M6 10v10h12V10" />
    <path d="M10 20v-5h4v5" />
  </svg>
);
export const IconMedal = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M8 3h3l1 5-3 1zM16 3h-3l-1 5 3 1z" />
    <circle cx="12" cy="15" r="5" />
    <path d="m12 12.500.9 1.800 2 .3-1.400 1.400.3 2-1.800-1-1.800 1 .3-2-1.400-1.400 2-.3z" />
  </svg>
);
export const IconWallet = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 7a2 2 0 0 1 2-2h11v4" />
    <path d="M4 7v10a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1V10a1 1 0 0 0-1-1H6a2 2 0 0 1-2-2z" />
    <circle cx="16.500" cy="14" r="1.100" fill="currentColor" />
  </svg>
);
export const IconCopy = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 0 1 2-2h8" />
  </svg>
);
export const IconPin = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 21s7-6.100 7-11.500A7 7 0 0 0 5 9.500C5 14.900 12 21 12 21z" />
    <circle cx="12" cy="9.500" r="2.500" />
  </svg>
);
export const IconWifi = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 9.500a14 14 0 0 1 18 0M6 13a9.500 9.500 0 0 1 12 0M9 16.500a5 5 0 0 1 6 0" />
    <circle cx="12" cy="19.500" r=".8" fill="currentColor" />
  </svg>
);
export const IconKey = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="8" cy="15" r="4" />
    <path d="m11 12 9-9M16 7l3 3M14 9l2 2" />
  </svg>
);
export const IconClock = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
export const IconClip = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m20 11-8.500 8.500a5 5 0 0 1-7-7L13 4a3.500 3.500 0 0 1 5 5l-8.500 8.500a2 2 0 0 1-3-3L14 7" />
  </svg>
);
export const IconCamera = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 8h3l1.500-2.500h7L17 8h3v11H4z" />
    <circle cx="12" cy="13.500" r="3.500" />
  </svg>
);
export const IconShare = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="6" cy="12" r="2.500" />
    <circle cx="18" cy="6" r="2.500" />
    <circle cx="18" cy="18" r="2.500" />
    <path d="m8.200 10.800 7.600-3.600M8.200 13.200l7.600 3.600" />
  </svg>
);
export const IconCheck = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m5 12.500 4.500 4.500L19 7.500" />
  </svg>
);
export const IconReceipt = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
    <path d="M9 8h6M9 12h6" />
  </svg>
);
export const IconDice = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <circle cx="9" cy="9" r="1" fill="currentColor" />
    <circle cx="15" cy="15" r="1" fill="currentColor" />
    <circle cx="15" cy="9" r="1" fill="currentColor" />
    <circle cx="9" cy="15" r="1" fill="currentColor" />
  </svg>
);
export const IconArrowLeft = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </svg>
);
export const IconBeer = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 7h10v13H6zM16 10h2.500a1.500 1.500 0 0 1 1.500 1.500v3a1.500 1.500 0 0 1-1.500 1.500H16" />
    <path d="M6 7c0-2 1.500-3 3-3s2 1 3.500 1S15 4 16 7M10 11v5M13 11v5" />
  </svg>
);
export const IconLeaf = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 19c0-8 4-14 15-14 0 10-5 15-12 15z" />
    <path d="M5 19c3-4 6-7 10-9" />
  </svg>
);

export const IconEdit = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 20h4L19 9l-4-4L4 16z" />
    <path d="m13.500 6.500 4 4" />
  </svg>
);
export const IconCar = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 16V11l2-5h10l2 5v5" />
    <path d="M3 16h18v3H3zM5 11h14" />
    <circle cx="7.500" cy="16" r="1" fill="currentColor" />
    <circle cx="16.500" cy="16" r="1" fill="currentColor" />
  </svg>
);
export const IconCart = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 4h3l2 11h10l2-8H7" />
    <circle cx="9" cy="19" r="1.300" />
    <circle cx="17" cy="19" r="1.300" />
  </svg>
);

export const IconSun = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.600 5.600 7 7M17 17l1.400 1.400M5.600 18.400 7 17M17 7l1.400-1.400" />
  </svg>
);
export const IconCloud = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M7 18a4 4 0 0 1-.5-7.970A5.500 5.500 0 0 1 17 8.500a4.500 4.500 0 0 1 .5 9z" />
  </svg>
);
export const IconRain = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M7 15a4 4 0 0 1-.5-7.970A5.500 5.500 0 0 1 17 5.500a4.500 4.500 0 0 1 .5 9" />
    <path d="m8 18-1 3M12 18l-1 3M16 18l-1 3" />
  </svg>
);
export const IconStorm = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M7 15a4 4 0 0 1-.5-7.970A5.500 5.500 0 0 1 17 5.500a4.500 4.500 0 0 1 .5 9" />
    <path d="m12 13-2 4h3l-2 4" />
  </svg>
);
export const IconFog = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M7 13a4 4 0 0 1-.5-7.970A5.500 5.500 0 0 1 17 3.500a4.500 4.500 0 0 1 .5 9" />
    <path d="M4 17h16M7 21h10" />
  </svg>
);
export const IconTrash = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
  </svg>
);
export const IconBox = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 7.500 12 3l9 4.500v9L12 21l-9-4.500z" />
    <path d="m3 7.500 9 4.500 9-4.500M12 12v9" />
  </svg>
);
export const IconUsers = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="9" cy="8" r="3.500" />
    <path d="M2.500 20c.6-3.500 3.200-5 6.500-5s5.900 1.500 6.500 5M16 5a3.500 3.500 0 0 1 0 6.500M18 15c2 .6 3.200 2.200 3.500 5" />
  </svg>
);
export const IconDownload = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" />
  </svg>
);
export const IconWand = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m5 19 11-11M14 6l4 4M5 6V3M3.500 4.500h3M19 15v3M17.500 16.500h3M10 3v1.500" />
  </svg>
);
export const IconUndo = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
  </svg>
);

export const IconGauge = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 17a8 8 0 1 1 16 0" />
    <path d="m12 17 4-5" />
    <path d="M12 6v1.5M6.3 8.3l1 1M17.7 8.3l-1 1" />
  </svg>
);
