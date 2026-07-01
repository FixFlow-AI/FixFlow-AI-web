"""Pydantic mirror of ``interviewGenerator.ts`` schemas (AI-003)."""
from __future__ import annotations

from typing import List

from pydantic import BaseModel, Field


class InterviewQuestion(BaseModel):
    question: str = Field(min_length=1)
    rationale: str = Field(min_length=1)
    expectedKeywords: List[str]
    idealAnswerSummary: str = Field(min_length=1)


class InterviewOutput(BaseModel):
    questions: List[InterviewQuestion]
