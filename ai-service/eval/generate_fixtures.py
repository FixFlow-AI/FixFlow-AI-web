import json
import os
import sys

# Add parent directory to path to allow importing app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.features.brief_parser import sanitize_and_patch_brief
from app.schemas.proposal import Proposal

# Load dataset
dataset_path = os.path.join(os.path.dirname(__file__), "golden", "dataset.json")
with open(dataset_path, "r") as f:
    dataset = json.load(f)

fixtures = {}

# Programmatically generate schema-valid mock proposals matching expectations
for item in dataset:
    brief_id = item["id"]
    req = item["expected"]
    
    # Start with sanitized defaults as a dictionary
    proposal_dict = sanitize_and_patch_brief({}).model_dump()
    
    proposal_dict["project_summary"] = f"Proposal for {brief_id}"
    
    # Populate features matching required areas
    proposal_dict["features"] = []
    for i in range(max(req["min_features"], len(req["required_areas"]))):
        area = req["required_areas"][i % len(req["required_areas"])]
        proposal_dict["features"].append({
            "title": f"Feature {i+1} covering {area}",
            "description": f"Detailed description for feature {i+1}",
            "technical_approach": f"Technical approach for {area}",
            "complexity": "Medium",
            "confidence": "High",
            "confidence_pct": 90,
            "area": area
        })
        
    # Populate timeline phases
    proposal_dict["timeline"] = []
    for i in range(max(1, req["min_timeline_phases"])):
        proposal_dict["timeline"].append({
            "phase": f"Phase {i+1}",
            "duration": "2 weeks",
            "tasks": [f"Task {i+1}.1", f"Task {i+1}.2"],
            "dependencies": []
        })

    # Validate with Pydantic schema
    validated = Proposal.model_validate(proposal_dict)
    fixtures[brief_id] = validated.model_dump()

# Save to fixtures.json
fixtures_path = os.path.join(os.path.dirname(__file__), "golden", "fixtures.json")
with open(fixtures_path, "w") as f:
    json.dump(fixtures, f, indent=2)

print("Generated golden/fixtures.json successfully.")
