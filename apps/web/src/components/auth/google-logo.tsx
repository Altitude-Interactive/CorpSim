interface GoogleLogoProps {
  className?: string;
}

export function GoogleLogo({ className }: GoogleLogoProps) {
  return <img src="/google.svg" alt="" aria-hidden="true" className={className} />;
}
