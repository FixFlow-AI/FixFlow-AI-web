import argparse
import asyncio
import json
import os
import sys
from unittest.mock import patch

# Add parent directory to path to allow importing app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set mock env variables immediately so config doesn't throw on import
os.environ.setdefault("GEMINI_API_KEY", "fake-key")
os.environ.setdefault("AI_SHARED_SECRET", "fake-secret")

from app.features.brief_parser import parse_brief
from app.schemas.proposal import Proposal


async def run_evaluation(live: bool):
    eval_dir = os.path.dirname(os.path.abspath(__file__))
    dataset_path = os.path.join(eval_dir, "golden", "dataset.json")
    fixtures_path = os.path.join(eval_dir, "golden", "fixtures.json")
    baseline_path = os.path.join(eval_dir, "baseline_scores.json")
    latest_path = os.path.join(eval_dir, "latest_scores.json")

    with open(dataset_path, "r") as f:
        dataset = json.load(f)

    fixtures = {}
    if not live:
        with open(fixtures_path, "r") as f:
            fixtures = json.load(f)
            
    passed_cases = 0
    total_cases = len(dataset)
    results = []

    print("==================================================")
    print(f"FIXFLOW AI OBSERVABILITY & QUALITY HARNESS (Live={live})")
    print("==================================================")

    for item in dataset:
        brief_id = item["id"]
        brief_text = item["briefText"]
        expected = item["expected"]

        print(f"\nEvaluating: {brief_id}...")

        # If offline/fixture mode, mock generate_structured to return pre-recorded valid Pydantic response
        if not live:
            fixture_data = fixtures.get(brief_id)
            if not fixture_data:
                print(f"  [ERROR] No fixture found for {brief_id}")
                results.append({"id": brief_id, "status": "FAIL", "reason": "Missing fixture"})
                continue
            
            mocked_proposal = Proposal.model_validate(fixture_data)
            async def mock_generate(*args, **kwargs):
                return mocked_proposal

            with patch("app.features.brief_parser.generate_structured", side_effect=mock_generate):
                res = await parse_brief(brief_text)
        else:
            res = await parse_brief(brief_text)

        proposal = res.proposal
        failures = []
        
        # Check 1: Feature count
        feature_count = len(proposal.features)
        if feature_count < expected["min_features"]:
            failures.append(f"Feature count {feature_count} < expected {expected['min_features']}")
            
        # Check 2: Timeline phases
        phase_count = len(proposal.timeline)
        if phase_count < expected["min_timeline_phases"]:
            failures.append(f"Timeline phases {phase_count} < expected {expected['min_timeline_phases']}")
            
        # Check 3: Required areas coverage
        features_areas = [f.area.lower() for f in proposal.features]
        features_text = " ".join([
            f.title.lower() + " " + f.description.lower() + " " + f.technical_approach.lower() 
            for f in proposal.features
        ])
        
        for area in expected["required_areas"]:
            area_lower = area.lower()
            if area_lower not in features_areas and area_lower not in features_text:
                failures.append(f"Required area '{area}' not found in proposal features")

        if not failures:
            print("  [PASS] All structural assertions verified.")
            passed_cases += 1
            results.append({"id": brief_id, "status": "PASS"})
        else:
            print("  [FAIL] Failures detected:")
            for f in failures:
                print(f"    - {f}")
            results.append({"id": brief_id, "status": "FAIL", "failures": failures})

    aggregate_score = (passed_cases / total_cases) * 100
    print("\n==================================================")
    print(f"EVALUATION SUMMARY: {passed_cases}/{total_cases} PASSED ({aggregate_score:.1f}%)")
    print("==================================================")

    # Save latest score
    latest_report = {
        "aggregate_score": aggregate_score,
        "results": results
    }
    with open(latest_path, "w") as f:
        json.dump(latest_report, f, indent=2)

    # Compare with baseline
    if os.path.exists(baseline_path):
        with open(baseline_path, "r") as f:
            baseline = json.load(f)
        
        baseline_score = baseline.get("aggregate_score", 100.0)
        tolerance = baseline.get("tolerance", 5.0)

        print(f"Baseline Score: {baseline_score:.1f}% (Tolerance: {tolerance:.1f}%)")
        
        if aggregate_score < (baseline_score - tolerance):
            print(f"\n[RED ALERT] Regression detected! Score {aggregate_score:.1f}% is below limit.")
            sys.exit(1)
        else:
            print("\n[GREEN GATES] Quality baseline check passed. No regression detected.")
            sys.exit(0)
    else:
        print("\n[WARNING] Baseline scores file not found. Skipping gate check.")
        sys.exit(0)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AI Observability & Quality Evaluation Harness")
    parser.add_argument("--live", action="store_true", help="Run live calls against Gemini API")
    args = parser.parse_args()

    asyncio.run(run_evaluation(args.live))
