import { ROLE_LABELS, ROLE_QUICK_ACTIONS } from "@/constants/roles";
import {
  getWeekdayLabel,
  mergeScheduleRows,
} from "@/services/mobileSchedule.service";
import { getFirst, getRows } from "@/services/query.service";
import type {
  BulletinItem,
  EleveLite,
  EmploiDuTempsItem,
  EvaluationItem,
  FeedBundle,
  FeedItem,
  FeedMetric,
  HomeBundle,
  JustificatifItem,
  NoteItem,
  ParentTuteurLite,
  PersistedSession,
  PresenceEleveItem,
  PresencePersonnelItem,
  RoleName,
  SessionAppelItem,
  StaffItem,
} from "@/types/models";

const EMPLOI_INCLUDE = {
  classe: { include: { niveau: true, site: true } },
  matiere: true,
  enseignant: {
    include: {
      personnel: {
        include: {
          utilisateur: {
            include: {
              profil: true,
            },
          },
        },
      },
    },
  },
  creneau: true,
  salle: true,
} as const;

const SESSION_INCLUDE = {
  classe: { include: { niveau: true, site: true } },
  emploi: {
    include: {
      cours: { include: { matiere: true } },
      creneau: true,
      salle: true,
    },
  },
  creneau: true,
  presences: true,
} as const;

const NOTE_INCLUDE = {
  evaluation: {
    include: {
      cours: {
        include: {
          classe: { include: { niveau: true } },
          matiere: true,
        },
      },
    },
  },
  eleve: {
    include: {
      utilisateur: { include: { profil: true } },
    },
  },
} as const;

const BULLETIN_INCLUDE = {
  eleve: {
    include: {
      utilisateur: { include: { profil: true } },
      inscriptions: { include: { classe: true } },
    },
  },
  classe: { include: { niveau: true, site: true } },
  periode: true,
  lignes: { include: { matiere: true } },
} as const;

const JUSTIFICATIF_INCLUDE = {
  eleve: {
    include: {
      utilisateur: { include: { profil: true } },
      inscriptions: { include: { classe: true } },
    },
  },
  motif: true,
} as const;

const ELEVE_INCLUDE = {
  utilisateur: { include: { profil: true } },
  inscriptions: {
    include: {
      classe: { include: { niveau: true, site: true } },
    },
  },
} as const;

const PARENT_INCLUDE = {
  eleves: {
    include: {
      eleve: {
        include: {
          utilisateur: { include: { profil: true } },
          inscriptions: {
            include: {
              classe: { include: { niveau: true, site: true } },
            },
          },
        },
      },
    },
  },
} as const;

const STAFF_INCLUDE = {
  utilisateur: { include: { profil: true } },
} as const;

const EVALUATION_INCLUDE = {
  cours: {
    include: {
      classe: { include: { niveau: true } },
      matiere: true,
    },
  },
} as const;

type RoleContext = {
  role: RoleName;
  userId: string;
  etablissementId: string;
};

function toContext(session: PersistedSession): RoleContext {
  const etablissementId = session.user.etablissement_id?.trim();
  if (!etablissementId) {
    throw new Error("Aucun etablissement actif n'est rattache au compte.");
  }

  return {
    role: session.activeRole,
    userId: session.user.id,
    etablissementId,
  };
}

function formatPersonName(
  profile?: { prenom?: string | null; nom?: string | null } | null,
) {
  return [profile?.prenom?.trim(), profile?.nom?.trim()]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function formatDate(value?: string | null) {
  if (!value) return "Date non renseignee";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatTimeRange(
  creneau?: { heure_debut?: string | null; heure_fin?: string | null; nom?: string | null } | null,
) {
  const start = creneau?.heure_debut?.trim() ?? "";
  const end = creneau?.heure_fin?.trim() ?? "";
  return [start, end].filter(Boolean).join(" - ") || creneau?.nom || "";
}

function formatSessionTimeRange(item: SessionAppelItem) {
  return (
    [
      item.emploi?.heure_debut?.trim() ?? "",
      item.emploi?.heure_fin?.trim() ?? "",
    ]
      .filter(Boolean)
      .join(" - ") ||
    formatTimeRange(item.creneau)
  );
}

function getMergedScheduleFeedItems(items: EmploiDuTempsItem[]) {
  return mergeScheduleRows(items).map((item) => ({
    id: item.id,
    title: item.subjectName,
    subtitle: item.className,
    meta: [
      item.dayLabel,
      item.slotLabel,
      item.teacherName,
      item.roomName !== "Salle non renseignee" ? item.roomName : "",
      item.rawRows.length > 1 ? `${item.rawRows.length} creneaux` : "",
    ]
      .filter(Boolean)
      .join(" | "),
    accent:
      item.timingState === "current"
        ? "success"
        : item.timingState === "upcoming"
          ? "primary"
          : "info",
  })) satisfies FeedItem[];
}

function averageFromBulletin(bulletin?: BulletinItem | null) {
  const lines = bulletin?.lignes ?? [];
  const valid = lines.filter((line) => typeof line.moyenne === "number");
  if (!valid.length) return null;
  return (
    Math.round(
      (valid.reduce((sum, line) => sum + (line.moyenne ?? 0), 0) / valid.length) *
        100,
    ) / 100
  );
}

function scheduleItemToFeed(item: EmploiDuTempsItem): FeedItem {
  return {
    id: item.id,
    title: item.matiere?.nom?.trim() || "Cours",
    subtitle: item.classe?.nom?.trim() || "Classe non renseignee",
    meta: [
      getWeekdayLabel(item.jour_semaine),
      [item.heure_debut?.trim() ?? "", item.heure_fin?.trim() ?? ""].filter(Boolean).join(" - ") || formatTimeRange(item.creneau),
      item.salle?.nom,
    ]
      .filter(Boolean)
      .join(" | "),
    accent: "primary",
  };
}

function sessionItemToFeed(item: SessionAppelItem): FeedItem {
  const total = item.presences?.length ?? 0;
  const absents =
    item.presences?.filter((presence) => presence.statut === "ABSENT").length ?? 0;

  return {
    id: item.id,
    title: item.classe?.nom?.trim() || "Session d'appel",
    subtitle:
      item.emploi?.cours?.matiere?.nom?.trim() ||
      formatSessionTimeRange(item) ||
      item.creneau?.nom?.trim() ||
      "Seance",
    meta: [formatDate(item.date), `${total} eleve(s)`, absents ? `${absents} absent(s)` : ""]
      .filter(Boolean)
      .join(" | "),
    accent: absents ? "warning" : "info",
  };
}

function noteItemToFeed(item: NoteItem): FeedItem {
  const score =
    typeof item.score === "number" && typeof item.evaluation?.note_max === "number"
      ? `${item.score}/${item.evaluation.note_max}`
      : "Note saisie";

  return {
    id: item.id,
    title:
      item.evaluation?.cours?.matiere?.nom?.trim() ||
      item.evaluation?.titre?.trim() ||
      "Evaluation",
    subtitle:
      item.eleve?.utilisateur?.profil
        ? formatPersonName(item.eleve.utilisateur.profil)
        : item.eleve?.code_eleve?.trim() || "Eleve",
    meta: [score, formatDate(item.note_le)].filter(Boolean).join(" | "),
    accent: "success",
  };
}

function bulletinItemToFeed(item: BulletinItem): FeedItem {
  const average = averageFromBulletin(item);
  return {
    id: item.id,
    title: item.eleve?.utilisateur?.profil
      ? formatPersonName(item.eleve.utilisateur.profil)
      : item.eleve?.code_eleve?.trim() || "Bulletin",
    subtitle: item.periode?.nom?.trim() || item.classe?.nom?.trim() || "Periode",
    meta: [
      item.classe?.nom?.trim(),
      average !== null ? `Moy. ${average.toFixed(2)}` : "",
      item.statut?.trim(),
    ]
      .filter(Boolean)
      .join(" | "),
    accent: "info",
  };
}

function justificatifItemToFeed(item: JustificatifItem): FeedItem {
  return {
    id: item.id,
    title:
      item.eleve?.utilisateur?.profil
        ? formatPersonName(item.eleve.utilisateur.profil)
        : item.eleve?.code_eleve?.trim() || "Justificatif",
    subtitle: item.motif?.nom?.trim() || "Motif non renseigne",
    meta: [formatDate(item.date_debut), item.statut?.trim()].filter(Boolean).join(" | "),
    accent:
      item.statut === "APPROUVE"
        ? "success"
        : item.statut === "REFUSE"
          ? "danger"
          : "warning",
  };
}

function presenceEleveToFeed(item: PresenceEleveItem): FeedItem {
  return {
    id: item.id,
    title:
      item.eleve?.utilisateur?.profil
        ? formatPersonName(item.eleve.utilisateur.profil)
        : item.eleve?.code_eleve?.trim() || "Presence eleve",
    subtitle: item.session?.classe?.nom?.trim() || "Classe",
    meta: [
      item.statut?.trim(),
      item.minutes_retard ? `${item.minutes_retard} min` : "",
      item.session?.date ? formatDate(item.session.date) : "",
    ]
      .filter(Boolean)
      .join(" | "),
    accent:
      item.statut === "ABSENT"
        ? "danger"
        : item.statut === "RETARD"
          ? "warning"
          : "success",
  };
}

function presencePersonnelToFeed(item: PresencePersonnelItem): FeedItem {
  return {
    id: item.id,
    title:
      item.personnel?.utilisateur?.profil
        ? formatPersonName(item.personnel.utilisateur.profil)
        : item.personnel?.code_personnel?.trim() || "Presence personnel",
    subtitle: item.personnel?.poste?.trim() || "Personnel",
    meta: [item.statut?.trim(), formatDate(item.date)].filter(Boolean).join(" | "),
    accent: item.statut === "ABSENT" ? "danger" : "info",
  };
}

function staffToFeed(item: StaffItem): FeedItem {
  return {
    id: item.id,
    title:
      formatPersonName(item.utilisateur?.profil) ||
      item.code_personnel?.trim() ||
      "Personnel",
    subtitle: item.poste?.trim() || "Equipe",
    accent: "primary",
  };
}

async function getStudentRecord(context: RoleContext) {
  return getFirst<EleveLite>("eleve", {
    where: {
      utilisateur_id: context.userId,
      etablissement_id: context.etablissementId,
    },
    includeSpec: ELEVE_INCLUDE,
  });
}

async function getParentRecord(context: RoleContext) {
  return getFirst<ParentTuteurLite>("parent-tuteur", {
    where: {
      utilisateur_id: context.userId,
      etablissement_id: context.etablissementId,
    },
    includeSpec: PARENT_INCLUDE,
  });
}

async function getTeacherRecord(context: RoleContext) {
  return getFirst<{ id: string }>("enseignant", {
    where: {
      personnel: {
        is: {
          utilisateur_id: context.userId,
          etablissement_id: context.etablissementId,
        },
      },
    },
  });
}

function collectActiveClassIds(student?: EleveLite | null) {
  return (
    student?.inscriptions
      ?.filter((item) => item.statut !== "SORTI")
      .map((item) => item.classe_id)
      .filter(Boolean) ?? []
  );
}

function collectParentChildIds(parent?: ParentTuteurLite | null) {
  return (
    parent?.eleves
      ?.map((item) => item.eleve_id)
      .filter((item): item is string => Boolean(item)) ?? []
  );
}

function collectParentClassIds(parent?: ParentTuteurLite | null) {
  return (
    parent?.eleves
      ?.flatMap((item) =>
        item.eleve?.inscriptions
          ?.filter((inscription) => inscription.statut !== "SORTI")
          .map((inscription) => inscription.classe_id) ?? [],
      )
      .filter(Boolean) ?? []
  );
}

async function loadTeacherHome(context: RoleContext): Promise<HomeBundle> {
  const teacher = await getTeacherRecord(context);

  const teacherId = teacher?.id;

  const [planningRows, sessions, evaluations] = await Promise.all([
    getRows<EmploiDuTempsItem>("emploi-du-temps", {
      take: 12,
      where: teacherId
        ? { enseignant_id: teacherId, classe: { etablissement_id: context.etablissementId } }
        : { classe: { etablissement_id: context.etablissementId, id: "__none__" } },
      includeSpec: EMPLOI_INCLUDE,
      orderBy: [{ jour_semaine: "asc" }, { creneau: { heure_debut: "asc" } }],
    }),
    getRows<SessionAppelItem>("session-appel", {
      take: 8,
      where: teacherId
        ? {
            pris_par_enseignant_id: teacherId,
            classe: { etablissement_id: context.etablissementId },
          }
        : { classe: { etablissement_id: context.etablissementId, id: "__none__" } },
      includeSpec: SESSION_INCLUDE,
      orderBy: [{ date: "desc" }],
    }),
    getRows<EvaluationItem>("evaluation", {
      take: 8,
      where: teacherId
        ? {
            cree_par_enseignant_id: teacherId,
            cours: { etablissement_id: context.etablissementId },
          }
        : { cours: { etablissement_id: context.etablissementId, id: "__none__" } },
      includeSpec: EVALUATION_INCLUDE,
      orderBy: [{ date: "desc" }],
    }),
  ]);
  const planning = mergeScheduleRows(planningRows);

  const metrics: FeedMetric[] = [
    { id: "planning", label: "Cours visibles", value: String(planning.length), tone: "primary" },
    { id: "sessions", label: "Appels recents", value: String(sessions.length), tone: "warning" },
    { id: "evals", label: "Evaluations", value: String(evaluations.length), tone: "success" },
  ];

  return {
    heading: "Vue enseignant",
    subtitle: "Cours, appels et evaluations en un coup d'oeil.",
    metrics,
    quickActions: ROLE_QUICK_ACTIONS.ENSEIGNANT,
    highlights: [
      ...getMergedScheduleFeedItems(planningRows).slice(0, 2),
      ...sessions.slice(0, 3).map(sessionItemToFeed),
    ],
  };
}

async function loadStudentHome(context: RoleContext): Promise<HomeBundle> {
  const student = await getStudentRecord(context);
  const classIds = collectActiveClassIds(student);

  const [planning, notes, bulletins] = await Promise.all([
    classIds.length
      ? getRows<EmploiDuTempsItem>("emploi-du-temps", {
          take: 12,
          where: {
            classe_id: { in: classIds },
            classe: { etablissement_id: context.etablissementId },
          },
          includeSpec: EMPLOI_INCLUDE,
          orderBy: [{ jour_semaine: "asc" }, { creneau: { heure_debut: "asc" } }],
        })
      : Promise.resolve([]),
    student
      ? getRows<NoteItem>("note", {
          take: 8,
          where: { eleve_id: student.id },
          includeSpec: NOTE_INCLUDE,
          orderBy: [{ note_le: "desc" }],
        })
      : Promise.resolve([]),
    student
      ? getRows<BulletinItem>("bulletin", {
          take: 6,
          where: {
            eleve_id: student.id,
            classe: { etablissement_id: context.etablissementId },
          },
          includeSpec: BULLETIN_INCLUDE,
          orderBy: [{ created_at: "desc" }],
        })
      : Promise.resolve([]),
  ]);

  const metrics: FeedMetric[] = [
    { id: "classes", label: "Classes actives", value: String(classIds.length), tone: "info" },
    { id: "notes", label: "Notes recentes", value: String(notes.length), tone: "success" },
    { id: "bulletins", label: "Bulletins", value: String(bulletins.length), tone: "primary" },
  ];

  return {
    heading: "Vue eleve",
    subtitle: "Planning, notes et bulletins accessibles rapidement.",
    metrics,
    quickActions: ROLE_QUICK_ACTIONS.ELEVE,
    highlights: [
      ...getMergedScheduleFeedItems(planning).slice(0, 2),
      ...notes.slice(0, 3).map(noteItemToFeed),
    ],
  };
}

async function loadParentHome(context: RoleContext): Promise<HomeBundle> {
  const parent = await getParentRecord(context);
  const childIds = collectParentChildIds(parent);
  const classIds = collectParentClassIds(parent);

  const [planning, bulletins, justificatifs] = await Promise.all([
    classIds.length
      ? getRows<EmploiDuTempsItem>("emploi-du-temps", {
          take: 12,
          where: {
            classe_id: { in: classIds },
            classe: { etablissement_id: context.etablissementId },
          },
          includeSpec: EMPLOI_INCLUDE,
          orderBy: [{ jour_semaine: "asc" }, { creneau: { heure_debut: "asc" } }],
        })
      : Promise.resolve([]),
    childIds.length
      ? getRows<BulletinItem>("bulletin", {
          take: 8,
          where: {
            eleve_id: { in: childIds },
            classe: { etablissement_id: context.etablissementId },
          },
          includeSpec: BULLETIN_INCLUDE,
          orderBy: [{ created_at: "desc" }],
        })
      : Promise.resolve([]),
    childIds.length
      ? getRows<JustificatifItem>("justificatif-absence", {
          take: 8,
          where: {
            eleve_id: { in: childIds },
            eleve: { etablissement_id: context.etablissementId },
          },
          includeSpec: JUSTIFICATIF_INCLUDE,
          orderBy: [{ created_at: "desc" }],
        })
      : Promise.resolve([]),
  ]);

  const metrics: FeedMetric[] = [
    { id: "children", label: "Enfants relies", value: String(childIds.length), tone: "primary" },
    { id: "bulletins", label: "Bulletins", value: String(bulletins.length), tone: "info" },
    { id: "justifs", label: "Justificatifs", value: String(justificatifs.length), tone: "warning" },
  ];

  return {
    heading: "Vue parent",
    subtitle: "Suivi des enfants, resultats et justificatifs.",
    metrics,
    quickActions: ROLE_QUICK_ACTIONS.PARENT,
    highlights: [
      ...getMergedScheduleFeedItems(planning).slice(0, 1),
      ...bulletins.slice(0, 3).map(bulletinItemToFeed),
      ...justificatifs.slice(0, 2).map(justificatifItemToFeed),
    ],
  };
}

async function loadSupervisorHome(context: RoleContext): Promise<HomeBundle> {
  const [planning, sessions, justifs] = await Promise.all([
    getRows<EmploiDuTempsItem>("emploi-du-temps", {
      take: 10,
      where: { classe: { etablissement_id: context.etablissementId } },
      includeSpec: EMPLOI_INCLUDE,
      orderBy: [{ jour_semaine: "asc" }, { creneau: { heure_debut: "asc" } }],
    }),
    getRows<SessionAppelItem>("session-appel", {
      take: 10,
      where: { classe: { etablissement_id: context.etablissementId } },
      includeSpec: SESSION_INCLUDE,
      orderBy: [{ date: "desc" }],
    }),
    getRows<JustificatifItem>("justificatif-absence", {
      take: 10,
      where: { eleve: { etablissement_id: context.etablissementId } },
      includeSpec: JUSTIFICATIF_INCLUDE,
      orderBy: [{ created_at: "desc" }],
    }),
  ]);

  const metrics: FeedMetric[] = [
    { id: "planning", label: "Planning", value: String(planning.length), tone: "primary" },
    { id: "sessions", label: "Sessions", value: String(sessions.length), tone: "warning" },
    { id: "justifs", label: "Justificatifs", value: String(justifs.length), tone: "info" },
  ];

  return {
    heading: "Vue surveillant",
    subtitle: "Controle terrain, appels et suivi des absences.",
    metrics,
    quickActions: ROLE_QUICK_ACTIONS.SURVEILLANT,
    highlights: [
      ...getMergedScheduleFeedItems(planning).slice(0, 1),
      ...sessions.slice(0, 3).map(sessionItemToFeed),
      ...justifs.slice(0, 2).map(justificatifItemToFeed),
    ],
  };
}

async function loadStaffHome(context: RoleContext): Promise<HomeBundle> {
  const [classes, sessions, justifs, staff] = await Promise.all([
    getRows<{ id: string; nom?: string | null }>("classe", {
      take: 8,
      where: { etablissement_id: context.etablissementId },
      orderBy: [{ created_at: "desc" }],
    }),
    getRows<SessionAppelItem>("session-appel", {
      take: 8,
      where: { classe: { etablissement_id: context.etablissementId } },
      includeSpec: SESSION_INCLUDE,
      orderBy: [{ date: "desc" }],
    }),
    getRows<JustificatifItem>("justificatif-absence", {
      take: 8,
      where: { eleve: { etablissement_id: context.etablissementId } },
      includeSpec: JUSTIFICATIF_INCLUDE,
      orderBy: [{ created_at: "desc" }],
    }),
    getRows<StaffItem>("personnel", {
      take: 8,
      where: { etablissement_id: context.etablissementId },
      includeSpec: STAFF_INCLUDE,
      orderBy: [{ created_at: "desc" }],
    }),
  ]);

  const metrics: FeedMetric[] = [
    { id: "classes", label: "Classes", value: String(classes.length), tone: "primary" },
    { id: "sessions", label: "Sessions", value: String(sessions.length), tone: "warning" },
    { id: "staff", label: "Personnel", value: String(staff.length), tone: "success" },
  ];

  return {
    heading: `Vue ${ROLE_LABELS[context.role].toLowerCase()}`,
    subtitle: "Pilotage mobile des operations de l'etablissement.",
    metrics,
    quickActions: ROLE_QUICK_ACTIONS[context.role],
    highlights: [
      ...sessions.slice(0, 2).map(sessionItemToFeed),
      ...justifs.slice(0, 2).map(justificatifItemToFeed),
      ...staff.slice(0, 1).map(staffToFeed),
    ],
  };
}

export async function loadHomeBundle(session: PersistedSession) {
  const context = toContext(session);
  switch (context.role) {
    case "ENSEIGNANT":
      return loadTeacherHome(context);
    case "ELEVE":
      return loadStudentHome(context);
    case "PARENT":
      return loadParentHome(context);
    case "SURVEILLANT":
      return loadSupervisorHome(context);
    default:
      return loadStaffHome(context);
  }
}

export async function loadAgendaBundle(session: PersistedSession): Promise<FeedBundle> {
  const context = toContext(session);

  if (context.role === "ENSEIGNANT") {
    const teacher = await getTeacherRecord(context);
    const items = await getRows<EmploiDuTempsItem>("emploi-du-temps", {
      take: 20,
      where: teacher?.id
        ? { enseignant_id: teacher.id, classe: { etablissement_id: context.etablissementId } }
        : { classe: { etablissement_id: context.etablissementId, id: "__none__" } },
      includeSpec: EMPLOI_INCLUDE,
      orderBy: [{ jour_semaine: "asc" }, { creneau: { heure_debut: "asc" } }],
    });
    return {
      title: "Agenda enseignant",
      subtitle: "Planning des cours et salles.",
      items: getMergedScheduleFeedItems(items),
    };
  }

  if (context.role === "ELEVE") {
    const student = await getStudentRecord(context);
    const classIds = collectActiveClassIds(student);
    const items = classIds.length
      ? await getRows<EmploiDuTempsItem>("emploi-du-temps", {
          take: 20,
          where: {
            classe_id: { in: classIds },
            classe: { etablissement_id: context.etablissementId },
          },
          includeSpec: EMPLOI_INCLUDE,
          orderBy: [{ jour_semaine: "asc" }, { creneau: { heure_debut: "asc" } }],
        })
      : [];
    return {
      title: "Agenda eleve",
      subtitle: "Cours de la semaine en mobilite.",
      items: getMergedScheduleFeedItems(items),
    };
  }

  if (context.role === "PARENT") {
    const parent = await getParentRecord(context);
    const classIds = collectParentClassIds(parent);
    const items = classIds.length
      ? await getRows<EmploiDuTempsItem>("emploi-du-temps", {
          take: 20,
          where: {
            classe_id: { in: classIds },
            classe: { etablissement_id: context.etablissementId },
          },
          includeSpec: EMPLOI_INCLUDE,
          orderBy: [{ jour_semaine: "asc" }, { creneau: { heure_debut: "asc" } }],
        })
      : [];
    return {
      title: "Agenda famille",
      subtitle: "Planning des enfants rattaches.",
      items: getMergedScheduleFeedItems(items),
    };
  }

  const items = await getRows<EmploiDuTempsItem>("emploi-du-temps", {
    take: 20,
    where: { classe: { etablissement_id: context.etablissementId } },
    includeSpec: EMPLOI_INCLUDE,
    orderBy: [{ jour_semaine: "asc" }, { creneau: { heure_debut: "asc" } }],
  });
  return {
    title: "Agenda etablissement",
    subtitle: "Vision rapide des emplois du temps.",
    items: getMergedScheduleFeedItems(items),
  };
}

export async function loadPresenceBundle(session: PersistedSession): Promise<FeedBundle> {
  const context = toContext(session);

  if (context.role === "ELEVE") {
    const student = await getStudentRecord(context);
    const items = student
      ? await getRows<PresenceEleveItem>("presence-eleve", {
          take: 20,
          where: {
            eleve_id: student.id,
            session: { classe: { etablissement_id: context.etablissementId } },
          },
          includeSpec: {
            eleve: { include: { utilisateur: { include: { profil: true } } } },
            session: {
              include: SESSION_INCLUDE,
            },
          },
          orderBy: [{ created_at: "desc" }],
        })
      : [];
    return {
      title: "Mes presences",
      subtitle: "Absences, retards et suivi personnel.",
      items: items.map(presenceEleveToFeed),
    };
  }

  if (context.role === "PARENT") {
    const parent = await getParentRecord(context);
    const childIds = collectParentChildIds(parent);
    const items = childIds.length
      ? await getRows<JustificatifItem>("justificatif-absence", {
          take: 20,
          where: {
            eleve_id: { in: childIds },
            eleve: { etablissement_id: context.etablissementId },
          },
          includeSpec: JUSTIFICATIF_INCLUDE,
          orderBy: [{ created_at: "desc" }],
        })
      : [];
    return {
      title: "Justificatifs des enfants",
      subtitle: "Validation et suivi des absences.",
      items: items.map(justificatifItemToFeed),
    };
  }

  if (context.role === "COMPTABLE") {
    const items = await getRows<PresencePersonnelItem>("presence-personnel", {
      take: 20,
      where: { personnel: { etablissement_id: context.etablissementId } },
      includeSpec: {
        personnel: { include: { utilisateur: { include: { profil: true } } } },
      },
      orderBy: [{ date: "desc" }],
    });
    return {
      title: "Suivi personnel",
      subtitle: "Lecture rapide des presences staff.",
      items: items.map(presencePersonnelToFeed),
    };
  }

  const [sessions, justifs] = await Promise.all([
    getRows<SessionAppelItem>("session-appel", {
      take: 12,
      where: { classe: { etablissement_id: context.etablissementId } },
      includeSpec: SESSION_INCLUDE,
      orderBy: [{ date: "desc" }],
    }),
    getRows<JustificatifItem>("justificatif-absence", {
      take: 8,
      where: { eleve: { etablissement_id: context.etablissementId } },
      includeSpec: JUSTIFICATIF_INCLUDE,
      orderBy: [{ created_at: "desc" }],
    }),
  ]);

  return {
    title: "Pilotage des presences",
    subtitle: "Sessions d'appel et justificatifs recents.",
    items: [...sessions.map(sessionItemToFeed), ...justifs.map(justificatifItemToFeed)],
  };
}

export async function loadAcademicBundle(session: PersistedSession): Promise<FeedBundle> {
  const context = toContext(session);

  if (context.role === "ENSEIGNANT") {
    const teacher = await getTeacherRecord(context);

    const items = await getRows<EvaluationItem>("evaluation", {
      take: 20,
      where: teacher?.id
        ? {
            cree_par_enseignant_id: teacher.id,
            cours: { etablissement_id: context.etablissementId },
          }
        : { cours: { etablissement_id: context.etablissementId, id: "__none__" } },
      includeSpec: EVALUATION_INCLUDE,
      orderBy: [{ date: "desc" }],
    });

    return {
      title: "Evaluations",
      subtitle: "Creation et suivi des evaluations.",
      items: items.map((item) => ({
        id: item.id,
        title: item.titre?.trim() || item.cours?.matiere?.nom?.trim() || "Evaluation",
        subtitle: item.cours?.classe?.nom?.trim() || "Classe",
        meta: [
          typeof item.note_max === "number" ? `/ ${item.note_max}` : "",
          formatDate(item.date),
        ]
          .filter(Boolean)
          .join(" | "),
        accent: "success",
      })),
    };
  }

  if (context.role === "ELEVE") {
    const student = await getStudentRecord(context);
    const [notes, bulletins] = await Promise.all([
      student
        ? getRows<NoteItem>("note", {
            take: 20,
            where: { eleve_id: student.id },
            includeSpec: NOTE_INCLUDE,
            orderBy: [{ note_le: "desc" }],
          })
        : Promise.resolve([]),
      student
        ? getRows<BulletinItem>("bulletin", {
            take: 10,
            where: {
              eleve_id: student.id,
              classe: { etablissement_id: context.etablissementId },
            },
            includeSpec: BULLETIN_INCLUDE,
            orderBy: [{ created_at: "desc" }],
          })
        : Promise.resolve([]),
    ]);

    return {
      title: "Resultats",
      subtitle: "Notes recentes et bulletins.",
      items: [...notes.map(noteItemToFeed), ...bulletins.map(bulletinItemToFeed)],
    };
  }

  if (context.role === "PARENT") {
    const parent = await getParentRecord(context);
    const childIds = collectParentChildIds(parent);
    const [notes, bulletins] = await Promise.all([
      childIds.length
        ? getRows<NoteItem>("note", {
            take: 20,
            where: { eleve_id: { in: childIds } },
            includeSpec: NOTE_INCLUDE,
            orderBy: [{ note_le: "desc" }],
          })
        : Promise.resolve([]),
      childIds.length
        ? getRows<BulletinItem>("bulletin", {
            take: 10,
            where: {
              eleve_id: { in: childIds },
              classe: { etablissement_id: context.etablissementId },
            },
            includeSpec: BULLETIN_INCLUDE,
            orderBy: [{ created_at: "desc" }],
          })
        : Promise.resolve([]),
    ]);

    return {
      title: "Suivi scolaire",
      subtitle: "Resultats et bulletins des enfants.",
      items: [...bulletins.map(bulletinItemToFeed), ...notes.map(noteItemToFeed)],
    };
  }

  const items = await getRows<BulletinItem>("bulletin", {
    take: 20,
    where: { classe: { etablissement_id: context.etablissementId } },
    includeSpec: BULLETIN_INCLUDE,
    orderBy: [{ created_at: "desc" }],
  });

  return {
    title: "Pilotage pedagogique",
    subtitle: "Lecture rapide des bulletins publies.",
    items: items.map(bulletinItemToFeed),
  };
}

export async function loadOperationsBundle(session: PersistedSession): Promise<FeedBundle> {
  const context = toContext(session);

  if (context.role === "PARENT") {
    const parent = await getParentRecord(context);
    const items =
      parent?.eleves?.map((item) => ({
        id: `${item.eleve_id}:${item.relation ?? "relation"}`,
        title:
          item.eleve?.utilisateur?.profil
            ? formatPersonName(item.eleve.utilisateur.profil)
            : item.eleve?.code_eleve?.trim() || "Enfant",
        subtitle: item.relation?.trim() || "Lien familial",
        meta: item.eleve?.inscriptions?.[0]?.classe?.nom?.trim() || "",
        accent: item.est_principal ? ("primary" as const) : ("info" as const),
      })) ?? [];

    return {
      title: "Espace famille",
      subtitle: "Enfants rattaches au compte parent.",
      items,
    };
  }

  if (context.role === "COMPTABLE") {
    const [parents, eleves] = await Promise.all([
      getRows<ParentTuteurLite>("parent-tuteur", {
        take: 20,
        where: { etablissement_id: context.etablissementId },
        orderBy: [{ created_at: "desc" }],
      }),
      getRows<EleveLite>("eleve", {
        take: 20,
        where: { etablissement_id: context.etablissementId },
        includeSpec: ELEVE_INCLUDE,
        orderBy: [{ created_at: "desc" }],
      }),
    ]);

    return {
      title: "Dossiers responsables",
      subtitle: "Lecture rapide des comptes famille et eleves.",
      items: [
        ...parents.map((item) => ({
          id: `parent-${item.id}`,
          title: item.nom_complet?.trim() || "Parent / tuteur",
          subtitle: "Responsable",
          accent: "primary" as const,
        })),
        ...eleves.slice(0, 8).map((item) => ({
          id: `eleve-${item.id}`,
          title:
            item.utilisateur?.profil
              ? formatPersonName(item.utilisateur.profil)
              : item.code_eleve?.trim() || "Eleve",
          subtitle: item.inscriptions?.[0]?.classe?.nom?.trim() || "Classe",
          accent: "info" as const,
        })),
      ],
    };
  }

  const [eleves, personnel] = await Promise.all([
    getRows<EleveLite>("eleve", {
      take: 20,
      where: { etablissement_id: context.etablissementId },
      includeSpec: ELEVE_INCLUDE,
      orderBy: [{ created_at: "desc" }],
    }),
    getRows<StaffItem>("personnel", {
      take: 20,
      where: { etablissement_id: context.etablissementId },
      includeSpec: STAFF_INCLUDE,
      orderBy: [{ created_at: "desc" }],
    }),
  ]);

  return {
    title: "Operations",
    subtitle: "Repertoires utiles pour l'activite mobile.",
    items: [
      ...eleves.map((item) => ({
        id: `eleve-${item.id}`,
        title:
          item.utilisateur?.profil
            ? formatPersonName(item.utilisateur.profil)
            : item.code_eleve?.trim() || "Eleve",
        subtitle: item.inscriptions?.[0]?.classe?.nom?.trim() || "Classe",
        accent: "primary" as const,
      })),
      ...personnel.slice(0, 8).map(staffToFeed),
    ],
  };
}
