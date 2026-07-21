# Wish-Flow Template Studio IA Spec (G5 Prep)

## 1) Purpose

Define an information architecture (IA) for a production-grade **Template Studio** that is:

- Simple enough for first-time creators
- Deep enough for pro template designers
- Safe for runtime compatibility (existing events must not break)
- Ready for template marketplace and monetization

This document is a product + engineering contract for implementation.

---

## 2) Product Positioning

Template Studio is a **no-code template builder** for Wish-Flow.

- Target output: publishable template versions backed by `steps_schema` + renderer registry
- Non-goal (MVP): arbitrary custom code execution from users
- Core promise: designer freedom with production safety guardrails

---

## 3) User Roles and Permissions

## 3.1 Roles

1. **Owner/Admin**
   - Full access: create/edit/publish/unpublish/deprecate/rollback/delete
2. **Template Designer**
   - Create/edit drafts, submit for review, duplicate templates
   - No direct publish to production (unless policy allows)
3. **Reviewer/QA**
   - Validate, comment, approve/reject releases
4. **Analyst (read-only)**
   - Access analytics and version history only

## 3.2 Permission Matrix (summary)

| Action | Owner/Admin | Designer | Reviewer | Analyst |
|---|---|---|---|---|
| Create template draft | Yes | Yes | No | No |
| Edit draft | Yes | Yes | Limited (notes only) | No |
| Submit for review | Yes | Yes | No | No |
| Approve/reject release | Yes | No | Yes | No |
| Publish/unpublish | Yes | Policy-based | No | No |
| Rollback version | Yes | No | No | No |
| View analytics | Yes | Yes | Yes | Yes |

---

## 4) IA Map (Top-Level Navigation)

Template Studio should expose 8 core areas:

1. **Library**
   - Browse/search/filter templates
2. **Builder**
   - Edit template composition and behavior
3. **Data Model**
   - Define creator input fields and validation
4. **Theme & Tokens**
   - Global style system + presets
5. **Preview & QA**
   - Multi-viewport preview + compatibility checks
6. **Versions**
   - Draft/review/published/deprecated + rollback
7. **Analytics**
   - Usage, conversion, step drop-off
8. **Settings**
   - Ownership, collaboration, publish policy

---

## 5) Library Screen IA

## 5.1 Layout

- Top bar: Search, quick filters, create button
- Left filter rail (desktop) / bottom sheet (mobile)
- Main grid/list with cards

## 5.2 Filters

- Category (birthday/photo/minigame/romantic/family/simple/friend)
- Mood tags
- Premium/free
- Has minigame
- Status (draft/review/published/deprecated)
- Sort: recommended/newest/most-used/recently-updated

## 5.3 Card Metadata

- Thumbnail
- Name + slug
- Category + tags
- Version label (e.g., `v1.4`)
- Status badge
- Usage count
- Last updated by + time

---

## 6) Builder Screen IA (Main Selling Feature)

## 6.1 Three-Panel Structure

1. **Left: Step Library**
   - 21 registered step types grouped by `text`, `photo`, `minigame`
   - Search + favorites + recently used
2. **Center: Flow Canvas**
   - Ordered step timeline (drag/drop reorder)
   - Add, duplicate, disable, remove
   - Section grouping (opening/body/finale)
3. **Right: Properties Panel**
   - Context-sensitive settings for selected step

## 6.2 Editing Controls

- Undo/redo
- Duplicate step
- Step lock/hide
- Bulk select (desktop)
- Safe delete with dependency warning

## 6.3 Mobile Behavior

- Single-panel focus mode:
  - Canvas default
  - Step library/properties opened as bottom sheets
- Sticky action bar:
  - Save draft, preview, submit review

---

## 7) Nested Settings Model (Progressive Disclosure)

This is required so advanced control does not overwhelm new users.

## 7.1 Modes

1. **Basic Mode**
   - Quick setup: title, primary color, font pair, default animation intensity, cover image
2. **Pro Mode**
   - Step-level overrides, transition presets, media behavior, game tuning
3. **Expert Mode**
   - Conditional visibility rules, per-element override, fallback policy, performance knobs

## 7.2 Hierarchy

1. **Global Settings**
   - Theme, typography, default motion, spacing scale, audio policy
2. **Step Settings**
   - Fields, layout variant, transition in/out, timing, interaction config
3. **Element Settings**
   - Component-level style and behavior override (button/card/image/caption)
4. **Runtime Rules**
   - Show/hide by conditions, no-asset fallback, reduced-motion behavior

Conflict resolution order:

`Global -> Step Override -> Element Override`

---

## 8) Data Model Designer IA

Allow designers to define creator-facing inputs without touching code.

## 8.1 Field Types

- short-text
- long-text
- rich-text (sanitized subset)
- image-slot
- date
- select
- multi-select
- repeater/list
- boolean toggle

## 8.2 Field Config

- `key`, label (TH/EN), help text
- required/optional
- min/max length or range
- regex/pattern (where applicable)
- default value
- sample value (preview only)
- mapping to step fields

## 8.3 Safety Rules

- Reserved key protection
- Schema validation before save/publish
- Unsupported renderer binding blocked at validation time

---

## 9) Theme & Tokens IA

## 9.1 Token Categories

- Color roles (primary, secondary, accent, bg, text, success, warning)
- Typography scale
- Radius/spacing/shadow
- Motion duration/easing levels

## 9.2 Presets

- Cute pastel
- Minimal clean
- Warm romantic
- Fun party

## 9.3 Guardrails

- Contrast checker
- Touch target checks
- Prevent invalid token combinations

---

## 10) Preview & QA IA

## 10.1 Preview Modes

- Mobile (primary)
- Tablet
- Desktop
- Reduced motion
- Asset-missing simulation

## 10.2 Test Actions

- Start from first step
- Jump to specific step
- Simulate slow network
- Simulate no-audio/no-image environment

## 10.3 Quality Gate (publish blocker)

- Schema valid
- Required sample data present
- Accessibility baseline pass
- Performance budget pass (asset + animation weight)
- Touch/mouse compatibility pass for minigames

---

## 11) Versioning and Release IA

## 11.1 States

- Draft
- In Review
- Published
- Deprecated
- Archived

## 11.2 Rules

- Published versions are immutable
- Existing events stay pinned to current published version unless manually migrated
- Rollback creates new published version from historical snapshot

## 11.3 Required Metadata on Publish

- Release notes
- Breaking/non-breaking classification
- Migration notes (if required)

---

## 12) Analytics IA

## 12.1 Core Metrics

- Template usage count
- PIN unlock success rate by template
- Step completion funnel
- Step drop-off hotspots
- Device split (mobile/tablet/desktop)

## 12.2 Diagnostic Views

- Version-to-version performance comparison
- Category and mood performance
- Top failing validation themes

---

## 13) Suggested API Surface (Future)

Minimum additional endpoints for Template Studio operations:

- `POST /api/template-admin/templates`
- `PATCH /api/template-admin/templates/:id`
- `POST /api/template-admin/templates/:id/submit-review`
- `POST /api/template-admin/templates/:id/approve`
- `POST /api/template-admin/templates/:id/publish`
- `POST /api/template-admin/templates/:id/rollback`
- `GET /api/template-admin/templates/:id/versions`
- `GET /api/template-admin/templates/:id/analytics`
- `POST /api/template-admin/templates/:id/validate`

All admin endpoints must enforce ownership/role checks server-side.

---

## 14) Technical Guardrails (Must-Have)

1. No arbitrary user JavaScript execution
2. Step type must exist in renderer registry
3. Schema version must be explicit
4. All guest-facing text sanitized before render
5. Asset references must route through storage metadata
6. Publish must require automated validation pass
7. Backward compatibility policy enforced per version

---

## 15) Rollout Plan (Scope by Milestone)

## Milestone A (Foundational Admin)

- Library + metadata edit
- Draft versions
- Basic preview
- Manual publish by admin only

## Milestone B (True Builder)

- 3-panel builder with drag/drop
- Data model designer
- Basic/Pro modes
- Validation panel

## Milestone C (Market-Ready)

- Expert mode
- Full QA gate
- Analytics deep dive
- Monetization metadata + marketplace readiness

---

## 16) Acceptance Criteria for "Point of Sale" Quality

Template Studio is considered a product differentiator when:

1. New designer can publish first working template in < 30 minutes (without code)
2. Existing live events never break when a new template version is published
3. Mobile preview parity with guest runtime is high (visual mismatch negligible)
4. Validation catches critical issues before publish (schema, a11y, perf)
5. Analytics identifies at least top 3 drop-off steps per template version

---

## 17) Open Decisions

1. Should designers be allowed to publish directly in lower environments only?
2. Do we need template-level A/B testing in first marketplace release?
3. Which role can deprecate a published template?
4. Should premium template flags be controlled only by Owner/Admin?

