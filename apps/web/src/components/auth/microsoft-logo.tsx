interface MicrosoftLogoProps {
  className?: string;
}

export function MicrosoftLogo({ className }: MicrosoftLogoProps) {
  return <img src="/microsoft.svg" alt="" aria-hidden="true" className={className} />;
}
