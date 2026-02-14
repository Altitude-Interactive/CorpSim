interface GoogleLogoProps {
  className?: string;
}

export function GoogleLogo({ className }: GoogleLogoProps) {
  return (
    <svg
      viewBox="0 0 18 18"
      role="img"
      aria-label="Google"
      className={className}
    >
      <path
        fill="#EA4335"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62Z"
      />
      <path
        fill="#4285F4"
        d="M9 18c2.44 0 4.5-.8 6-2.18l-2.9-2.26c-.8.54-1.82.87-3.1.87-2.38 0-4.4-1.6-5.13-3.76H.88v2.34A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.87 10.67A5.41 5.41 0 0 1 3.58 9c0-.58.1-1.14.29-1.67V4.99H.88A9 9 0 0 0 0 9c0 1.45.35 2.82.88 4.01l2.99-2.34Z"
      />
      <path
        fill="#34A853"
        d="M9 3.58c1.33 0 2.52.46 3.46 1.36l2.58-2.58C13.5.94 11.44 0 9 0A9 9 0 0 0 .88 4.99l2.99 2.34C4.6 5.17 6.62 3.58 9 3.58Z"
      />
    </svg>
  );
}
