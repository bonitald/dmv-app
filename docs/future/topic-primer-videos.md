# Idea: Short Topic Primer Videos

_Captured: 2026-09-11 — status: exploring, not scoped into `prd.md` or `phases.md` yet._

## The idea
A short (10-15 second) video for each chunk/theme/section of study content (e.g. right-of-way,
signage, following distance), playing as a primer before that section's flashcards. Not a
full lesson — a quick concept intro, distinct from the "video-based hazard-perception training"
already deferred in `prd.md` Section 3 (that idea implied full driving-scene footage per scenario
question — much larger scope than a narrated topic intro).

## Scope clarified so far
- **What it shows:** a concept primer — quick narrated intro to the topic before its flashcards
  start (e.g. "right-of-way basics" explained in 10-15s).
- **Sourcing:** AI-generated — script paraphrased/authored like the question content, then turned
  into video via an AI video/voiceover tool. Keeps production scalable and matches the existing
  paraphrase-not-verbatim legal approach used for question content.
- **Volume:** roughly one clip per topic/chunk, not per question — likely 10-20 clips for the
  initial CO handbook topic set (matches the topic/category breakdown questions already use).
- **Timing:** undecided — MVP vs. fast-follow v1.1. Open, pending the business case below.

## AI video generation approaches (lowest to highest effort/cost)
1. **Slideshow/motion-graphics style** (recommended starting point): AI-written script → TTS
   voiceover → static/animated graphics or templated stock/icon visuals, assembled
   programmatically (e.g. a templated Remotion/FFmpeg pipeline, or a tool like Creatomate). Cheap,
   fast to iterate, easy to regenerate if content changes; visually plain.
2. **AI-generated avatar/narrator video** (e.g. HeyGen/Synthesia-style tools): a talking-head
   presenter reads the script. More polished and still scriptable/scalable, but has real
   per-minute cost and less control over exact visuals.
3. **Full AI text-to-video** (e.g. Sora/Veo-style): generates actual driving-scene visuals from a
   prompt. Highest "wow" factor but least controllable/consistent for instructional content,
   highest cost, highest risk of inconsistent quality across 15+ clips.

**Recommendation:** Option 1 is the realistic near-term choice. It reuses the existing
paraphrase-content workflow (short script per topic, same legal posture as questions), is cheap
and repeatable per topic, and is easiest to regenerate if content changes later. Options 2/3 are
worth revisiting once the core app/pass-rate is validated, not before.

## Technical fit (if built)
- Files are short (10-15s), so storage/bandwidth cost is low — Firebase Storage + Hosting/CDN,
  no new backend needed.
- Data model: a `topic_id → video_url` mapping hanging off the existing `Question`/topic model —
  a small addition to Phase 1's schema (`docs/phases.md`), played at the top of Phase 2
  (Flashcard Study Mode) when a topic/chunk starts.

## Cost — open, needs real numbers
User flagged this as the key open item: **is this a one-time production cost, or does it recur?**
Needs answers before this can be scoped into the PRD's business case (`prd.md` Section 6):

- **One-time cost drivers:** script writing/paraphrasing per topic (~10-20 topics), initial
  video-generation tool cost per clip, pipeline/tooling setup time (templated
  Remotion/FFmpeg/Creatomate build-out).
- **Recurring cost drivers (if any):** does the chosen AI video tool charge per-generation or
  per-minute (recurring any time content is added/updated), or is it a one-time render that's
  then just hosted (near-zero recurring cost beyond Firebase Storage bandwidth)? This depends on
  which tool/approach gets picked — needs a vendor-by-vendor cost check before deciding.
- **Content-churn cost:** if handbook content or topic breakdown changes post-launch, do primer
  videos need re-generating (cost re-incurred) or is that rare enough to ignore for the business
  case?

Not yet answered: specific tool selection, per-clip $ estimate, or whether cost is bounded
(one-time build) or ongoing (recurring generation/maintenance cost). Revisit this section once
those numbers are gathered.

## Relationship to existing scope
- `prd.md` Section 3 already lists "video-based hazard-perception training" as deferred/out of
  scope for MVP, with the explicit rationale that "the video approach in particular adds real
  content-production and technical overhead." This idea is narrower (short narrated topic
  intros vs. full hazard-perception scenario footage) but sits in the same general territory —
  worth being explicit that this isn't quietly reviving the deferred item without a fresh
  scope decision.
- Not yet added to `prd.md` or `docs/phases.md`. Once the business case (cost, one-time vs.
  recurring) is worked out, this should go through the `mobile-app-scoping` skill's refinement
  pass to formally land it as an MVP feature or a fast-follow phase.
