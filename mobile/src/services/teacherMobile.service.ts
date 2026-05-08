import { api } from "@/lib/api";
import type {
  ApiEnvelope,
  TeacherClassDetail,
  TeacherCreateEvaluationPayload,
  TeacherEvaluationDetail,
  TeacherClassesResponse,
  TeacherCoursesResponse,
  TeacherDashboardData,
  TeacherEvaluationFormOptions,
  TeacherGradeSheet,
  TeacherNotesOverview,
  TeacherProfileData,
} from "@/types/models";

async function getData<T>(path: string) {
  const { data } = await api.get<ApiEnvelope<T>>(path);
  return data.data;
}

export function loadTeacherDashboard() {
  return getData<TeacherDashboardData>("/api/enseignant/mobile/dashboard");
}

export function loadTeacherClasses() {
  return getData<TeacherClassesResponse>("/api/enseignant/mobile/classes");
}

export function loadTeacherClassDetail(courseId: string) {
  return getData<TeacherClassDetail>(`/api/enseignant/mobile/classes/${courseId}`);
}

export function loadTeacherCourses() {
  return getData<TeacherCoursesResponse>("/api/enseignant/mobile/courses");
}

export function loadTeacherNotesOverview() {
  return getData<TeacherNotesOverview>("/api/enseignant/mobile/notes-overview");
}

export function loadTeacherProfile() {
  return getData<TeacherProfileData>("/api/enseignant/mobile/profile");
}

export function loadTeacherEvaluationFormOptions() {
  return getData<TeacherEvaluationFormOptions>("/api/enseignant/mobile/evaluation-form-options");
}

export async function createTeacherEvaluation(payload: TeacherCreateEvaluationPayload) {
  const { data } = await api.post<ApiEnvelope<{ id: string }>>(
    "/api/enseignant/mobile/evaluations",
    payload,
  );
  return data.data;
}

export function loadTeacherEvaluationDetail(evaluationId: string) {
  return getData<TeacherEvaluationDetail>(`/api/enseignant/mobile/evaluations/${evaluationId}`);
}

export async function updateTeacherEvaluation(
  evaluationId: string,
  payload: TeacherCreateEvaluationPayload,
) {
  const { data } = await api.put<ApiEnvelope<{ id: string }>>(
    `/api/enseignant/mobile/evaluations/${evaluationId}`,
    payload,
  );
  return data.data;
}

export async function deleteTeacherEvaluation(evaluationId: string) {
  const { data } = await api.delete<ApiEnvelope<{ id: string }>>(
    `/api/enseignant/mobile/evaluations/${evaluationId}`,
  );
  return data.data;
}

export function loadTeacherGradeSheet(evaluationId: string) {
  return getData<TeacherGradeSheet>(`/api/enseignant/mobile/evaluations/${evaluationId}/grade-sheet`);
}

export async function saveTeacherGradeSheet(
  evaluationId: string,
  students: Array<{
    eleveId: string;
    score: number | null;
    status?: string;
    scaleLevelId?: string | null;
    textValue?: string | null;
    comment: string;
  }>,
) {
  const { data } = await api.put<ApiEnvelope<{ completionRate: number }>>(
    `/api/enseignant/mobile/evaluations/${evaluationId}/grade-sheet`,
    { students },
  );
  return data.data;
}

export async function validateTeacherGradeSheet(evaluationId: string) {
  const { data } = await api.post<
    ApiEnvelope<{
      evaluation?: { id: string };
      stats?: {
        expectedStudents?: number;
        validatedResults?: number;
        newlyValidatedResults?: number;
      };
    }>
  >(`/api/evaluation/${evaluationId}/results/validate`);
  return data.data;
}
