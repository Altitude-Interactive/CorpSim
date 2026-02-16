interface GitHubLogoProps {
  className?: string;
}

export function GitHubLogo({ className }: GitHubLogoProps) {
  return <img src="/github.svg" alt="" aria-hidden="true" className={className} />;
}
