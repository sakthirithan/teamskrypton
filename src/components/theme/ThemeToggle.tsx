import { useTheme } from 'next-themes';
import { Sun, Moon, Laptop, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useEffect, useState } from 'react';

interface ThemeToggleProps {
  className?: string;
  align?: 'end' | 'start' | 'center';
}

export function ThemeToggle({ className, align = 'end' }: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch by waiting for mount
  useEffect(() => {
    setMounted(true);
  }, []);

  const renderTriggerIcon = () => {
    if (!mounted) {
      return <Sun className="h-5 w-5 text-muted-foreground transition-all" />;
    }

    if (theme === 'system') {
      return resolvedTheme === 'dark' ? (
        <Moon className="h-[1.125rem] w-[1.125rem] transition-all text-primary" />
      ) : (
        <Sun className="h-[1.125rem] w-[1.125rem] transition-all text-amber-500" />
      );
    }

    return theme === 'dark' ? (
      <Moon className="h-[1.125rem] w-[1.125rem] transition-all text-primary" />
    ) : (
      <Sun className="h-[1.125rem] w-[1.125rem] transition-all text-amber-500" />
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`relative h-9 w-9 sm:h-10 sm:w-10 rounded-full hover:bg-primary/10 transition-colors focus-visible:ring-2 focus-visible:ring-primary ${className || ''}`}
          aria-label="Select theme"
          title={`Theme: ${theme ? theme.charAt(0).toUpperCase() + theme.slice(1) : 'System'}`}
        >
          {renderTriggerIcon()}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-40 border-border/60 shadow-xl backdrop-blur-xl">
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
          Theme
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem
          onClick={() => setTheme('light')}
          className="flex items-center justify-between cursor-pointer focus:bg-accent focus:text-accent-foreground"
        >
          <div className="flex items-center gap-2">
            <Sun className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-medium">Light</span>
          </div>
          {mounted && theme === 'light' && <Check className="w-4 h-4 text-primary shrink-0" />}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => setTheme('dark')}
          className="flex items-center justify-between cursor-pointer focus:bg-accent focus:text-accent-foreground"
        >
          <div className="flex items-center gap-2">
            <Moon className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-medium">Dark</span>
          </div>
          {mounted && theme === 'dark' && <Check className="w-4 h-4 text-primary shrink-0" />}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => setTheme('system')}
          className="flex items-center justify-between cursor-pointer focus:bg-accent focus:text-accent-foreground"
        >
          <div className="flex items-center gap-2">
            <Laptop className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium">System</span>
          </div>
          {mounted && theme === 'system' && <Check className="w-4 h-4 text-primary shrink-0" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
