import type { PropsWithChildren } from "react";

type ShellCardProps = PropsWithChildren<{
  title: string;
  description?: string;
}>;

export function ShellCard({ children, description, title }: ShellCardProps) {
  return (
    <section className="shell-card">
      <div className="shell-card-heading">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {children}
    </section>
  );
}