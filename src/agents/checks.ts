import type { CategoryId } from "../types.js";

export const DEEP_CHECK_METADATA: Record<string, { categoryId: CategoryId; label: string }> = {
  has_primary_instructions: { categoryId: "instructions", label: "Primary instructions present" },
  has_readme: { categoryId: "instructions", label: "README present" },
  has_generic_skills: { categoryId: "instructions", label: "Generic skills present" },
  has_tool_skills: { categoryId: "instructions", label: "Tool skills present" },
  has_architecture_docs: { categoryId: "context", label: "Architecture docs exist" },
  has_docs_index: { categoryId: "context", label: "docs index exists" },
  has_structured_docs: { categoryId: "context", label: "Structured docs exist" },
  has_docs_dir: { categoryId: "context", label: "docs/ directory exists" },
  has_tsconfig: { categoryId: "context", label: "tsconfig.json present" },
  has_env_example: { categoryId: "context", label: ".env.example present" },
  has_package_json: { categoryId: "tooling", label: "package.json present" },
  has_lockfile: { categoryId: "tooling", label: "Lockfile present" },
  has_architecture_lints: { categoryId: "tooling", label: "Architecture lints present" },
  has_local_dev_boot_path: { categoryId: "tooling", label: "Local dev boot path present" },
  has_lint_script: { categoryId: "tooling", label: "lint script present" },
  has_typecheck_script: { categoryId: "tooling", label: "typecheck script present" },
  has_build_script: { categoryId: "tooling", label: "build script present" },
  has_ci_pipeline: { categoryId: "feedback", label: "CI pipeline present" },
  has_ci_validation: { categoryId: "feedback", label: "CI validation present" },
  has_test_script: { categoryId: "feedback", label: "test script present" },
  has_test_dir: { categoryId: "feedback", label: "test directory exists" },
  has_test_files: { categoryId: "feedback", label: "test files present" },
  has_e2e_or_smoke_tests: { categoryId: "feedback", label: "e2e or smoke tests present" },
  has_execution_plans: { categoryId: "context", label: "Execution plans present" },
  has_short_navigational_instructions: {
    categoryId: "instructions",
    label: "Short navigational instructions present",
  },
  has_observability_signals: { categoryId: "safety", label: "Observability signals present" },
  has_quality_or_debt_tracking: { categoryId: "safety", label: "Quality or debt tracking present" },
};

export const DEEP_CHECK_IDS = Object.keys(DEEP_CHECK_METADATA);
