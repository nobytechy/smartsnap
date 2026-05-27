import { cn } from '@/lib/cn';

export function FormField({ label, hint, error, required, children }) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm font-medium text-ink-700">
          {label}{required && <span className="ml-0.5 text-burgundy-600">*</span>}
        </span>
        {hint && <span className="text-xs text-ink-400">{hint}</span>}
      </div>
      {children}
      {error && <p className="mt-1 text-xs text-burgundy-600">{error}</p>}
    </label>
  );
}

export function TextInput({ className, ...props }) {
  return <input {...props} className={cn('input', className)} />;
}

export function TextArea({ className, ...props }) {
  return <textarea {...props} className={cn('input min-h-[6rem] resize-y', className)} />;
}

export function Select({ className, children, ...props }) {
  return (
    <select {...props} className={cn('input', className)}>
      {children}
    </select>
  );
}

export function Checkbox({ label, ...props }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-ink-700">
      <input
        type="checkbox"
        {...props}
        className="h-4 w-4 rounded border-ink-300 text-burgundy-600 focus:ring-burgundy-500/30"
      />
      {label}
    </label>
  );
}
