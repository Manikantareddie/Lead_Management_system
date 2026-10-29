"""Configurations for the synthetic data generator.

Preserves the small starter configuration for fast development and testing,
while providing the required full-scale configuration (20k leads, 10k contacts,
5k companies, 3k opportunities).
"""

# Starter configuration for fast development and automated test runs
DEFAULT_CONFIG = {
    "companies": 10,
    "contacts": 20,
    "salesreps": 5,
    "score_rules": 3,
    "campaigns": 4,
    "leads": 30,
    "consents": 25,
    "activities": 60,
    "tasks": 45,
    "opportunities": 12,
    "stage_histories": 40,
    "seed": 20261022,
    "output_dir": "data/generated",
    "ground_truth_dir": "data/ground_truth",
}

# Full assessment scale configuration
FULL_CONFIG = {
    "companies": 5000,
    "contacts": 10000,
    "salesreps": 50,
    "score_rules": 3,
    "campaigns": 100,
    "leads": 20000,
    "consents": 15000,
    "activities": 35000,
    "tasks": 25000,
    "opportunities": 3000,
    "stage_histories": 25000,
    "seed": 20261022,
    "output_dir": "data/generated",
    "ground_truth_dir": "data/ground_truth",
}
