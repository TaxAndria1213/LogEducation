import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/AuthProvider";
import {
  loadTeacherClassDetail,
  loadTeacherEvaluationDetail,
  loadTeacherEvaluationFormOptions,
  loadTeacherClasses,
  loadTeacherCourses,
  loadTeacherDashboard,
  loadTeacherGradeSheet,
  loadTeacherNotesOverview,
  loadTeacherProfile,
} from "@/services/teacherMobile.service";

function useTeacherQuery<T>(key: string, loader: () => Promise<T>) {
  const { status, activeRole, session } = useAuth();

  return useQuery({
    queryKey: [key, session?.user.id, activeRole],
    queryFn: loader,
    enabled: status === "authenticated" && activeRole === "ENSEIGNANT",
  });
}

export function useTeacherDashboard() {
  return useTeacherQuery("teacher-mobile-dashboard", loadTeacherDashboard);
}

export function useTeacherClasses() {
  return useTeacherQuery("teacher-mobile-classes", loadTeacherClasses);
}

export function useTeacherClassDetail(courseId: string | null) {
  const { status, activeRole, session } = useAuth();

  return useQuery({
    queryKey: ["teacher-mobile-class-detail", session?.user.id, courseId],
    queryFn: () => loadTeacherClassDetail(courseId!),
    enabled:
      status === "authenticated" &&
      activeRole === "ENSEIGNANT" &&
      !!courseId,
  });
}

export function useTeacherCourses() {
  return useTeacherQuery("teacher-mobile-courses", loadTeacherCourses);
}

export function useTeacherNotesOverview() {
  return useTeacherQuery("teacher-mobile-notes-overview", loadTeacherNotesOverview);
}

export function useTeacherProfile() {
  return useTeacherQuery("teacher-mobile-profile", loadTeacherProfile);
}

export function useTeacherEvaluationFormOptions() {
  return useTeacherQuery("teacher-mobile-evaluation-options", loadTeacherEvaluationFormOptions);
}

export function useTeacherEvaluationDetail(evaluationId: string | null) {
  const { status, activeRole, session } = useAuth();

  return useQuery({
    queryKey: ["teacher-mobile-evaluation-detail", session?.user.id, evaluationId],
    queryFn: () => loadTeacherEvaluationDetail(evaluationId!),
    enabled:
      status === "authenticated" &&
      activeRole === "ENSEIGNANT" &&
      !!evaluationId,
  });
}

export function useTeacherGradeSheet(evaluationId: string | null) {
  const { status, activeRole, session } = useAuth();

  return useQuery({
    queryKey: ["teacher-mobile-grade-sheet", session?.user.id, evaluationId],
    queryFn: () => loadTeacherGradeSheet(evaluationId!),
    enabled:
      status === "authenticated" &&
      activeRole === "ENSEIGNANT" &&
      !!evaluationId,
  });
}
