export function buildSessionContext(): string {
  const now = new Date();

  const date = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const time = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const locale = navigator.language || "en-US";
  const languages = navigator.languages?.join(", ") || locale;
  const platform = navigator.platform || "unknown";
  const online = navigator.onLine;
  const screenW = screen.width;
  const screenH = screen.height;
  const darkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;

  const lines = [
    `Date: ${date}`,
    `Time: ${time}`,
    `Timezone: ${timezone}`,
    `Locale: ${locale}`,
    `Languages: ${languages}`,
    `Platform: ${platform}`,
    `Online: ${online}`,
    `Screen: ${screenW}x${screenH}`,
    `Dark mode: ${darkMode}`,
  ];

  return `\n\nSession context:\n${lines.join("\n")}`;
}
