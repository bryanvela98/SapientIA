import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useId } from 'react';

import { type Theme, useTheme } from '@/lib/useTheme';

const LABELS: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
  'high-contrast': 'High contrast',
};

export function ThemeToggle() {
  const [theme, setTheme] = useTheme();
  const id = useId();

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={id} className="text-xs cursor-pointer">
        Theme
      </Label>
      <Select value={theme} onValueChange={(v) => setTheme(v as Theme)}>
        <SelectTrigger id={id} className="h-8 w-[9rem] text-xs" aria-label="Color theme">
          <SelectValue>{LABELS[theme]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="light">Light</SelectItem>
          <SelectItem value="dark">Dark</SelectItem>
          <SelectItem value="high-contrast">High contrast</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}