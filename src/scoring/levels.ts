import type {
  CategoryId,
  CategoryScore,
  FixItem,
  LevelOnlyCheckId,
  LevelOnlyCheckStates,
  NormalizedCheckState,
  ReadinessLevelGateSet,
  ReadinessLevelId,
  ReadinessLevelLabel,
  ReadinessLevelResult,
  ReadinessStagedFixes,
  ScoringResult,
} from "../types.js";

export const CATEGORY_ORDER: readonly CategoryId[] = [
  "instructions",
  "context",
  "tooling",
  "feedback",
  "safety",
];

export const LEVEL_ONLY_CHECK_IDS: readonly LevelOnlyCheckId[] = [
  "has_execution_plans",
  "has_short_navigational_instructions",
  "has_observability_signals",
  "has_quality_or_debt_tracking",
];

const CATEGORY_ORDER_INDEX: Record<CategoryId, number> = {
  instructions: 0,
  context: 1,
  tooling: 2,
  feedback: 3,
  safety: 4,
};

const LEVEL_ONLY_LABELS: Record<LevelOnlyCheckId, string> = {
  has_execution_plans: "execution plans present",
  has_short_navigational_instructions: "short navigational instructions present",
  has_observability_signals: "observability signals present",
  has_quality_or_debt_tracking: "quality or debt tracking present",
};

export const HARD_GATE_SETS: Record<ReadinessLevelGateSet, readonly string[]> = {
  level1: [
    "has_package_json",
    "has_lockfile",
    "has_primary_instructions",
    "has_readme",
    "has_test_script",
    "has_local_dev_boot_path",
  ],
  level2: [
    "has_test_dir",
    "has_test_files",
    "has_lint_script",
    "has_typecheck_script",
    "has_build_script",
    "has_env_example",
    "has_docs_index",
  ],
  level3: [
    "has_architecture_docs",
    "has_structured_docs",
    "has_ci_validation",
    "has_e2e_or_smoke_tests",
    "has_architecture_lints",
    "has_execution_plans",
  ],
  level4_additional: [
    "has_short_navigational_instructions",
    "has_observability_signals",
    "has_quality_or_debt_tracking",
  ],
};

const LEVEL_LABELS: Record<ReadinessLevelId, ReadinessLevelLabel> = {
  1: "Bootstrap",
  2: "Baseline",
  3: "Reliable",
  4: "Autonomous-Ready",
};
const NEXT_GATE_SET_BY_BLOCKING_SET: Partial<Record<ReadinessLevelGateSet, ReadinessLevelGateSet>> = {
  level1: "level2",
  level2: "level3",
  level3: "level4_additional",
};
const ALL_HARD_GATE_IDS = new Set<string>(Object.values(HARD_GATE_SETS).flatMap((gateSet) => gateSet));

function compareCategoryOrder(left: CategoryId, right: CategoryId): number {
  return CATEGORY_ORDER_INDEX[left] - CATEGORY_ORDER_INDEX[right];
}

function toCheckMap(checks: NormalizedCheckState[]): Map<string, NormalizedCheckState> {
  return new Map(checks.map((check) => [check.id, check]));
}

function toFixItemMap(fixPlan: FixItem[]): Map<string, FixItem> {
  const map = new Map<string, FixItem>();

  for (const item of fixPlan) {
    if (!map.has(item.checkId)) {
      map.set(item.checkId, item);
    }
  }

  return map;
}

function failedHardGates(
  checkMap: Map<string, NormalizedCheckState>,
  gateSet: readonly string[],
): string[] {
  return gateSet.filter((checkId) => checkMap.get(checkId)?.passed !== true);
}

function orderCheckIds(checkIds: Iterable<string>, fixItemByCheckId: Map<string, FixItem>): string[] {
  const unique = [...new Set(checkIds)];
  const withFixItem: Array<{ checkId: string; fixItem: FixItem }> = [];
  const withoutFixItem: string[] = [];

  for (const checkId of unique) {
    const item = fixItemByCheckId.get(checkId);
    if (item) {
      withFixItem.push({ checkId, fixItem: item });
    } else {
      withoutFixItem.push(checkId);
    }
  }

  withFixItem.sort((left, right) => {
    if (left.fixItem.priority !== right.fixItem.priority) {
      return left.fixItem.priority - right.fixItem.priority;
    }
    return left.checkId.localeCompare(right.checkId);
  });
  withoutFixItem.sort((left, right) => left.localeCompare(right));

  return [...withFixItem.map((entry) => entry.checkId), ...withoutFixItem];
}

function toFailedCheckIdSet(checks: NormalizedCheckState[]): Set<string> {
  return new Set(checks.filter((check) => !check.passed).map((check) => check.id));
}

function levelResult(
  id: ReadinessLevelId,
  blockingGateSet: ReadinessLevelGateSet,
  failedGates: string[],
  nextLevelId?: Exclude<ReadinessLevelId, 1>,
): ReadinessLevelResult {
  return {
    id,
    label: LEVEL_LABELS[id],
    blockingGateSet,
    failedHardGates: failedGates,
    nextLevelId,
  };
}

export function normalizeScoredChecks(categoryScores: CategoryScore[]): NormalizedCheckState[] {
  const normalized = new Map<string, NormalizedCheckState>();
  const sortedCategories = [...categoryScores].sort((left, right) => compareCategoryOrder(left.id, right.id));

  for (const category of sortedCategories) {
    for (const check of category.checks) {
      const existing = normalized.get(check.id);

      if (!existing) {
        normalized.set(check.id, {
          id: check.id,
          passed: check.passed,
          label: check.label,
          categoryId: category.id,
          source: "scored",
        });
        continue;
      }

      existing.passed = existing.passed || check.passed;
    }
  }

  return Array.from(normalized.values());
}

export function normalizeLevelChecks(
  scoring: Pick<ScoringResult, "categoryScores">,
  levelOnlyChecks: LevelOnlyCheckStates = {},
): NormalizedCheckState[] {
  const normalized = normalizeScoredChecks(scoring.categoryScores).map((check) => ({ ...check }));

  for (const checkId of LEVEL_ONLY_CHECK_IDS) {
    normalized.push({
      id: checkId,
      passed: levelOnlyChecks[checkId] === true,
      label: LEVEL_ONLY_LABELS[checkId],
      source: "level-only",
    });
  }

  return normalized;
}

export function calculateReadinessLevel(
  scoring: Pick<ScoringResult, "categoryScores">,
  levelOnlyChecks: LevelOnlyCheckStates = {},
): ReadinessLevelResult {
  const checkMap = toCheckMap(normalizeLevelChecks(scoring, levelOnlyChecks));

  const level1Failed = failedHardGates(checkMap, HARD_GATE_SETS.level1);
  if (level1Failed.length > 0) {
    return levelResult(1, "level1", level1Failed, 2);
  }

  const level2Failed = failedHardGates(checkMap, HARD_GATE_SETS.level2);
  if (level2Failed.length > 0) {
    return levelResult(2, "level2", level2Failed, 3);
  }

  const level3Failed = failedHardGates(checkMap, HARD_GATE_SETS.level3);
  if (level3Failed.length > 0) {
    return levelResult(3, "level3", level3Failed, 4);
  }

  const level4Failed = failedHardGates(checkMap, HARD_GATE_SETS.level4_additional);
  if (level4Failed.length > 0) {
    return levelResult(3, "level4_additional", level4Failed, 4);
  }

  return levelResult(4, "level4_additional", []);
}

export function buildStagedFixes(
  scoring: Pick<ScoringResult, "categoryScores" | "fixPlan">,
  level: ReadinessLevelResult,
  levelOnlyChecks: LevelOnlyCheckStates = {},
): ReadinessStagedFixes {
  const normalizedChecks = normalizeLevelChecks(scoring, levelOnlyChecks);
  const failedCheckIds = toFailedCheckIdSet(normalizedChecks);
  const fixItemByCheckId = toFixItemMap(scoring.fixPlan);

  const now = orderCheckIds(level.failedHardGates, fixItemByCheckId);

  const nextGateSet = NEXT_GATE_SET_BY_BLOCKING_SET[level.blockingGateSet];
  const nextHardGateFailures = nextGateSet
    ? HARD_GATE_SETS[nextGateSet].filter((checkId) => failedCheckIds.has(checkId))
    : [];
  const orderedNextHardGateFailures = orderCheckIds(nextHardGateFailures, fixItemByCheckId);

  const failedSoftChecks = [...failedCheckIds].filter((checkId) => !ALL_HARD_GATE_IDS.has(checkId));
  const orderedSoftChecks = orderCheckIds(failedSoftChecks, fixItemByCheckId);

  // Terminal level: keep metadata additive, but route all soft failures to later.
  // "next" is intentionally empty when there is no next level.
  if (level.nextLevelId === undefined) {
    return {
      now,
      next: [],
      later: orderedSoftChecks,
    };
  }

  const nextHardCap = 4;
  const next: string[] = orderedNextHardGateFailures.slice(0, nextHardCap);
  const usedSoftCheckIds = new Set<string>();
  if (next.length < nextHardCap) {
    for (const softCheckId of orderedSoftChecks) {
      if (next.length >= nextHardCap) {
        break;
      }
      next.push(softCheckId);
      usedSoftCheckIds.add(softCheckId);
    }
  }

  const later = orderedSoftChecks.filter((checkId) => !usedSoftCheckIds.has(checkId));

  return { now, next, later };
}

export function getTextStageCaps(levelId: ReadinessLevelId): { now: number; next: number } {
  return {
    now: levelId === 1 ? 3 : 4,
    next: 4,
  };
}

export function capStagedFixesForText(
  stagedFixes: ReadinessStagedFixes,
  levelId: ReadinessLevelId,
): ReadinessStagedFixes {
  const caps = getTextStageCaps(levelId);

  return {
    now: stagedFixes.now.slice(0, caps.now),
    next: stagedFixes.next.slice(0, caps.next),
    later: [...stagedFixes.later],
  };
}
