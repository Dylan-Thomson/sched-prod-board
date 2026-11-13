---
id: SCHED-4511
title: Live list with Ack per row
status: ready
plan: R1, R2
---

On-call needs to see new incidents the moment they come in and take one with a click.

- New incidents appear at the top of the list as they arrive, newest first (R1).
- Each row gets an **Ack** button (`data-testid="ack"`). Clicking it calls `api.ack(id)` and marks the row
  acked (`data-testid="acked"`) (R2).

Acceptance: a new incident shows at the top without a reload; Ack on a row acks that incident.

Revised by product after step one: the list holds still; new incidents wait behind an "N new" bar (`data-testid="new-bar"`) and come in at the top on click. Ack stays on the row.
