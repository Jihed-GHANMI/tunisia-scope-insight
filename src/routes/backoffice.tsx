import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Cpu,
  Database,
  FileText,
  Lock,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  DEFAULT_AI_REPORT_CONFIG,
  normalizeAiReportConfig,
  type AiReportConfig,
} from "@/lib/ai-report-config";
import { getAiReportConfig, saveAiReportConfig } from "@/lib/ai-report-actions";
import { SECTORS } from "@/lib/maturity-data";
import { saveScoringSubmissions } from "@/lib/scoring-submissions";
import {
  generateSyntheticScoringData,
  type SyntheticScoringRecord,
} from "@/lib/synthetic-data-actions";

export const Route = createFileRoute("/backoffice")({
  head: () => ({
    meta: [
      { title: "Backoffice EvalitX AI" },
      { name: "description", content: "Parametrage du rapport IA OpenAI EvalitX." },
    ],
  }),
  component: Backoffice,
});

type SaveState = "idle" | "saving" | "saved" | "error";
type SyntheticState = "idle" | "generating" | "ready" | "inserting" | "inserted" | "error";

const DEFAULT_SYNTHETIC_FORM = {
  apiKey: "",
  baseUrl: DEFAULT_AI_REPORT_CONFIG.baseUrl,
  model: DEFAULT_AI_REPORT_CONFIG.model,
  rowCount: 12,
  sectors: ["services", "industrie", "commerce"],
  maturityScenario: "mixed" as "mixed" | "early" | "growth" | "advanced" | "regulated-risk",
  noiseLevel: 0.35,
  countryContext: "Tunisie",
  researchContext:
    "PFE en data science: segmentation des niveaux de maturite digitale, gouvernance data, qualite des donnees et readiness IA.",
};

function Backoffice() {
  const [passcode, setPasscode] = useState("");
  const [draft, setDraft] = useState<AiReportConfig>(DEFAULT_AI_REPORT_CONFIG);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("");
  const [syntheticForm, setSyntheticForm] = useState(DEFAULT_SYNTHETIC_FORM);
  const [syntheticRows, setSyntheticRows] = useState<SyntheticScoringRecord[]>([]);
  const [syntheticState, setSyntheticState] = useState<SyntheticState>("idle");
  const [syntheticMessage, setSyntheticMessage] = useState("");

  const normalizedDraft = useMemo(() => normalizeAiReportConfig(draft), [draft]);

  const login = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const config = await getAiReportConfig({ data: { passcode } });
      setDraft(config);
      setAuthenticated(true);
    } catch (error) {
      setAuthenticated(false);
      setMessage(error instanceof Error ? error.message : "Acces refuse.");
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    setSaveState("saving");
    setMessage("");

    try {
      const result = await saveAiReportConfig({ data: { passcode, config: normalizedDraft } });
      setDraft(result.config);
      setSaveState("saved");
      setMessage(
        `Configuration sauvegardee le ${new Date(result.savedAt).toLocaleString("fr-FR")}.`,
      );
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : "Sauvegarde impossible.");
    }
  };

  const toggleSector = (sector: string) => {
    setSyntheticForm((current) => ({
      ...current,
      sectors: current.sectors.includes(sector)
        ? current.sectors.filter((item) => item !== sector)
        : [...current.sectors, sector],
    }));
  };

  const generateDummyData = async () => {
    setSyntheticState("generating");
    setSyntheticMessage("");
    setSyntheticRows([]);

    try {
      const result = await generateSyntheticScoringData({
        data: {
          passcode,
          apiKey: syntheticForm.apiKey,
          baseUrl: syntheticForm.baseUrl,
          model: syntheticForm.model,
          rowCount: syntheticForm.rowCount,
          sectors: syntheticForm.sectors,
          maturityScenario: syntheticForm.maturityScenario,
          noiseLevel: syntheticForm.noiseLevel,
          countryContext: syntheticForm.countryContext,
          researchContext: syntheticForm.researchContext,
        },
      });
      setSyntheticRows(result.records);
      setSyntheticState("ready");
      setSyntheticMessage(
        `${result.records.length} lignes synthetiques generees avec ${result.model}.`,
      );
    } catch (error) {
      setSyntheticState("error");
      setSyntheticMessage(error instanceof Error ? error.message : "Generation impossible.");
    }
  };

  const insertDummyData = async () => {
    setSyntheticState("inserting");
    setSyntheticMessage("");

    try {
      await saveScoringSubmissions(syntheticRows);
      setSyntheticState("inserted");
      setSyntheticMessage(`${syntheticRows.length} lignes ajoutees dans scoring_test_submissions.`);
    } catch (error) {
      setSyntheticState("error");
      setSyntheticMessage(
        error instanceof Error ? error.message : "Insertion Supabase impossible.",
      );
    }
  };

  return (
    <div className="min-h-screen text-foreground">
      <header className="border-b border-slate-200/80 bg-white/95 text-slate-950 shadow-[0_14px_45px_-28px_rgba(15,23,42,0.45)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-violet-600">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-brand text-white shadow-[0_10px_24px_-12px_rgba(139,92,246,0.75)]">
                <ShieldCheck className="h-4 w-4" />
              </span>
              Backoffice
            </div>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">
              Parametrage du rapport IA OpenAI
            </h1>
          </div>
          <Link
            to="/"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-violet-200 hover:text-violet-700 hover:shadow-[0_10px_26px_-18px_rgba(79,70,229,0.55)]"
          >
            Retour evaluation
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {!authenticated ? (
          <motion.form
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={login}
            className="mx-auto max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-[var(--shadow-card)] backdrop-blur"
          >
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-white/8 text-white">
              <Lock className="h-5 w-5" />
            </div>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/55">
                Passcode
              </span>
              <input
                type="password"
                autoFocus
                value={passcode}
                onChange={(event) => setPasscode(event.target.value)}
                className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 text-sm font-medium text-white outline-none transition focus:border-accent/70 focus:bg-white/[0.06] focus:ring-2 focus:ring-accent/20"
              />
            </label>
            {message && (
              <p className="mt-3 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-100">
                {message}
              </p>
            )}
            <button
              type="submit"
              disabled={!passcode || loading}
              className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-brand px-4 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Lock className="h-4 w-4" />
              {loading ? "Verification..." : "Entrer"}
            </button>
          </motion.form>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
              <div className="flex items-center gap-3">
                <span
                  className={`h-3 w-3 rounded-full ${normalizedDraft.enabled ? "bg-emerald-400" : "bg-red-400"}`}
                />
                <div>
                  <div className="text-sm font-semibold text-white">
                    {normalizedDraft.enabled ? "Generation active" : "Generation desactivee"}
                  </div>
                  <div className="text-xs text-white/45">{normalizedDraft.model}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setDraft(DEFAULT_AI_REPORT_CONFIG)}
                  className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/75 transition hover:bg-white/10"
                >
                  Reinitialiser
                </button>
                <button
                  type="button"
                  disabled={saveState === "saving"}
                  onClick={save}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-5 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {saveState === "saving" ? "Sauvegarde..." : "Sauvegarder"}
                </button>
              </div>
            </div>

            {message && (
              <p
                className={`rounded-xl border px-3 py-2 text-sm ${
                  saveState === "error"
                    ? "border-red-400/20 bg-red-400/10 text-red-100"
                    : "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                }`}
              >
                {message}
              </p>
            )}

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_1fr]">
              <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
                <SectionTitle
                  icon={<SlidersHorizontal className="h-4 w-4" />}
                  title="Parametres API"
                />
                <ToggleField
                  label="Generation automatique"
                  checked={draft.enabled}
                  onChange={(enabled) => setDraft({ ...draft, enabled })}
                />
                <TextField
                  label="Base URL OpenAI"
                  value={draft.baseUrl}
                  onChange={(baseUrl) => setDraft({ ...draft, baseUrl })}
                />
                <TextField
                  label="Modele"
                  value={draft.model}
                  onChange={(model) => setDraft({ ...draft, model })}
                />
                <NumberField
                  label="Max output tokens"
                  value={draft.maxTokens}
                  min={512}
                  max={4096}
                  step={64}
                  onChange={(maxTokens) => setDraft({ ...draft, maxTokens })}
                />
              </section>

              <section className="space-y-5">
                <PromptPanel
                  icon={<Cpu className="h-4 w-4" />}
                  title="System prompt"
                  value={draft.systemPrompt}
                  rows={7}
                  onChange={(systemPrompt) => setDraft({ ...draft, systemPrompt })}
                />
                <PromptPanel
                  icon={<FileText className="h-4 w-4" />}
                  title="Conseils"
                  value={draft.advicePrompt}
                  rows={6}
                  onChange={(advicePrompt) => setDraft({ ...draft, advicePrompt })}
                />
                <PromptPanel
                  icon={<AlertTriangle className="h-4 w-4" />}
                  title="Lignes rouges"
                  value={draft.redLines}
                  rows={6}
                  onChange={(redLines) => setDraft({ ...draft, redLines })}
                />
                <PromptPanel
                  icon={<ShieldCheck className="h-4 w-4" />}
                  title="Contrat de sortie"
                  value={draft.outputContract}
                  rows={9}
                  onChange={(outputContract) => setDraft({ ...draft, outputContract })}
                />
              </section>
            </div>

            <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <SectionTitle
                    icon={<Database className="h-4 w-4" />}
                    title="Donnees synthetiques IA"
                  />
                  <p className="mt-1 text-sm text-white/45">
                    Observations fictives pour analyse exploratoire, segmentation et modelisation de
                    la maturite data.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={
                      !syntheticForm.apiKey ||
                      syntheticForm.sectors.length === 0 ||
                      syntheticState === "generating"
                    }
                    onClick={generateDummyData}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Sparkles className="h-4 w-4" />
                    {syntheticState === "generating" ? "Generation..." : "Generer"}
                  </button>
                  <button
                    type="button"
                    disabled={syntheticRows.length === 0 || syntheticState === "inserting"}
                    onClick={insertDummyData}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    {syntheticState === "inserting" ? "Insertion..." : "Ajouter a Supabase"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
                <div className="space-y-4">
                  <TextField
                    label="OpenAI API key"
                    type="password"
                    value={syntheticForm.apiKey}
                    onChange={(apiKey) => setSyntheticForm({ ...syntheticForm, apiKey })}
                  />
                  <TextField
                    label="Base URL OpenAI"
                    value={syntheticForm.baseUrl}
                    onChange={(baseUrl) => setSyntheticForm({ ...syntheticForm, baseUrl })}
                  />
                  <TextField
                    label="Modele"
                    value={syntheticForm.model}
                    onChange={(model) => setSyntheticForm({ ...syntheticForm, model })}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <NumberField
                      label="Lignes"
                      value={syntheticForm.rowCount}
                      min={1}
                      max={80}
                      step={1}
                      onChange={(rowCount) => setSyntheticForm({ ...syntheticForm, rowCount })}
                    />
                    <NumberField
                      label="Bruit"
                      value={syntheticForm.noiseLevel}
                      min={0}
                      max={1}
                      step={0.05}
                      onChange={(noiseLevel) => setSyntheticForm({ ...syntheticForm, noiseLevel })}
                    />
                  </div>
                  <SelectField
                    label="Scenario de maturite"
                    value={syntheticForm.maturityScenario}
                    options={[
                      ["mixed", "Mixte"],
                      ["early", "Initial / faible"],
                      ["growth", "Croissance"],
                      ["advanced", "Avance"],
                      ["regulated-risk", "Risque reglementaire"],
                    ]}
                    onChange={(maturityScenario) =>
                      setSyntheticForm({ ...syntheticForm, maturityScenario })
                    }
                  />
                  <TextField
                    label="Pays / contexte"
                    value={syntheticForm.countryContext}
                    onChange={(countryContext) =>
                      setSyntheticForm({ ...syntheticForm, countryContext })
                    }
                  />
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">
                      Secteurs
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {SECTORS.map((sector) => (
                        <label
                          key={sector.id}
                          className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white/75"
                        >
                          <input
                            type="checkbox"
                            checked={syntheticForm.sectors.includes(sector.id)}
                            onChange={() => toggleSector(sector.id)}
                            className="h-4 w-4 accent-purple-500"
                          />
                          <span>{sector.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <PromptPanel
                    icon={<Cpu className="h-4 w-4" />}
                    title="Contexte data science"
                    value={syntheticForm.researchContext}
                    rows={4}
                    onChange={(researchContext) =>
                      setSyntheticForm({ ...syntheticForm, researchContext })
                    }
                  />

                  {syntheticMessage && (
                    <p
                      className={`rounded-xl border px-3 py-2 text-sm ${
                        syntheticState === "error"
                          ? "border-red-400/20 bg-red-400/10 text-red-100"
                          : "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                      }`}
                    >
                      {syntheticMessage}
                    </p>
                  )}

                  {syntheticRows.length > 0 && (
                    <div className="overflow-hidden rounded-xl border border-white/10">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-white/[0.06] text-xs uppercase tracking-wider text-white/45">
                          <tr>
                            <th className="px-3 py-2">Societe</th>
                            <th className="px-3 py-2">Secteur</th>
                            <th className="px-3 py-2">Score</th>
                            <th className="px-3 py-2">Niveau</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/8">
                          {syntheticRows.slice(0, 8).map((row) => (
                            <tr
                              key={`${row.classification.companyName}-${row.classification.contactEmail}`}
                              className="text-white/75"
                            >
                              <td className="px-3 py-2">{row.classification.companyName}</td>
                              <td className="px-3 py-2">{row.classification.sector}</td>
                              <td className="px-3 py-2 tabular-nums">
                                {Math.round(row.score.sgm)}
                              </td>
                              <td className="px-3 py-2">{row.score.level.level}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {syntheticRows.length > 8 && (
                        <div className="border-t border-white/10 px-3 py-2 text-xs text-white/45">
                          {syntheticRows.length - 8} lignes supplementaires pretes a inserer.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/70">
      {icon}
      {title}
    </h2>
  );
}

function TextField({
  label,
  type = "text",
  value,
  onChange,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm font-medium text-white outline-none transition focus:border-accent/70 focus:bg-white/[0.06] focus:ring-2 focus:ring-accent/20"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: "mixed" | "early" | "growth" | "advanced" | "regulated-risk") => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value as "mixed" | "early" | "growth" | "advanced" | "regulated-risk",
          )
        }
        className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm font-medium text-white outline-none transition focus:border-accent/70 focus:bg-white/[0.06] focus:ring-2 focus:ring-accent/20"
      >
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue} className="bg-slate-950 text-white">
            {labelText}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">
        {label}
      </span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm font-medium text-white outline-none transition focus:border-accent/70 focus:bg-white/[0.06] focus:ring-2 focus:ring-accent/20"
      />
    </label>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm font-medium text-white/80">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-purple-500"
      />
    </label>
  );
}

function PromptPanel({
  icon,
  title,
  value,
  rows,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  rows: number;
  onChange: (value: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
      <SectionTitle icon={icon} title={title} />
      <textarea
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        className="mt-4 w-full resize-y rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3 font-mono text-sm leading-6 text-white outline-none transition focus:border-accent/70 focus:bg-white/[0.06] focus:ring-2 focus:ring-accent/20"
      />
    </div>
  );
}
