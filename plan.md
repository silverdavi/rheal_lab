# Fertility Journey: Isometric Web Game

## Concept
An isometric web game following a couple through fertility treatment—from initial consultation to (hopefully) bringing home a baby. Real attrition rates and risk factors drive outcomes.

---

## Game Flow

```
Consultation → Diagnostics → Treatment Ladder → Outcome
```

### Treatment Ladder (escalating intervention)
1. **Lifestyle & Timed Intercourse** — tracking, supplements, lifestyle changes
2. **Ovulation Induction** — Clomid/Letrozole cycles
3. **IUI** (3-6 attempts typical) — sperm wash + insemination
4. **IVF/ICSI** (last resort) — full egg retrieval + lab + transfer

Each step has success/failure probabilities; failure → escalate or retry.

---

## Core Mechanics

### Patient Profile (from `calculator.py`)
- **Age** (20-45) — primary factor in all outcomes
- **AMH** — ovarian reserve, age-adjusted percentiles
- **BMI** (15-45) — polynomial impact on success
- **Conditions** — PCOS (+20% eggs, −10% freeze), Endometriosis (−20% birth, −10% eggs)
- **Ethnicity** — slight statistical adjustments

### IVF Attrition Pipeline (real rates)
```
Retrieved → Frozen → Thawed → Fertilized → Good Embryos → Implanted → Live Birth
```
Each stage: age-stratified survival rates (e.g., 30yo: 75-80% freeze rate; 45yo: 20-25%)

### Probability Engine
- Per-cycle live birth rate = f(age, AMH, BMI, conditions)
- Cumulative probability across 1-3 cycles
- Random events: cycle cancellation, OHSS risk, failed fertilization

---

## Isometric World

### Locations
| Location | Activities |
|----------|------------|
| **Home** | Rest, lifestyle choices, emotional moments |
| **Clinic Lobby** | Appointments, waiting, other couples |
| **Consultation Room** | Diagnosis, treatment decisions |
| **Ultrasound Suite** | Follicle monitoring, AFC counts |
| **Lab/Pharmacy** | Pick up meds, hormone injections |
| **Procedure Room** | IUI, egg retrieval, embryo transfer |
| **Embryology Lab** | (cutscene) Watch embryo development |
| **Recovery Area** | Post-procedure, two-week wait |

### Visual Style
- Soft, hopeful palette with tension moments
- Day/night cycle tied to treatment timeline
- Character emotions reflect journey stress

---

## Gameplay Loop

```
┌─────────────────────────────────────────────────────┐
│  CLICK LOCATION  →  CHARACTERS WALK  →  DIALOG BOX │
│        ↓                                            │
│  MAKE DECISION  →  STATS UPDATE  →  TIME PASSES    │
│        ↓                                            │
│  CHECK STATS  →  CAN CONTINUE?  →  NEXT EVENT      │
└─────────────────────────────────────────────────────┘
```

### Core Stats (0-100)
| Stat | Drains From | Recovers From |
|------|-------------|---------------|
| 💪 Physical | Procedures, meds, injections | Rest, exercise |
| 🧠 Mental | Bad news, waiting, uncertainty | Therapy, support |
| 💕 Relationship | Stress, blame, isolation | Date nights, communication |
| ✨ Hope | Failed cycles, negative tests | Success stories, progress |

### Resources
- **💰 Money** — Consultations ($200), IUI ($1500), IVF ($15000+)
- **⏱️ Time** — Cycles pass, age increases, AMH declines

---

## Key Decision Points

1. **When to escalate** — try again or move to next treatment?
2. **Treatment timing** — this month or take a break?
3. **Medication protocols** — aggressive vs. conservative stimulation
4. **Embryo decisions** — fresh vs. frozen transfer, how many to transfer
5. **Self-care vs. pushing forward** — rest or keep going?
6. **Relationship maintenance** — date night or save money?

---

## Win/Loss Conditions

| Outcome | Trigger |
|---------|---------|
| **Win** | Live birth (baby comes home) |
| **Partial Win** | Pregnancy achieved (hopeful ending) |
| **Loss** | Resources exhausted, couple decides to stop |
| **Alternative Win** | Adoption path, childfree resolution |

---

## Tech Stack (finalized)

```
game/
├── src/
│   ├── config/       # Game constants, colors, tile sizes
│   ├── core/         # IsoUtils, Pathfinder (A*)
│   ├── entities/     # Entity → Character, Building base classes
│   ├── scenes/       # Phaser scenes (GameScene, etc.)
│   ├── systems/      # Game systems (fertility calc, events)
│   └── main.ts       # Entry point
```

- **Engine**: Phaser 3.80 + TypeScript
- **Build**: Vite (fast HMR, modern bundling)
- **Isometric**: Custom `IsoUtils` (grid↔screen conversion, depth sorting)
- **Pathfinding**: A* implementation in `Pathfinder.ts`
- **Backend**: Python API wrapping `calculator.py` logic
- **Art**: Procedural graphics initially, Aseprite/Tiled later

---

## Quick Start

```bash
cd game
nvm use          # Node 20+
npm install
npm run dev      # → http://localhost:3000
```

---

## MVP Scope

1. Single couple, fixed starting profile
2. IUI → IVF path only
3. 3 locations (Home, Clinic, Procedure Room)
4. Core attrition calculator integrated
5. ~15 min playthrough

---

## Future Features

- Character customization (age, conditions)
- Multiple story branches
- Multiplayer: compare journeys
- Educational tooltips explaining real science
- Emotional support mini-games

