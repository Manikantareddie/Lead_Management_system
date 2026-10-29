"""YottaFlex lead management dataset validation package."""

from .validator import (
    ValidationIssue,
    ValidationReport,
    validate_all,
    validate_primary_keys,
    validate_foreign_keys,
    validate_required_values,
    validate_enums,
    validate_date_ordering,
    validate_score_arithmetic,
    validate_lifecycle_transitions,
    validate_duplicates,
    validate_consent_compliance,
    validate_sales_routing,
    load_dataset_from_csv,
    validate_csv_directory,
)

__all__ = [
    "ValidationIssue",
    "ValidationReport",
    "validate_all",
    "validate_primary_keys",
    "validate_foreign_keys",
    "validate_required_values",
    "validate_enums",
    "validate_date_ordering",
    "validate_score_arithmetic",
    "validate_lifecycle_transitions",
    "validate_duplicates",
    "validate_consent_compliance",
    "validate_sales_routing",
    "load_dataset_from_csv",
    "validate_csv_directory",
]
