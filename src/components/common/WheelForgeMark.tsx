type WheelForgeMarkProps = {
  size?: number;
  className?: string;
};

/** A compact wheel-and-pointer mark that remains recognizable without the wordmark. */
export function WheelForgeMark({ size = 42, className }: WheelForgeMarkProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label="WheelForge mark"
    >
      <defs>
        <linearGradient id="wheel-forge-mark" x1="7" y1="5" x2="41" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f8c76a" />
          <stop offset="0.48" stopColor="#f59e0b" />
          <stop offset="1" stopColor="#e8793f" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="20.5" fill="#12192f" stroke="url(#wheel-forge-mark)" strokeWidth="2.5" />
      <path d="M24 7.5a16.5 16.5 0 0 1 14.3 8.25l-8.13 4.7A7.1 7.1 0 0 0 24 17v-9.5Z" fill="#f8c76a" />
      <path d="M38.3 15.75A16.5 16.5 0 0 1 39.2 28l-9.23-2.04a7.1 7.1 0 0 0-.37-4.3l8.7-5.91Z" fill="#f59e0b" />
      <path d="M39.2 28A16.5 16.5 0 0 1 29 39l-3.2-9.02a7.1 7.1 0 0 0 4.17-4.02L39.2 28Z" fill="#e8793f" />
      <path d="M29 39a16.5 16.5 0 0 1-14.3-1.4l5.05-8.04A7.1 7.1 0 0 0 25.8 30L29 39Z" fill="#d95d66" />
      <path d="M14.7 37.6A16.5 16.5 0 0 1 8 24.2l9.4-.15a7.1 7.1 0 0 0 2.35 5.5l-5.05 8.05Z" fill="#8b5cf6" />
      <path d="M8 24.2A16.5 16.5 0 0 1 10.2 14l8.18 4.64a7.1 7.1 0 0 0-.98 5.4L8 24.2Z" fill="#667eea" />
      <circle cx="24" cy="24" r="7.1" fill="#12192f" stroke="#fff4df" strokeWidth="2" />
      <path d="m24 24 8.3-13.3 1.6 7.2 5.4 2.1L24 24Z" fill="#fff4df" stroke="#12192f" strokeLinejoin="round" strokeWidth="1.2" />
      <circle cx="24" cy="24" r="2.2" fill="#f59e0b" />
    </svg>
  );
}
