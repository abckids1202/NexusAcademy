import type { LucideIcon } from 'lucide-react';

type Props = {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
};

export function ModeButton({ icon: Icon, label, active, onClick }: Props) {
  return (
    <button
      title={label}
      onClick={onClick}
      className={`flex h-11 w-11 items-center justify-center rounded-md border transition ${
        active ? 'border-nexus-teal bg-nexus-teal text-white' : 'border-slate-200 bg-white text-nexus-ink hover:border-nexus-teal'
      }`}
    >
      <Icon size={20} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </button>
  );
}

