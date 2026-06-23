import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ClassificationData } from "@/components/maturity/Classification";
import { DEFAULT_AI_REPORT_CONFIG } from "@/lib/ai-report-config";
import {
  DIMENSIONS,
  IT_FUNCTIONS,
  REGULATED_DATA,
  SECTORS,
  SIZES,
  SYSTEMS,
} from "@/lib/maturity-data";
import { computeScore, type AnswersMap, type ScoreResult } from "@/lib/maturity-engine";

export interface SyntheticScoringRecord {
  classification: ClassificationData;
  answers: AnswersMap;
  score: ScoreResult;
  persona: string;
  dataScienceContext: string;
}

export interface SyntheticGenerationResult {
  records: SyntheticScoringRecord[];
  generatedAt: string;
  model: string;
}

const syntheticGenerationSchema = z.object({
  passcode: z.string(),
  apiKey: z.string().min(12),
  baseUrl: z.string().default(DEFAULT_AI_REPORT_CONFIG.baseUrl),
  model: z.string().default(DEFAULT_AI_REPORT_CONFIG.model),
  rowCount: z.number().int().min(1).max(80),
  sectors: z.array(z.string()).min(1),
  maturityScenario: z.enum(["mixed", "early", "growth", "advanced", "regulated-risk"]),
  noiseLevel: z.number().min(0).max(1),
  countryContext: z.string().max(80).default("Tunisie"),
  researchContext: z
    .string()
    .max(600)
    .default("PFE en data science appliquee a la maturite digitale et data"),
});

export const generateSyntheticScoringData = createServerFn({ method: "POST" })
  .inputValidator((input) => syntheticGenerationSchema.parse(input))
  .handler(async ({ data }): Promise<SyntheticGenerationResult> => {
    assertBackofficePasscode(data.passcode);

    const records = await callOpenAiSyntheticGenerator(data);

    return {
      records,
      generatedAt: new Date().toISOString(),
      model: data.model,
    };
  });

async function callOpenAiSyntheticGenerator(data: z.infer<typeof syntheticGenerationSchema>) {
  const response = await fetch(resolveOpenAiResponsesEndpoint(data.baseUrl), {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${data.apiKey}`,
    },
    body: JSON.stringify({
      model: data.model,
      instructions: buildSyntheticSystemPrompt(),
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify(buildSyntheticRequest(data), null, 2),
            },
          ],
        },
      ],
      temperature: 0.65,
      max_output_tokens: Math.min(6000, Math.max(1800, data.rowCount * 220)),
      store: false,
      text: {
        format: {
          type: "json_object",
        },
      },
    }),
  });

  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(
      extractErrorMessage(payload) || `OpenAI API a retourne HTTP ${response.status}.`,
    );
  }

  const content = extractOpenAiOutputText(payload);
  if (!content) {
    throw new Error("La reponse OpenAI ne contient pas de texte de sortie.");
  }

  return normalizeSyntheticRecords(content, data);
}

function buildSyntheticSystemPrompt() {
  return [
    "Tu es un generateur de donnees synthetiques pour un PFE en data science.",
    "Tu dois produire des observations plausibles d'entreprises tunisiennes ayant passe un test de maturite digitale et data.",
    "Les donnees doivent sembler humaines, variees et coherentes, mais rester fictives.",
    "N'utilise aucun vrai nom d'entreprise identifiable, aucun email reel, aucune personne reelle.",
    "Respecte strictement les listes d'enumerations et les identifiants de questions fournis.",
    'Retourne uniquement un objet JSON valide: {"records":[...]} sans markdown.',
  ].join("\n");
}

function buildSyntheticRequest(data: z.infer<typeof syntheticGenerationSchema>) {
  return {
    objective: "Generer un dataset synthétique insérable dans scoring_test_submissions.",
    rowCount: data.rowCount,
    countryContext: data.countryContext,
    researchContext: data.researchContext,
    maturityScenario: data.maturityScenario,
    noiseLevel: data.noiseLevel,
    allowedValues: {
      sectors: SECTORS.filter((sector) => data.sectors.includes(sector.id)).map(
        (sector) => sector.id,
      ),
      sizes: SIZES,
      itFunctions: IT_FUNCTIONS,
      regulatedData: REGULATED_DATA,
      systems: SYSTEMS,
      answerScale: "Chaque question doit recevoir un entier de 1 a 5.",
    },
    schema: {
      records: [
        {
          companyName: "Nom fictif, professionnel, non identifiable",
          contactName: "Nom fictif ou role generique",
          contactEmail: "Email fictif sur example.com",
          sector: "Un id de secteur autorise",
          size: "Une taille autorisee",
          itFunction: "Une fonction IT autorisee",
          regulated: ["0 a 3 valeurs autorisees"],
          systems: ["1 a 4 valeurs autorisees"],
          persona: "Persona data science court: PME industrielle, clinique, fintech, etc.",
          dataScienceContext:
            "Contexte analytique: qualite data, BI, gouvernance, ML readiness, pipeline, KPI, etc.",
          answers: Object.fromEntries(
            DIMENSIONS.flatMap((dimension) =>
              dimension.questions.map((question) => [question.id, 3]),
            ),
          ),
        },
      ],
    },
    questionCatalog: DIMENSIONS.map((dimension) => ({
      code: dimension.code,
      name: dimension.name,
      questions: dimension.questions.map((question) => ({
        id: question.id,
        weight: question.weight,
        text: question.text,
      })),
    })),
  };
}

function normalizeSyntheticRecords(
  content: string,
  data: z.infer<typeof syntheticGenerationSchema>,
): SyntheticScoringRecord[] {
  const parsed = JSON.parse(extractJsonObject(content)) as { records?: unknown };
  const rawRecords = Array.isArray(parsed.records) ? parsed.records : [];
  const allowedSectors = SECTORS.filter((sector) => data.sectors.includes(sector.id)).map(
    (sector) => sector.id,
  );
  const questionIds = DIMENSIONS.flatMap((dimension) =>
    dimension.questions.map((question) => question.id),
  );

  return rawRecords.slice(0, data.rowCount).map((raw, index) => {
    const item = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
    const sector = pickAllowed(
      item.sector,
      allowedSectors,
      allowedSectors[index % allowedSectors.length] ?? "services",
    );
    const answers = normalizeAnswers(
      item.answers,
      questionIds,
      data.maturityScenario,
      data.noiseLevel,
      index,
    );
    const classification: ClassificationData = {
      companyName: clampText(item.companyName, 90) || `Entreprise Synthétique ${index + 1}`,
      contactName: clampText(item.contactName, 90) || "Responsable Data",
      contactEmail: normalizeEmail(item.contactEmail, index),
      sector,
      size: pickAllowed(item.size, SIZES, SIZES[index % SIZES.length]),
      itFunction: pickAllowed(
        item.itFunction,
        IT_FUNCTIONS,
        IT_FUNCTIONS[index % IT_FUNCTIONS.length],
      ),
      regulated: normalizeAllowedArray(item.regulated, REGULATED_DATA, 3),
      systems: normalizeAllowedArray(item.systems, SYSTEMS, 4),
    };

    return {
      classification,
      answers,
      score: computeScore(answers, classification.sector),
      persona: clampText(item.persona, 180) || "Observation synthetique de maturite data",
      dataScienceContext:
        clampText(item.dataScienceContext, 260) ||
        "Cas d'etude PFE: gouvernance, BI et qualite des donnees",
    };
  });
}

function normalizeAnswers(
  value: unknown,
  questionIds: string[],
  scenario: z.infer<typeof syntheticGenerationSchema>["maturityScenario"],
  noiseLevel: number,
  rowIndex: number,
): AnswersMap {
  const input =
    typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const center = {
    mixed: 3,
    early: 2,
    growth: 3,
    advanced: 4,
    "regulated-risk": 3,
  }[scenario];

  return Object.fromEntries(
    questionIds.map((id, index) => {
      const numeric = Number(input[id]);
      if (Number.isFinite(numeric)) return [id, clampAnswer(numeric)];

      const wave = Math.sin((rowIndex + 1) * (index + 3)) * noiseLevel * 1.7;
      const regulatedPenalty = scenario === "regulated-risk" && id.startsWith("Q-D5") ? -1 : 0;
      return [id, clampAnswer(Math.round(center + wave + regulatedPenalty))];
    }),
  );
}

function normalizeAllowedArray(value: unknown, allowed: string[], maxItems: number) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => pickAllowed(item, allowed, ""))
    .filter(Boolean)
    .slice(0, maxItems);
}

function pickAllowed(value: unknown, allowed: string[], fallback: string) {
  return typeof value === "string" && allowed.includes(value) ? value : fallback;
}

function normalizeEmail(value: unknown, index: number) {
  const candidate = clampText(value, 120).toLowerCase();
  if (candidate.endsWith("@example.com")) return candidate;
  return `contact.synthetic.${index + 1}@example.com`;
}

function clampAnswer(value: number) {
  return Math.min(5, Math.max(1, Math.round(value)));
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    if (!response.ok)
      throw new Error(`OpenAI API a retourne une reponse non JSON: ${text.slice(0, 180)}`);
    throw new Error("OpenAI API a retourne une reponse non JSON.");
  }
}

function extractJsonObject(content: string): string {
  const trimmed = content.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenceMatch?.[1]?.trim() ?? trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("La sortie OpenAI n'est pas un objet JSON valide.");
  }
  return candidate.slice(start, end + 1);
}

function extractOpenAiOutputText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const fields = payload as Record<string, unknown>;

  if (typeof fields.output_text === "string") {
    return fields.output_text.trim();
  }

  if (Array.isArray(fields.output)) {
    const parts = fields.output.flatMap((item) => extractOutputItemText(item));
    const joined = parts.filter(Boolean).join("\n").trim();
    if (joined) return joined;
  }

  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return "";
  const first = choices[0] as { message?: { content?: unknown }; text?: unknown };
  if (typeof first.message?.content === "string") return first.message.content;
  if (typeof first.text === "string") return first.text;
  return "";
}

function extractOutputItemText(item: unknown): string[] {
  if (!item || typeof item !== "object") return [];
  const fields = item as Record<string, unknown>;
  if (typeof fields.text === "string") return [fields.text];
  if (typeof fields.content === "string") return [fields.content];
  if (!Array.isArray(fields.content)) return [];

  return fields.content
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      const partFields = part as Record<string, unknown>;
      if (typeof partFields.text === "string") return partFields.text;
      if (typeof partFields.output_text === "string") return partFields.output_text;
      if (typeof partFields.content === "string") return partFields.content;
      return "";
    })
    .filter(Boolean);
}

function extractErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const fields = payload as Record<string, unknown>;
  const error = fields.error;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const errorFields = error as Record<string, unknown>;
    if (typeof errorFields.message === "string") return errorFields.message;
  }
  if (typeof fields.message === "string") return fields.message;
  return "";
}

function resolveOpenAiResponsesEndpoint(baseUrl: string): string {
  const normalized = (baseUrl || DEFAULT_AI_REPORT_CONFIG.baseUrl).trim().replace(/\/+$/, "");
  if (normalized.endsWith("/chat/completions")) {
    return normalized.replace(/\/chat\/completions$/, "/responses");
  }
  return normalized.endsWith("/responses") ? normalized : `${normalized}/responses`;
}

function assertBackofficePasscode(passcode: string) {
  const expected = readRuntimeEnv("BACKOFFICE_PASSCODE");
  if (!expected) throw new Error("BACKOFFICE_PASSCODE n'est pas configure.");
  if (passcode !== expected) throw new Error("Passcode incorrect.");
}

function readRuntimeEnv(name: string): string {
  const globalWithEnv = globalThis as typeof globalThis & {
    __APP_RUNTIME_ENV__?: Record<string, unknown>;
    process?: { env?: Record<string, string | undefined> };
  };
  const fromProcess = globalWithEnv.process?.env?.[name];
  if (fromProcess) return fromProcess;
  const fromWorkerEnv = globalWithEnv.__APP_RUNTIME_ENV__?.[name];
  return typeof fromWorkerEnv === "string" ? fromWorkerEnv : "";
}

function clampText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}
