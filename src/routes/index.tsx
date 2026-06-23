import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Classification, type ClassificationData } from "@/components/maturity/Classification";
import { Evaluation } from "@/components/maturity/Evaluation";
import { Loading } from "@/components/maturity/Loading";
import { Report } from "@/components/maturity/Report";
import { computeScore, type AnswersMap } from "@/lib/maturity-engine";
import { saveScoringSubmission } from "@/lib/scoring-submissions";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EvalitX AI — Évaluation de maturité digitale & data" },
      {
        name: "description",
        content:
          "Plateforme IA d'évaluation de la maturité digitale et data des entreprises tunisiennes. 7 dimensions, 42 questions, rapport de consulting.",
      },
    ],
  }),
  component: App,
});

type Step = "classification" | "evaluation" | "loading" | "report";
type SaveStatus = "idle" | "saving" | "saved" | "error";

function App() {
  const [step, setStep] = useState<Step>("classification");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const savedSubmissionKey = useRef<string | null>(null);
  const [classification, setClassification] = useState<ClassificationData>({
    companyName: "",
    contactName: "",
    contactEmail: "",
    sector: "services",
    size: "",
    itFunction: "",
    regulated: [],
    systems: [],
  });
  const [answers, setAnswers] = useState<AnswersMap>({});

  const score = useMemo(
    () =>
      step === "report" || step === "loading" ? computeScore(answers, classification.sector) : null,
    [answers, classification.sector, step],
  );

  useEffect(() => {
    if (step !== "report" || !score) return;

    const submissionKey = JSON.stringify({
      companyName: classification.companyName,
      contactEmail: classification.contactEmail,
      answers,
    });

    if (savedSubmissionKey.current === submissionKey) return;
    savedSubmissionKey.current = submissionKey;
    setSaveStatus("saving");

    saveScoringSubmission(classification, answers, score)
      .then(() => setSaveStatus("saved"))
      .catch((error) => {
        console.error("Unable to save scoring submission", error);
        setSaveStatus("error");
      });
  }, [answers, classification, score, step]);

  const steps: { key: Step; label: string }[] = [
    { key: "classification", label: "Profil" },
    { key: "evaluation", label: "Évaluation" },
    { key: "report", label: "Rapport" },
  ];
  const activeIdx = step === "loading" ? 1 : steps.findIndex((s) => s.key === step);

  return (
    <div className="min-h-screen text-foreground">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 text-slate-950 shadow-[0_14px_45px_-28px_rgba(15,23,42,0.45)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <motion.div
            initial={false}
            animate={{ opacity: 1, x: 0 }}
            className="flex min-w-0 items-center gap-3"
          >
            <div className="flex h-12 items-center rounded-xl border border-slate-200 bg-white px-3 shadow-[0_10px_26px_-20px_rgba(79,70,229,0.45)]">
              <img src={logo} alt="EvalitX AI" className="h-9 w-auto object-contain" />
            </div>
            <div className="hidden min-w-0 sm:block">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-violet-600">
                <span className="h-1.5 w-1.5 rounded-full bg-gradient-brand shadow-[0_0_14px_rgba(139,92,246,0.65)]" />
                Digital maturity
              </div>
              <div className="truncate text-sm font-semibold text-slate-700">
                Diagnostic data &amp; IA
              </div>
            </div>
          </motion.div>
          <nav className="hidden items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-1.5 shadow-inner md:flex">
            {steps.map((s, i) => (
              <div key={s.key} className="flex items-center gap-2">
                <div
                  className={`flex h-8 items-center gap-2 rounded-xl px-3 text-xs font-semibold transition ${
                    i === activeIdx
                      ? "bg-gradient-brand text-white shadow-[0_10px_24px_-12px_rgba(139,92,246,0.75)]"
                      : i < activeIdx
                        ? "bg-white text-violet-700 shadow-sm ring-1 ring-violet-100"
                        : "text-slate-500 hover:bg-white hover:text-slate-800"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                      i === activeIdx
                        ? "bg-white/25"
                        : i < activeIdx
                          ? "bg-violet-100 text-violet-700"
                          : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {i + 1}
                  </span>
                  {s.label}
                </div>
                {i < steps.length - 1 && <div className="h-px w-5 bg-slate-200" />}
              </div>
            ))}
            <Link
              to="/backoffice"
              className="ml-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-violet-200 hover:text-violet-700 hover:shadow-sm"
            >
              Backoffice
            </Link>
          </nav>
        </div>
      </header>

      <main className="px-4 py-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            {step === "classification" && (
              <Classification
                value={classification}
                onChange={setClassification}
                onNext={() => setStep("evaluation")}
              />
            )}
            {step === "evaluation" && (
              <Evaluation
                answers={answers}
                setAnswers={setAnswers}
                onComplete={() => setStep("loading")}
              />
            )}
            {step === "loading" && <Loading onDone={() => setStep("report")} />}
            {step === "report" && score && (
              <Report
                score={score}
                classification={classification}
                answers={answers}
                saveStatus={saveStatus}
                onRestart={() => {
                  setAnswers({});
                  setSaveStatus("idle");
                  savedSubmissionKey.current = null;
                  setStep("classification");
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="border-t border-white/5 py-6 text-center text-xs text-white/40">
        EvalitX AI · AI-powered digital &amp; data maturity assessment
      </footer>
    </div>
  );
}
