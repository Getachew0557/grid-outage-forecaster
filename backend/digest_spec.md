# digest_spec.md — Product & Business Adaptation Artifact
**Challenge:** T2.3 · Grid Outage Forecaster + Appliance Prioritizer  
**Artifact type:** Required — Product & Business Adaptation

---

## 1. Morning SMS Digest (Salon Owner · Feature Phone)

The salon owner receives up to **3 SMS messages** at **06:00 each morning**, each ≤ 160 characters.

### SMS 1 — Daily Risk Summary
```
GRID ALERT 23Apr: HIGH risk 14h-16h & 19h-20h. Expect ~90min outage.
Protect revenue: turn off Hair Dryer & Water Heater by 13:45. -GridBot
```
*(158 chars)*

### SMS 2 — Appliance Action Plan
```
ACTION: Keep ON all day: Lighting. OFF 14h-16h: HairDryer,WaterHeater.
TV/Radio OFF 13h-21h. Fridge safe (not your appliance). -GridBot
```
*(155 chars)*

### SMS 3 — Revenue & Fallback
```
Plan saves ~8,500 RWF vs full-on. If no update by 13h, last plan still
valid up to 6h. Worst case: unplug all non-critical at 13h. -GridBot
```
*(157 chars)*

**Delivery mechanism:** SMS gateway (e.g., Africa's Talking API) triggered by a cron job at 06:00 local time. Cost: ~RWF 15/SMS × 3 = RWF 45/day per business.

---

## 2. Internet Drop Mid-Day — Offline Behaviour

**Scenario:** Salon has no internet at 13:00. Forecast cannot refresh.

### What the device shows
- `lite_ui.html` reads from `localStorage` cache (written at last successful fetch).
- An **orange banner** appears: *"Offline — cached forecast (X min ago). Max staleness: 6h."*
- The forecast chart and appliance plan remain visible and interactive.
- The timestamp on the plan clearly shows when it was last fetched.

### Risk budget for an outdated plan

| Staleness | Trust level | Recommended action |
|-----------|-------------|-------------------|
| 0–2 h | Full trust | Follow plan as-is |
| 2–4 h | Moderate | Follow critical/comfort rules; skip luxury decisions |
| 4–6 h | Low | Treat all hours after current time as "medium risk" (p=0.30) |
| > 6 h | **Expired** | Revert to safe default: keep only critical appliances ON |

**Maximum accepted staleness: 6 hours.** After 6 hours the UI replaces the plan with a static safe-mode banner: *"Plan expired. Keep only Lighting ON until internet returns."*

**Rationale:** The outage probability model has a 24-hour horizon. After 6 hours, the remaining 18-hour window has drifted enough that the confidence intervals widen beyond actionable thresholds (upper_bound > 0.5 for most hours).

---

## 3. Non-Reader Adaptation — Colour-Coded LED Relay Board

**Chosen approach:** Physical LED indicator on a relay board (e.g., ESP8266 + 4-channel relay).

**Justification:** A salon owner who cannot read can still act on a traffic-light signal visible from across the room, requires no smartphone, and works during power fluctuations.

### LED Signal Specification

| LED colour | Meaning | Appliance action |
|------------|---------|-----------------|
| 🟢 Green | Low risk (p < 0.20) | All appliances ON |
| 🟡 Yellow | Medium risk (0.20–0.45) | Turn off luxury (TV, Radio) |
| 🔴 Red | High risk (0.45–0.65) | Turn off comfort + luxury |
| 🟣 Purple (flashing) | Critical (p > 0.65) | Turn off everything except Lighting |

### Implementation
1. Raspberry Pi / ESP8266 polls `/api/forecast/{business}/raw` every 30 minutes.
2. Picks the **next 2-hour maximum p_outage** as the current signal.
3. Drives a 4-LED strip (green/yellow/red/purple) + buzzer for critical.
4. Relay board physically cuts power to non-critical circuits when purple.
5. Offline fallback: last known LED state held for up to 6 hours, then defaults to red.

**Cost estimate:** ~USD 12 for ESP8266 + relay board + LEDs. Replicable by a local technician.

---

## 4. Revenue Calculation — Salon Outage Week

**Stated revenue per running hour (salon appliances):**

| Appliance | RWF/h | Hours/day (typical) |
|-----------|-------|---------------------|
| Hair Dryer | 8,000 | 8 |
| Water Heater | 2,000 | 4 |
| TV | 2,000 | 10 |
| Radio | 500 | 10 |
| Lighting | 500 | 12 |

**Naive full-on weekly revenue at risk** (assuming 1 outage/day × 90 min avg):
- Hair Dryer: 8,000 × 1.5h × 7 = **84,000 RWF**
- Water Heater: 2,000 × 1.5h × 7 = **21,000 RWF**
- Total at-risk per week: **~105,000 RWF**

**With our plan** (pre-emptive OFF during high-risk hours, avg 3h/day protected):
- Hair Dryer protected: 8,000 × 3h × 7 = 168,000 RWF exposure avoided
- Actual outage losses reduced by ~68% (model recall 0.68)
- **Net weekly saving: ~71,400 RWF** vs naive full-on operation

---

## 5. Multilingual Note

SMS messages above are in English. For Kinyarwanda deployment, the same 3-SMS template is translated and stored server-side. The `/api/forecast/{business}` endpoint accepts an `Accept-Language: rw` header and returns localised SMS text in the response body.
