import { useMemo, useState } from "react";
import { Archive, ArchiveRestore, Pencil, Plus, Search, Trash2, UserRound } from "lucide-react";
import { PageHeader } from "../components/common/PageHeader";
import { ShellCard } from "../components/common/ShellCard";
import { useParticipants } from "../hooks/useParticipants";
import { createParticipant, deleteParticipant, setParticipantStatus, updateParticipant } from "../services/participantService";
import type { ParticipantProfile } from "../types";

type ParticipantForm = Pick<ParticipantProfile, "name" | "email" | "group" | "notes">;
const emptyForm: ParticipantForm = { name: "", email: "", group: "", notes: "" };

export function ParticipantsPage() {
  const participants = useParticipants();
  const [form, setForm] = useState<ParticipantForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const visibleParticipants = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return participants.filter((participant) => (showArchived || participant.status === "active") &&
      (!normalizedQuery || [participant.name, participant.email, participant.group, participant.notes]
        .some((value) => value?.toLocaleLowerCase().includes(normalizedQuery))));
  }, [participants, query, showArchived]);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setError("");
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      if (editingId) updateParticipant(editingId, form);
      else createParticipant(form);
      setMessage(editingId ? "Participant updated." : "Participant added to the directory.");
      resetForm();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save participant.");
    }
  }

  function edit(participant: ParticipantProfile) {
    setEditingId(participant.id);
    setForm({ name: participant.name, email: participant.email ?? "", group: participant.group ?? "", notes: participant.notes ?? "" });
    setError("");
    setMessage("");
  }

  function changeStatus(participant: ParticipantProfile) {
    setParticipantStatus(participant.id, participant.status === "active" ? "archived" : "active");
    setMessage(participant.status === "active" ? `${participant.name} archived.` : `${participant.name} restored.`);
  }

  function remove(participant: ParticipantProfile) {
    if (!window.confirm(`Delete ${participant.name} from the directory? This does not change completed tournament records.`)) return;
    deleteParticipant(participant.id);
    setMessage(`${participant.name} deleted.`);
  }

  return <div className="stack">
    <PageHeader eyebrow="People" title="Participant directory" description="Keep reusable participant profiles for tournaments, raffles, teams, and future event tools." />
    <div className="dashboard-grid">
      <ShellCard title={editingId ? "Edit participant" : "Add participant"} description="Profiles stay local to this browser and can be included in backups.">
        <form className="tournament-create-form" onSubmit={submit}>
          <label className="field-stack"><span>Name</span><input className="text-field" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Avery Chen" required /></label>
          <label className="field-stack"><span>Email <small className="muted">optional</small></span><input className="text-field" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="avery@example.com" /></label>
          <label className="field-stack"><span>Group or team <small className="muted">optional</small></span><input className="text-field" value={form.group} onChange={(event) => setForm((current) => ({ ...current, group: event.target.value }))} placeholder="Blue team" /></label>
          <label className="field-stack"><span>Notes <small className="muted">optional</small></span><textarea className="text-field" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} rows={3} placeholder="Accessibility, role, or event notes" /></label>
          {error && <p className="validation-message" role="alert">{error}</p>}
          <div className="hero-actions">
            <button className="primary-link" type="submit"><UserRound size={16} /> {editingId ? "Save participant" : "Add participant"}</button>
            {editingId && <button className="secondary-link" type="button" onClick={resetForm}>Cancel edit</button>}
          </div>
        </form>
      </ShellCard>
      <ShellCard title="Directory" description={`${participants.filter((participant) => participant.status === "active").length} active participant${participants.filter((participant) => participant.status === "active").length === 1 ? "" : "s"}`}>
        <div className="directory-toolbar">
          <label className="search-field"><Search size={16} /><span className="sr-only">Search participants</span><input className="text-field" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, group, or notes" /></label>
          <label className="checkbox-label"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} /> Show archived</label>
        </div>
        {message && <p className="status-note" role="status">{message}</p>}
        {visibleParticipants.length > 0 ? <div className="project-list participant-directory-list">
          {visibleParticipants.map((participant) => <article className="project-row" key={participant.id}>
            <div className="project-copy"><strong>{participant.name}</strong><span>{[participant.group, participant.email, participant.status === "archived" ? "Archived" : "Active"].filter(Boolean).join(" · ")}</span>{participant.notes && <small className="muted">{participant.notes}</small>}</div>
            <div className="row-actions"><button className="square-action" type="button" onClick={() => edit(participant)} aria-label={`Edit ${participant.name}`} title="Edit participant"><Pencil size={16} /></button><button className="square-action" type="button" onClick={() => changeStatus(participant)} aria-label={participant.status === "active" ? `Archive ${participant.name}` : `Restore ${participant.name}`} title={participant.status === "active" ? "Archive participant" : "Restore participant"}>{participant.status === "active" ? <Archive size={16} /> : <ArchiveRestore size={16} />}</button><button className="square-action danger-action" type="button" onClick={() => remove(participant)} aria-label={`Delete ${participant.name}`} title="Delete participant"><Trash2 size={16} /></button></div>
          </article>)}
        </div> : <div className="empty-inline"><Plus size={18} /><p className="muted">{participants.length === 0 ? "No participants yet. Add the people you use repeatedly." : "No participants match this view."}</p></div>}
      </ShellCard>
    </div>
  </div>;
}
