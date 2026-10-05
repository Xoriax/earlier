import type { ButtonHTMLAttributes, ComponentProps } from 'react';

export function Button({ className = '', variant = 'primary', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' }) {
  const styles =
    variant === 'primary'
      ? 'bg-fuchsia-600 hover:bg-fuchsia-500 text-white'
      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200';
  return (
    <button
      className={`rounded-lg px-4 py-2 font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
      {...props}
    />
  );
}

export function Input({ className = '', ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={`w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none focus:border-fuchsia-500 disabled:opacity-60 ${className}`}
      {...props}
    />
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 ${className}`}>{children}</section>;
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  return children ? <p className="text-sm text-red-400">{children}</p> : null;
}
