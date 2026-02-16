interface DiscordLogoProps {
  className?: string;
}

export function DiscordLogo({ className }: DiscordLogoProps) {
  return <img src="/discord.svg" alt="" aria-hidden="true" className={className} />;
}
