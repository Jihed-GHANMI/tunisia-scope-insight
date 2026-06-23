import type { ClassificationData } from "@/components/maturity/Classification";
import type { AnswersMap, ScoreResult } from "@/lib/maturity-engine";
import { getSupabaseClient } from "@/lib/supabase";

export async function saveScoringSubmission(
  classification: ClassificationData,
  answers: AnswersMap,
  score: ScoreResult,
) {
  const { error } = await getSupabaseClient()
    .from("scoring_test_submissions")
    .insert(buildSubmissionRow(classification, answers, score));

  if (error) {
    throw error;
  }
}

export async function saveScoringSubmissions(
  submissions: { classification: ClassificationData; answers: AnswersMap; score: ScoreResult }[],
) {
  const { error } = await getSupabaseClient()
    .from("scoring_test_submissions")
    .insert(
      submissions.map(({ classification, answers, score }) =>
        buildSubmissionRow(classification, answers, score),
      ),
    );

  if (error) {
    throw error;
  }
}

function buildSubmissionRow(
  classification: ClassificationData,
  answers: AnswersMap,
  score: ScoreResult,
) {
  return {
    company_name: classification.companyName.trim(),
    contact_name: classification.contactName.trim() || null,
    contact_email: classification.contactEmail.trim() || null,
    sector: classification.sector,
    company_size: classification.size,
    it_function: classification.itFunction || null,
    regulated_data: classification.regulated,
    systems: classification.systems,
    answers,
    score,
    global_score: Number(score.sgm.toFixed(2)),
    data_maturity: Number(score.dataMaturity.toFixed(2)),
    digital_maturity: Number(score.digitalMaturity.toFixed(2)),
    maturity_level: score.level.level,
    maturity_level_name: score.level.name,
  };
}
