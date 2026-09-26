import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Bookmark, Heart, Package, Pencil, Route, Search, Sparkles, Trash2, Download, Upload } from "lucide-react";
import { PageHeader } from "../components/common/PageHeader";
import { useDataRevision } from "../hooks/useDataRevision";
import { loadData } from "../services/storageService";
import {
  createChainFromTemplate,
  createChainFromUserTemplate,
  createWheelFromTemplate,
  createWheelFromUserTemplate,
  deleteUserTemplate,
  getChainTemplates,
  getUserTemplates,
  getWheelTemplates,
  replaceChainTemplateFromSource,
  replaceWheelTemplateFromSource,
  renameUserTemplate,
  toggleTemplateFavorite,
} from "../services/templateService";
import type { UserTemplate } from "../types";
import { getChains } from "../services/chainService";
import { getWheels } from "../services/wheelService";
import { deleteTemplatePack, exportTemplatePack, getTemplatePacks, importTemplatePack, installTemplatePack, renameTemplatePack, togglePackFavorite } from "../services/templatePackService";

type TemplateKind = "all" | "wheel" | "chain" | "favorites" | "recent" | "mine";

export function TemplatesPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<TemplateKind>("all");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [replacementSourceIds, setReplacementSourceIds] = useState<Record<string, string>>({});
  useDataRevision();

  const { favoriteTemplateIds: favoriteIds, recentTemplateIds } = loadData();
  const { favoritePackIds, recentPackIds } = loadData();
  const userTemplates = getUserTemplates();
  const savedWheels = getWheels();
  const savedChains = getChains();
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const allTemplates = [...getWheelTemplates(), ...getChainTemplates()];
  const packs = getTemplatePacks().filter((pack) =>
    (filter !== "mine" || pack.source === "user") &&
    (category === "all" || pack.category === category) &&
    (filter !== "favorites" || favoritePackIds.includes(pack.id)) &&
    (filter !== "recent" || recentPackIds.includes(pack.id)) &&
    (!normalizedQuery || `${pack.title} ${pack.description} ${pack.category} ${pack.tags.join(" ")}`.toLocaleLowerCase().includes(normalizedQuery)),
  );
  const categories = [...new Set([...allTemplates.map((template) => template.category), ...getTemplatePacks().map((pack) => pack.category), ...(userTemplates.length ? ["custom"] : [])])].sort();
  const matches = (template: { id: string; title: string; description: string; category: string }, detailText: string) =>
    (category === "all" || template.category === category) &&
    (filter !== "favorites" || favoriteIds.includes(template.id)) &&
    (filter !== "recent" || recentTemplateIds.includes(template.id)) &&
    (!normalizedQuery || `${template.title} ${template.description} ${template.category} ${detailText}`
      .toLocaleLowerCase().includes(normalizedQuery));
  const sortByRecent = <T extends { id: string }>(templates: T[]) => filter === "recent"
    ? [...templates].sort((a, b) => recentTemplateIds.indexOf(a.id) - recentTemplateIds.indexOf(b.id))
    : templates;
  const wheels = sortByRecent(getWheelTemplates().filter((template) => matches(
    template,
    template.wheel.options.map((option) => option.label).join(" "),
  )));
  const chains = sortByRecent(getChainTemplates().filter((template) => matches(
    template,
    template.steps.map((step) => step.title).join(" "),
  )));
  const showWheels = filter === "all" || filter === "wheel" || filter === "favorites" || filter === "recent";
  const showChains = filter === "all" || filter === "chain" || filter === "favorites" || filter === "recent";
  const savedTemplates = userTemplates.filter((template) =>
    (filter === "all" || filter === "mine" || filter === "favorites" || filter === "recent" ||
      (filter === "wheel" && template.kind === "wheel") || (filter === "chain" && template.kind === "chain")) &&
    (category === "all" || category === "custom") &&
    (filter !== "favorites" || favoriteIds.includes(template.id)) &&
    (filter !== "recent" || recentTemplateIds.includes(template.id)) &&
    (!normalizedQuery || `${template.title} ${template.description} ${template.kind} ${template.kind === "wheel"
      ? template.wheel.options.map((option) => option.label).join(" ")
      : `${template.chain.steps.map((step) => step.title).join(" ")} ${template.wheels.map((wheel) => wheel.title).join(" ")}`}`
      .toLocaleLowerCase().includes(normalizedQuery)),
  );
  const orderedSavedTemplates = filter === "recent"
    ? [...savedTemplates].sort((a, b) => recentTemplateIds.indexOf(a.id) - recentTemplateIds.indexOf(b.id))
    : savedTemplates;

  function createFromWheelTemplate(templateId: string) {
    const wheel = createWheelFromTemplate(templateId);
    if (wheel) navigate(`/wheels/${wheel.id}/edit`);
  }

  function createFromChainTemplate(templateId: string) {
    const chain = createChainFromTemplate(templateId);
    if (chain) navigate(`/chains/${chain.id}/run`);
  }

  function createFromUserTemplate(template: UserTemplate) {
    const created = template.kind === "wheel"
      ? createWheelFromUserTemplate(template.id)
      : createChainFromUserTemplate(template.id);
    if (!created) return;
    navigate(template.kind === "wheel" ? `/wheels/${created.id}/edit` : `/chains/${created.id}/run`);
  }

  function renameSavedTemplate(template: UserTemplate) {
    const title = window.prompt("Rename this template", template.title);
    if (!title?.trim()) return;
    try {
      renameUserTemplate(template.id, title);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not rename this template.");
    }
  }

  function removeSavedTemplate(template: UserTemplate) {
    if (window.confirm(`Delete the saved template “${template.title}”? Existing wheels and generators created from it will not be changed.`)) {
      deleteUserTemplate(template.id);
    }
  }

  function replaceSavedTemplate(template: UserTemplate) {
    const sources = template.kind === "wheel" ? savedWheels : savedChains;
    const sourceId = replacementSourceIds[template.id] ?? sources[0]?.id;
    const source = sources.find((item) => item.id === sourceId);
    if (!source) return;
    if (!window.confirm(`Replace “${template.title}” with the current contents of “${source.title}”? Its name stays the same, and existing copies are unchanged.`)) return;
    try {
      if (template.kind === "wheel") replaceWheelTemplateFromSource(template.id, sourceId);
      else replaceChainTemplateFromSource(template.id, sourceId);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not replace this template.");
    }
  }

  function installPack(packId: string) {
    try {
      const preview = getTemplatePacks().find((item) => item.id === packId);
      if (!preview || !window.confirm(`Install ${preview.title}?\n\n${preview.wheels.length} wheels and ${preview.chains.length} generators will be copied into your workspace${preview.tournamentPreset ? " with tournament setup defaults" : ""}. Existing content will not be changed.`)) return;
      const result = installTemplatePack(packId);
      if (!result) return;
      if (result.chains[0]) navigate(`/chains/${result.chains[0].id}/run`);
      else if (result.wheels[0]) navigate(`/wheels/${result.wheels[0].id}/edit`);
    } catch (error) { window.alert(error instanceof Error ? error.message : "Could not install this pack."); }
  }

  function downloadPack(packId: string) {
    const blob = new Blob([exportTemplatePack(packId)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `${packId}.json`; anchor.click(); URL.revokeObjectURL(url);
  }

  function handlePackImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    file.text().then((json) => { try { importTemplatePack(json); } catch (error) { window.alert(error instanceof Error ? error.message : "Could not import this pack."); } });
    event.target.value = "";
  }

  function favoriteButton(templateId: string, title: string) {
    const isFavorite = favoriteIds.includes(templateId);
    return <button
      className={isFavorite ? "template-favorite active" : "template-favorite"}
      type="button"
      aria-label={`${isFavorite ? "Remove" : "Add"} ${title} ${isFavorite ? "from" : "to"} favorites`}
      aria-pressed={isFavorite}
      onClick={() => toggleTemplateFavorite(templateId)}
    ><Heart size={17} fill={isFavorite ? "currentColor" : "none"} /></button>;
  }

  return <div className="stack">
    <PageHeader eyebrow="Templates" title="Start with a template" description="Ready-made wheels, multi-step generators, and event kits. Every install becomes your own editable copy." actions={<label className="secondary-button"><Upload size={16} /> Import pack<input className="sr-only" type="file" accept="application/json,.json" onChange={handlePackImport} /></label>} />
    <div className="filter-tabs" role="group" aria-label="Filter templates">
      {(["all", "wheel", "chain", "favorites", "recent", "mine"] as const).map((item) => <button key={item} className={filter === item ? "filter-tab active" : "filter-tab"} type="button" aria-pressed={filter === item} onClick={() => setFilter(item)}>
        {item === "all" ? "All templates" : item === "wheel" ? "Wheels" : item === "chain" ? "Generators" : item === "favorites" ? `Favorites (${favoriteIds.length})` : item === "recent" ? `Recent (${recentTemplateIds.length})` : `My templates (${userTemplates.length})`}
      </button>)}
    </div>
    <div className="template-controls">
      <label className="template-search"><Search size={17} aria-hidden="true" /><span className="sr-only">Search templates</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, category, step, or option" /></label>
      <label className="template-category"><span>Category</span><select className="select-field" value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{categories.map((item) => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}</select></label>
    </div>
    {(filter === "all" || filter === "favorites" || filter === "recent" || filter === "mine") && packs.length > 0 && <section className="stack template-section"><div className="section-title"><h2><Package size={19} /> Template packs</h2><span>{packs.length} kits</span></div><div className="feature-grid">
      {packs.map((pack) => { const favorite = favoritePackIds.includes(pack.id); const userPack = pack.source === "user"; return <article className="template-item" key={pack.id}>
        <button className={favorite ? "template-favorite active" : "template-favorite"} type="button" aria-label={`${favorite ? "Remove" : "Add"} ${pack.title} ${favorite ? "from" : "to"} favorites`} aria-pressed={favorite} onClick={() => togglePackFavorite(pack.id)}><Heart size={17} fill={favorite ? "currentColor" : "none"} /></button>
        <div className="template-swatch-row pack-swatch" aria-hidden="true"><span /><span /><span /><span /></div>
        <div className="template-item-copy"><span className="eyebrow">{pack.category} kit · v{pack.version}</span><h3>{pack.title}</h3><p>{pack.description}</p><small>{pack.wheels.length} wheels · {pack.chains.length} generators{pack.tournamentPreset ? " · tournament setup" : ""}</small></div>
        <button className="secondary-link" type="button" onClick={() => installPack(pack.id)}>Install pack <ArrowRight size={16} /></button>
        <div className="user-template-actions"><button className="square-action" type="button" title={`Export ${pack.title}`} aria-label={`Export ${pack.title}`} onClick={() => downloadPack(pack.id)}><Download size={15} /></button>{userPack && <><button className="square-action" type="button" title={`Rename ${pack.title}`} aria-label={`Rename ${pack.title}`} onClick={() => { const title = window.prompt("Rename this pack", pack.title); if (title?.trim()) renameTemplatePack(pack.id, title); }}><Pencil size={15} /></button><button className="square-action danger-action" type="button" title={`Delete ${pack.title}`} aria-label={`Delete ${pack.title}`} onClick={() => { if (window.confirm(`Delete the pack “${pack.title}”?`)) deleteTemplatePack(pack.id); }}><Trash2 size={15} /></button></>}</div>
      </article>; })}
    </div></section>}
    {showWheels && wheels.length > 0 && <section className="stack template-section"><div className="section-title"><h2><Sparkles size={19} /> Wheel templates</h2><span>{wheels.length} templates</span></div><div className="feature-grid">
      {wheels.map((template) => <article className="template-item" key={template.id}>
        {favoriteButton(template.id, template.title)}
        <div className="template-swatch-row" aria-hidden="true">{template.wheel.options.slice(0, 6).map((option) => <span key={option.id} style={{ background: option.color }} />)}</div>
        <div className="template-item-copy"><span className="eyebrow">{template.category}</span><h3>{template.title}</h3><p>{template.description}</p><small>{template.wheel.options.length} options · {template.wheel.visualMode} layout · {template.wheel.spinMode} mode</small></div>
        <p className="sr-only">Options: {template.wheel.options.map((option) => option.label).join(", ")}</p>
        <button className="secondary-link" type="button" onClick={() => createFromWheelTemplate(template.id)}>Use template <ArrowRight size={16} /></button>
      </article>)}
    </div></section>}
    {showChains && chains.length > 0 && <section className="stack template-section"><div className="section-title"><h2><Route size={19} /> Generator templates</h2><span>{chains.length} templates</span></div><div className="feature-grid">
      {chains.map((template) => <article className="template-item" key={template.id}>
        {favoriteButton(template.id, template.title)}
        <ol className="template-chain-preview" aria-label={`${template.steps.length} generator steps`} tabIndex={0}>{template.steps.map((step, index) => <li key={`${step.title}-${index}`}>{step.title}</li>)}</ol>
        <div className="template-item-copy"><span className="eyebrow">{template.category}</span><h3>{template.title}</h3><p>{template.description}</p><small>{template.steps.length} connected steps</small></div>
        <button className="secondary-link" type="button" onClick={() => createFromChainTemplate(template.id)}>Create generator <ArrowRight size={16} /></button>
      </article>)}
    </div></section>}
    {orderedSavedTemplates.length > 0 && <section className="stack template-section"><div className="section-title"><h2><Bookmark size={19} /> My templates</h2><span>{orderedSavedTemplates.length} saved</span></div><div className="feature-grid">
      {orderedSavedTemplates.map((template) => <article className="template-item" key={template.id}>
        {favoriteButton(template.id, template.title)}
        {template.kind === "wheel"
          ? <>
            <div className="template-swatch-row" aria-hidden="true">{template.wheel.options.slice(0, 6).map((option) => <span key={option.id} style={{ background: option.color }} />)}</div>
            <p className="sr-only">Options: {template.wheel.options.map((option) => option.label).join(", ")}</p>
          </>
          : <ol className="template-chain-preview" aria-label={`${template.chain.steps.length} generator steps`} tabIndex={0}>{template.chain.steps.map((step, index) => <li key={`${step.id}-${index}`}>{step.title}</li>)}</ol>}
        <div className="template-item-copy"><span className="eyebrow">Custom {template.kind}</span><h3>{template.title}</h3><p>{template.description || (template.kind === "wheel" ? "A reusable wheel saved from your workspace." : "A reusable generator saved from your workspace.")}</p><small>{template.kind === "wheel" ? `${template.wheel.options.length} options · ${template.wheel.spinMode} mode` : `${template.chain.steps.length} steps · ${template.wheels.length} wheels included`}</small></div>
        <button className="secondary-link" type="button" onClick={() => createFromUserTemplate(template)}>Use template <ArrowRight size={16} /></button>
        <details className="template-update-details">
          <summary>Replace snapshot</summary>
          {template.kind === "wheel"
            ? <label className="field-stack"><span>Saved wheel</span><select className="select-field" aria-label={`Replacement source for ${template.title}`} value={replacementSourceIds[template.id] ?? savedWheels[0]?.id ?? ""} onChange={(event) => setReplacementSourceIds((current) => ({ ...current, [template.id]: event.target.value }))}>{savedWheels.map((wheel) => <option key={wheel.id} value={wheel.id}>{wheel.title}</option>)}</select></label>
            : <label className="field-stack"><span>Saved generator</span><select className="select-field" aria-label={`Replacement source for ${template.title}`} value={replacementSourceIds[template.id] ?? savedChains[0]?.id ?? ""} onChange={(event) => setReplacementSourceIds((current) => ({ ...current, [template.id]: event.target.value }))}>{savedChains.map((chain) => <option key={chain.id} value={chain.id}>{chain.title}</option>)}</select></label>}
          <button className="secondary-link" type="button" disabled={template.kind === "wheel" ? savedWheels.length === 0 : savedChains.length === 0} onClick={() => replaceSavedTemplate(template)}>Replace from saved {template.kind}</button>
          <p className="muted">The saved template name stays the same. Existing projects created from it are not changed.</p>
        </details>
        <div className="user-template-actions"><button className="square-action" type="button" title={`Rename ${template.title}`} aria-label={`Rename ${template.title}`} onClick={() => renameSavedTemplate(template)}><Pencil size={15} /></button><button className="square-action danger-action" type="button" title={`Delete ${template.title}`} aria-label={`Delete ${template.title}`} onClick={() => removeSavedTemplate(template)}><Trash2 size={15} /></button></div>
      </article>)}
    </div></section>}
    {(showWheels ? wheels.length : 0) + (showChains ? chains.length : 0) + orderedSavedTemplates.length + packs.length === 0 && <p className="template-empty" role="status">No templates match these filters. Try a different search or category.</p>}
  </div>;
}
