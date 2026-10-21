# 0012. Spacing ownership rule

- **Status:** accepted (design)
- **Date:** 2026-10-21

## Context

Extra space kept appearing in rows and panels. Each component pushed
its own bottom and right margins. The last item in a container
collected a stray gap. Two children sometimes claimed the same gap.
The result needed one critique round per bug to find.

## Decision

The container owns the gaps between its children. Children never
declare spacing outside themselves. Containers space children with
one gap value from the spacing tokens. Internal padding stays
symmetric, equal on both sides. Text flows use the same rule.

## Consequences

Rows, cards, and panels get space from one place: their container.
Removing a child never leaves a hole. Symmetric padding keeps text
centered, which is what the row critiques kept asking for. An ESLint
rule warns when a child declares a bottom or right margin; it becomes
an error after the cleanup pass. Prettier only formats text, so it
cannot enforce this; the rule lives in ESLint.
