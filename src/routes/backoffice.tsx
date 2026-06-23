import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Cpu,
  FileText,
  Lock,
  Save,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  DEFAULT_AI_REPORT_CONFIG,
  normalizeAiReportConfig,
  type AiReportConfig,
} from "@/lib/ai-report-config";
import { getAiReportConfig, saveAiReportConfig } from "@/lib/ai-report-actions";

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

function Backoffice() {
  const [passcode, setPasscode] = useState("");
  const [draft, setDraft] = useState<AiReportConfig>(DEFAULT_AI_REPORT_CONFIG);
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("");

  const normalizedDraft = useMemo(() => normalizeAiReportConfig(draft), [draft]);

  const login = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const result = await getAiReportConfig({ data: { passcode } });
      setDraft(result.config);
      setApiKeyConfigured(result.hasApiKey);
      setApiKeyDraft("");
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
      const result = await saveAiReportConfig({
        data: {
          passcode,
          config: normalizedDraft,
          openAiApiKey: apiKeyDraft.trim() || undefined,
        },
      });
      setDraft(result.config);
      setApiKeyConfigured(result.hasApiKey);
      setApiKeyDraft("");
      setSaveState("saved");
      setMessage(
        result.persisted
          ? `Configuration sauvegardee le ${new Date(result.savedAt).toLocaleString("fr-FR")}.`
          : "Configuration active pour cette session. Appliquez la migration Supabase securisee pour la persister.",
      );
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : "Sauvegarde impossible.");
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
                    {normalizedDraft.enabled ? "Rapport IA actif" : "Rapport IA desactive"}
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
                  label="Activer le rapport IA"
                  checked={draft.enabled}
                  onChange={(enabled) => setDraft({ ...draft, enabled })}
                />
                <TextField
                  label="Base URL OpenAI"
                  value={draft.baseUrl}
                  onChange={(baseUrl) => setDraft({ ...draft, baseUrl })}
                />
                <TextField
                  label={apiKeyConfigured ? "OpenAI API key (remplacer)" : "OpenAI API key"}
                  type="password"
                  value={apiKeyDraft}
                  onChange={setApiKeyDraft}
                />
                <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs leading-5 text-white/55">
                  {apiKeyConfigured && !apiKeyDraft
                    ? "Cle OpenAI configuree cote serveur. Laissez ce champ vide pour la conserver."
                    : "La cle est chiffree et stockee cote serveur. Elle n'est jamais renvoyee au navigateur."}
                </p>
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
