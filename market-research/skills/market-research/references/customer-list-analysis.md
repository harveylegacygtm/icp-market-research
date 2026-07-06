# Customer List Import: Reverse-Engineer the ICP From Won Customers

This is the data-driven front door to ICP Mapping. Instead of guessing the ICP,
mine it from the customers who already paid. You take a CSV of won customers,
enrich each one, find the firmographics AND the triggers they share, compare that
to what the user sells and who they think they sell to, then hand back the
patterns to target next.

The core output the user asked for: "these are the recent news, growth trends,
signals, and triggers your customers share, so target new companies that show the
same ones." If every customer is hiring fast, headcount growth becomes a targeting
trigger. That is the whole point.

## Two inputs, kept separate

There are two different inputs, and they must not be confused.

**1. The customer CSV (many rows, one per won customer).** The columns:

- Domain, Job title, Company LinkedIn (the identity fields, usually a CRM export)
- Company News (a recent signal or trigger, filled if known, researched if blank)

That is all the CSV carries about each customer. Everything else about a customer
(firmographics, triggers, psychographics) is researched, not a column.

**2. The user's own baseline (one input, collected once).** What the USER sells
and who they target:

- Their ICP (who the user thinks they sell to)
- Their Service offering (what the user sells)
- Their Price point (what the user charges)

These three are the user's input, not per-customer columns. They are the yardstick
you measure the customer patterns against. Collect them up front by asking, or
read them from an onboarding form if one was uploaded. Never try to pull them from
the customer CSV.

## Step A: Parse and map the customer CSV

Run the parser on the uploaded CSV:

```
node ${CLAUDE_PLUGIN_ROOT}/scripts/marketresearch/customers.mjs customers.csv --json work.json
```

It maps the customer columns, reports how many cells are filled vs blank, and
writes `work.json`: the normalized rows plus a per-row `_needsResearch` list (only
Company News can be blank). It never researches on its own. It only parses. Any
unrecognized columns are carried in each row's `_extra`.

## Step B: Get the user's baseline, then decide research depth

First, capture the user's baseline: their ICP, their service offering, their price
point. One short ask if you do not already have it. This is the comparison target
for Step E.

Then decide research depth per file, not once:

- Small list (roughly 40 rows or fewer): research every row.
- Big list (more than 40): tell the user the count and ask. Offer two paths:
  research every row (best signal, slower) or research a representative sample and
  extrapolate. If they sample, state plainly which rows were sampled and that the
  patterns are extrapolated. Never imply full coverage.

## Step C: Enrich each customer

For every row (or the sampled subset), fill the blank Company News and gather the
rest by research. Use WebSearch and WebFetch. Cite every finding with a source
URL. Prioritize the last 12 to 24 months for news and signals.

Per customer, capture:

- Firmographics: industry, what they sell, size, revenue band, location, age,
  business model, funding stage. (Layer 1 of the 4-layer framework in sop-full.md.)
- Recent triggers: news, funding, hiring, new exec, expansion, product launch,
  M&A, tech adopted. Tag each with the trigger taxonomy below.
- Psychographic read: growth-mode vs optimization-mode, data-driven, compliance-
  focused (from their About, careers, leadership posts).

Assign trigger tags from the SOP taxonomy so patterns are countable:

- Individual triggers: new-role, promoted, hiring-on-team, public-POV, event.
- Company triggers: hiring, funding-raised, new-tech, expansion, new-office, M&A,
  product-launch, exec-departure, running-ads, layoffs, legal-issue,
  competitor-switch, award, redesign.
- Industry triggers: trend (AI adoption, cost pressure), new-regulation,
  analyst-report, world-event.

Use the same tag strings every row so Step D can count them.

## Step D: Mine the patterns

This is the payoff. Across the enriched set, find what recurs.

1. Firmographic clusters: the 3 patterns the best customers share (industry, what
   they sell, size, revenue, model, funding). Report each with how many of N
   customers share it.
2. Trigger frequency table: count every trigger tag across the set and rank by how
   many customers carry it. This is the headcount-growth insight. Example:

   | Trigger | Customers (of 12) | Targeting read |
   | --- | --- | --- |
   | hiring | 9 | Headcount growth. Target companies with open roles now. |
   | funding-raised | 6 | Fresh capital, vendor-shopping. Target recent raises. |
   | new-tech | 4 | Adopted an adjacent tool. Target new installs. |

3. Anti-patterns: if the user gave churned or bad-fit customers too, pull the 2
   shared patterns into the anti-ICP.

Rank every pattern by frequency. A trigger 9 of 12 customers share is a targeting
rule. One that 2 share is a maybe.

## Step E: Cross-reference with the user's baseline

Now compare the customer patterns to the user's baseline from Step B (their stated
ICP, their offer, their price point):

- Alignment: where the real customer patterns match their stated ICP. Confirmed.
- Gaps: patterns in the real customers that are missing from their stated ICP.
  These are the additions to make.
- Surprises: customers they win who do not fit their stated ICP at all. Either a
  hidden segment worth a campaign, or noise. Flag it, do not bury it.

The stated ICP is a hypothesis. The won customers are the evidence. Where they
disagree, the evidence wins.

## Step F: The three-part report

Deliver in exactly this shape (the user asked for these three parts):

1. This is your ICP and the research on it. The one-paragraph ICP and anti-ICP,
   the 4-layer profile, pains and language in real words with sources.
2. This is your offer and the market research around it. Their service offering
   and price point, its market position, red vs blue ocean, the competitor gap.
   (Uses the user's baseline. Feeds your offer and lead-magnet work.)
3. You gave me X customers. Here is what I found. The firmographic clusters and
   the ranked trigger table, then the exact triggers and signals to ADD to the ICP
   map and list-building, with the frequency behind each. This is the section that
   changes what they target next.

Every claim cites a source. Flag assumptions vs verified data.

## Step G: The three deliverables

Produce all three (they share the same research, so the marginal cost is small):

1. Enriched customer table. The parser's identity columns, Company News filled,
   plus a `trigger_tags` column per customer and a one-line firmographic note.
   Offer to write it to a CSV so they keep the raw enriched data.
2. Plug-in ICP filters. A ready-to-use block of firmographic + signal filters (the
   ranked triggers as list-building criteria) formatted to drop straight into your
   list-building tool (Clay, Apollo, Sales Navigator, or the Launchpad's lead-list
   stage). This is the bridge from "here are the patterns" to "here is the next
   list."
3. Updated ICP doc. Fold the findings into the ICP doc so the Signal-to-Offer Map
   and the 0 to 100 scoring rubric reflect the real customer patterns. A trigger
   that 9 of 12 customers share earns real weight in the rubric.

## Quality standards

Primary sources over secondary. Cite every finding. Say "estimated based on
[reasoning]" when data is missing. Note confidence (high, medium, low) on the key
patterns. Never imply full coverage when you sampled. One persona per run, do not
blend two personas into one ICP. Keep the two inputs separate: the customer CSV is
the evidence, the user's ICP and offer and price are the yardstick. The ranked
trigger table is the deliverable that justifies the whole exercise, so make the
frequency behind each trigger explicit.
