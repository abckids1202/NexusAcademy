import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowDown, ArrowUp, Upload } from "lucide-react";
import { PageHeader } from "../components/common/PageHeader";
import { ShellCard } from "../components/common/ShellCard";
import {
  createWheel,
  createWheelOption,
  getWheel,
  saveWheel,
} from "../services/wheelService";
import type { SpinMode, VisualMode, Wheel, WheelOption } from "../types";
import { loadData } from "../services/storageService";
import { getDefaultOptionColor, getReadableTextColor } from "../utils/colors";
import { calculateOptionChance, getActiveOptions } from "../utils/wheelMath";
import { validateWheel } from "../utils/validation";
import { parseOptionLines } from "../utils/optionImport";
import { parseWheelOptionCsv, type CsvOptionPreview } from "../utils/csvImport";
import { useDataRevision } from "../hooks/useDataRevision";

type WheelEditorPageProps = {
  mode: "create" | "edit";
};

export function WheelEditorPage({ mode }: WheelEditorPageProps) {
  useDataRevision();
  const navigate = useNavigate();
  const { wheelId } = useParams();
  const isCreate = mode === "create";
  const existingWheel = !isCreate && wheelId ? getWheel(wheelId) : undefined;
  const defaults = loadData().settings;
  const [wheel, setWheel] = useState<Wheel>(() => {
    const now = new Date().toISOString();

    return (
      existingWheel ?? {
        id: "draft",
        title: "",
        description: "",
        options: [
          createWheelOption("Option A", 0),
          createWheelOption("Option B", 1),
          createWheelOption("Option C", 2),
        ],
        visualMode: defaults.defaultVisualMode,
        spinMode: defaults.defaultSpinMode,
        removeWinnerAfterSpin: false,
        spinDurationMs: defaults.defaultSpinDurationMs,
        theme: "default",
        createdAt: now,
        updatedAt: now,
      }
    );
  });
  const [baseUpdatedAt, setBaseUpdatedAt] = useState(() => existingWheel?.updatedAt);
  const [saveError, setSaveError] = useState("");
  const [pastedOptions, setPastedOptions] = useState("");
  const [optionMessage, setOptionMessage] = useState("");
  const [csvPreview, setCsvPreview] = useState<CsvOptionPreview | null>(null);
  const activeOptions = useMemo(() => getActiveOptions(wheel.options), [wheel.options]);
  const parsedOptions = useMemo(() => parseOptionLines(pastedOptions), [pastedOptions]);
  const validationErrors = useMemo(() => validateWheel(wheel), [wheel]);
  const hasStaleDraft = !isCreate && baseUpdatedAt !== undefined && existingWheel?.updatedAt !== baseUpdatedAt;

  function updateOption(optionId: string, updates: Partial<WheelOption>) {
    setWheel((current) => ({
      ...current,
      options: current.options.map((option) =>
        option.id === optionId
          ? {
              ...option,
              ...updates,
              textColor:
                updates.color && !updates.textColor
                  ? getReadableTextColor(updates.color)
                  : updates.textColor ?? option.textColor,
            }
          : option,
      ),
    }));
  }

  function addOption() {
    setWheel((current) => ({
      ...current,
      options: [
        ...current.options,
        createWheelOption(`Option ${current.options.length + 1}`, current.options.length),
      ],
    }));
  }

  function addPastedOptions() {
    if (parsedOptions.length === 0) return;
    setWheel((current) => ({
      ...current,
      options: [
        ...current.options,
        ...parsedOptions.map((label, index) =>
          createWheelOption(label, current.options.length + index),
        ),
      ],
    }));
    setOptionMessage(`Added ${parsedOptions.length} options.`);
    setPastedOptions("");
  }

  async function previewOptionCsv(file?: File) {
    if (!file) return;
    try {
      setCsvPreview(parseWheelOptionCsv(await file.text()));
      setOptionMessage("");
    } catch (error) {
      setCsvPreview(null);
      setOptionMessage(error instanceof Error ? error.message : "Could not read this CSV file.");
    }
  }

  function addCsvOptions() {
    if (!csvPreview || csvPreview.options.length === 0) return;
    setWheel((current) => ({
      ...current,
      options: [
        ...current.options,
        ...csvPreview.options.map((item, index) => ({
          ...createWheelOption(item.label, current.options.length + index),
          weight: item.weight,
        })),
      ],
    }));
    const details = [
      `${csvPreview.options.length} options added`,
      csvPreview.errors.length > 0 ? `${csvPreview.errors.length} invalid rows skipped` : "",
      csvPreview.duplicateCount > 0 ? `${csvPreview.duplicateCount} repeated labels kept as separate entries` : "",
    ].filter(Boolean);
    setOptionMessage(`${details.join("; ")}.`);
    setCsvPreview(null);
  }

  function moveOption(index: number, direction: -1 | 1) {
    const destination = index + direction;
    if (destination < 0 || destination >= wheel.options.length) return;
    setWheel((current) => {
      const options = [...current.options];
      [options[index], options[destination]] = [options[destination], options[index]];
      return { ...current, options: options.map((option, sortOrder) => ({ ...option, sortOrder })) };
    });
  }

  function deleteOption(optionId: string) {
    setWheel((current) => ({
      ...current,
      options: current.options
        .filter((option) => option.id !== optionId)
        .map((option, index) => ({ ...option, sortOrder: index })),
    }));
  }

  function handleSave(asCopy = false) {
    if (validationErrors.length > 0) return;
    const sanitizedOptions = wheel.options.map((option, index) => ({
      ...option,
      label: option.label.trim() || `Option ${index + 1}`,
      weight: Math.max(0.01, Number(option.weight) || 1),
      sortOrder: index,
    }));
    const input = {
      title: wheel.title.trim(),
      description: wheel.description,
      options: sanitizedOptions,
      visualMode: wheel.visualMode,
      spinMode: wheel.spinMode,
      removeWinnerAfterSpin: wheel.removeWinnerAfterSpin,
      spinDurationMs: wheel.spinDurationMs,
      theme: wheel.theme,
    };

    try {
      const savedWheel = isCreate || asCopy
        ? createWheel({
            ...input,
            title: asCopy ? `${input.title || "Untitled Wheel"} (copy)` : input.title,
            options: asCopy
              ? sanitizedOptions.map((option, index) => createWheelOption(option.label, index, { ...option, id: undefined }))
              : sanitizedOptions,
          })
        : saveWheel({ ...wheel, title: input.title, options: sanitizedOptions }, baseUpdatedAt);
      navigate(`/spin/${savedWheel.id}`);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save this wheel.");
    }
  }

  function reloadLatest() {
    if (!existingWheel) {
      navigate("/dashboard");
      return;
    }
    setWheel(existingWheel);
    setBaseUpdatedAt(existingWheel.updatedAt);
    setSaveError("");
  }

  return (
    <div className="stack">
      <PageHeader
        eyebrow={isCreate ? "New wheel" : "Edit wheel"}
        title={isCreate ? "Create a wheel" : "Tune your wheel"}
        description="Create custom weighted wheels with editable labels, colors, active states, and probabilities."
        actions={
          <button className="primary-link" type="button" onClick={() => handleSave()} disabled={validationErrors.length > 0 || hasStaleDraft}>
            Save and spin
          </button>
        }
      />
      {hasStaleDraft && <div className="validation-message" role="alert">
        <strong>This wheel changed in another tab.</strong>
        <p>Your draft is still here. Reload the latest version or save this draft as a separate wheel.</p>
        <div className="hero-actions">
          {existingWheel && <button className="secondary-link" type="button" onClick={reloadLatest}>Reload latest version</button>}
          <button className="secondary-link" type="button" onClick={() => handleSave(true)} disabled={validationErrors.length > 0}>Save draft as a new wheel</button>
        </div>
      </div>}
      {saveError && !hasStaleDraft && <div className="validation-message" role="alert">{saveError}</div>}
      {validationErrors.length > 0 && <div className="validation-message" role="alert"><strong>Before saving</strong><ul>{validationErrors.map((error) => <li key={error}>{error}</li>)}</ul></div>}
      <div className="editor-grid">
        <ShellCard title="Wheel details" description="Name, description, spin duration, and visual mode.">
          <div className="form-grid">
            <label className="field-stack">
              <span>Title</span>
              <input
                className="text-field"
                value={wheel.title}
                onChange={(event) =>
                  setWheel((current) => ({ ...current, title: event.target.value }))
                }
                placeholder="Giveaway Prize Wheel"
              />
            </label>
            <label className="field-stack">
              <span>Description</span>
              <textarea
                className="text-field"
                value={wheel.description}
                onChange={(event) =>
                  setWheel((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="What this wheel is for"
              />
            </label>
            <label className="field-stack">
              <span>Visual mode</span>
              <select
                className="select-field"
                value={wheel.visualMode}
                onChange={(event) =>
                  setWheel((current) => ({
                    ...current,
                    visualMode: event.target.value as VisualMode,
                  }))
                }
              >
                <option value="equal">Equal segments</option>
                <option value="weighted">Weighted segments</option>
              </select>
            </label>
            <label className="field-stack">
              <span>Spin duration</span>
              <input
                className="text-field"
                min={1800}
                step={100}
                type="number"
                value={wheel.spinDurationMs}
                onChange={(event) =>
                  setWheel((current) => ({
                    ...current,
                    spinDurationMs: Number(event.target.value),
                  }))
                }
              />
            </label>
            <label className="field-stack">
              <span>Spin behavior</span>
              <select
                className="select-field"
                value={wheel.spinMode}
                onChange={(event) => {
                  const spinMode = event.target.value as SpinMode;
                  setWheel((current) => ({
                    ...current,
                    spinMode,
                    removeWinnerAfterSpin: spinMode === "accumulation" ? false : current.removeWinnerAfterSpin,
                  }));
                }}
              >
                <option value="normal">Normal</option>
                <option value="no-repeat">Avoid immediate repeats</option>
                <option value="elimination">Eliminate each winner</option>
                <option value="accumulation">Accumulate selection counts</option>
              </select>
            </label>
            <label className="mini-toggle setting-toggle">
              <span>Remove winner after each spin</span>
              <input
                checked={wheel.spinMode === "accumulation" ? false : wheel.removeWinnerAfterSpin}
                disabled={wheel.spinMode === "accumulation"}
                type="checkbox"
                onChange={(event) => setWheel((current) => ({
                  ...current,
                  removeWinnerAfterSpin: event.target.checked,
                }))}
              />
            </label>
            <p className="muted">
              Weighted chances always use the weight column. Visual mode only changes
              whether the wheel slices look equal or proportional.
            </p>
          </div>
        </ShellCard>
        <ShellCard title="Options" description="Editable wheel options with colors, weights, active state, and ordering.">
          <div className="bulk-option-entry">
            <label className="field-stack" htmlFor="bulk-wheel-options">
              <span>Paste options, one per line</span>
              <textarea
                id="bulk-wheel-options"
                className="text-field"
                value={pastedOptions}
                onChange={(event) => setPastedOptions(event.target.value)}
                placeholder={'Lunch\nDinner\nTakeout'}
                rows={4}
              />
            </label>
            <button className="secondary-link" type="button" onClick={addPastedOptions} disabled={parsedOptions.length === 0}>
              Add {parsedOptions.length} options
            </button>
            <label className="secondary-link file-button"><Upload size={16} /> Preview CSV<input type="file" accept=".csv,text/csv" onChange={(event) => { void previewOptionCsv(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>
          </div>
          {optionMessage && <p className="status-note" role="status">{optionMessage}</p>}
          {csvPreview && <section className="csv-option-preview" aria-label="CSV option preview">
            <p><strong>{csvPreview.options.length} valid options</strong>{csvPreview.errors.length > 0 ? ` · ${csvPreview.errors.length} invalid rows` : ""}{csvPreview.blankRows > 0 ? ` · ${csvPreview.blankRows} blank rows skipped` : ""}</p>
            {csvPreview.duplicateCount > 0 && <p className="muted">{csvPreview.duplicateCount} repeated labels will be kept as separate entries, preserving their combined chance.</p>}
            <ul>{csvPreview.options.slice(0, 6).map((item) => <li key={`${item.line}-${item.label}`}>{item.label}<span>Weight {item.weight}</span></li>)}</ul>
            {csvPreview.options.length > 6 && <p className="muted">And {csvPreview.options.length - 6} more options.</p>}
            {csvPreview.errors.length > 0 && <ul className="csv-option-errors" aria-label="Invalid CSV rows">{csvPreview.errors.slice(0, 4).map((item) => <li key={item.line}>Row {item.line}: {item.message}</li>)}</ul>}
            <div className="hero-actions">
              <button className="primary-link" type="button" disabled={csvPreview.options.length === 0} onClick={addCsvOptions}>Add {csvPreview.options.length} valid options</button>
              <button className="secondary-link" type="button" onClick={() => setCsvPreview(null)}>Cancel import</button>
            </div>
          </section>}
          <div className="option-editor-list">
            {wheel.options.map((option, index) => (
              <div className="option-editor-row" key={option.id}>
                <input
                  aria-label={`Color for ${option.label}`}
                  className="color-field"
                  type="color"
                  value={option.color || getDefaultOptionColor(index)}
                  onChange={(event) =>
                    updateOption(option.id, { color: event.target.value })
                  }
                />
                <input
                  className="text-field"
                  value={option.label}
                  onChange={(event) =>
                    updateOption(option.id, { label: event.target.value })
                  }
                  placeholder={`Option ${index + 1}`}
                />
                <input
                  aria-label={`Weight for ${option.label}`}
                  className="weight-field"
                  min={0.01}
                  step={0.5}
                  type="number"
                  value={option.weight}
                  onChange={(event) =>
                    updateOption(option.id, {
                      weight: Number(event.target.value),
                    })
                  }
                />
                <label className="mini-toggle">
                  <input
                    checked={option.isActive}
                    type="checkbox"
                    onChange={(event) =>
                      updateOption(option.id, { isActive: event.target.checked })
                    }
                  />
                  <span>Active</span>
                </label>
                <span className="chance-pill">
                  {Math.round(calculateOptionChance(option, wheel.options) * 1000) /
                    10}
                  %
                </span>
                <div className="option-order-actions">
                  <button className="square-action" type="button" title="Move option up" aria-label={`Move ${option.label} up`} disabled={index === 0} onClick={() => moveOption(index, -1)}><ArrowUp size={15} /></button>
                  <button className="square-action" type="button" title="Move option down" aria-label={`Move ${option.label} down`} disabled={index === wheel.options.length - 1} onClick={() => moveOption(index, 1)}><ArrowDown size={15} /></button>
                </div>
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => deleteOption(option.id)}
                  disabled={wheel.options.length <= 2}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
          <div className="editor-actions">
            <button className="secondary-link" type="button" onClick={addOption}>
              Add option
            </button>
            <button className="primary-link" type="button" onClick={() => handleSave()} disabled={validationErrors.length > 0 || hasStaleDraft}>
              Save and spin
            </button>
            <Link className="secondary-link" to="/spin">
              Cancel
            </Link>
          </div>
          <p className="muted">{activeOptions.length} active options ready to spin.</p>
        </ShellCard>
      </div>
    </div>
  );
}
