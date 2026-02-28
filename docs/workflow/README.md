# Workflow Docs

Status: Active
Date: 2026-02-28

## Purpose
This folder contains canonical workflow-level documentation for agent interactions.

## Current
- `REQUEST-WORKFLOW.md` — unified request flow (`allow|deny|escalate`) with sensitivity as decision branch.
- `REQUEST-AGENT-BEHAVIOR-MAPPING.md` — deterministic agent branching contract for request outcomes.
- `REQUEST-EVAL-LOOP.md` — strict A/B behavioral verification loop (with/without Handshake).

## Usage
- Use this folder as workflow source before implementation-specific docs.
- Keep payment/confidential/credential cases as applications of the same request workflow.
- Use eval loop before promoting major workflow assumptions to production defaults.
