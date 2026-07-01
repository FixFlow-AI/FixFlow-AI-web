"""Pydantic mirror of ``contextExtensions.ts`` schemas (AI-004)."""
from __future__ import annotations

from typing import List, Literal

from pydantic import BaseModel, Field


class ExtensionMilestone(BaseModel):
    title: str = Field(min_length=1)
    description: str = Field(min_length=1)
    estimatedDuration: str = Field(min_length=1)
    complexity: Literal["Low", "Medium", "High"]
    estimatedBudgetPct: int = Field(ge=0, le=100)


class ContractExtensionsOutput(BaseModel):
    extensionReasoning: str = Field(min_length=1)
    suggestedMilestones: List[ExtensionMilestone]
    extensionOfferDraft: str = Field(min_length=1)
