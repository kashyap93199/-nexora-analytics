import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemePreference } from "../../contexts/ThemeContext";
import { Dropdown, MenuItem } from "../ui/Dropdown";
import { cn } from "../../lib/utils";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, preference, setPreference } = useTheme();

  const OPTIONS: { value: ThemePreference; label: string; icon: React.ReactNode }[] = [
    { value: "light", label: "Light", icon: <Sun className="h-4 w-4" /> },
    { value: "dark", label: "Dark", icon: <Moon className="h-4 w-4" /> },
    { value: "system", label: "System", icon: <Monitor className="h-4 w-4" /> },
  ];

  return (
    <Dropdown
      width="w-44"
      trigger={(open) => (
        <button
          className={cn(
            "inline-flex items-center justify-center rounded-lg border border-border bg-card text-muted transition hover:text-ink dark:hover:bg-white/[0.06]",
            compact ? "h-8 w-8" : "h-9 w-9",
            open && "text-ink dark:bg-white/[0.06]"
          )}
          aria-label={`Switch theme (currently ${theme})`}
        >
          {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </button>
      )}
    >
      {(close) => (
        <>
          <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Theme</p>
          {OPTIONS.map((opt) => (
            <MenuItem
              key={opt.value}
              onClick={() => {
                setPreference(opt.value);
                close();
              }}
            >
              <span className="text-muted">{opt.icon}</span>
              <span className="flex-1">{opt.label}</span>
              {preference === opt.value && <Check className="h-3.5 w-3.5 text-primary-500" />}
            </MenuItem>
          ))}
        </>
      )}
    </Dropdown>
  );
}
