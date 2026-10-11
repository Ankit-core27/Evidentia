# PUNE MUNICIPAL CORPORATION: TRAFFIC SIGNAL CELL

## SIGNAL CONTROLLER EVENT LOG EXTRACT

| Field | Detail |
| --- | --- |
| Controller ID | J-17-09 (Sahyadri Chowk, Karve Road and Lane 7) |
| Controller make | Adaptive fixed-time, four-phase, GPS time-synchronised |
| Clock check | Controller clock verified against GPS reference at 22:00:00 on 14 August 2026. Drift: 0.0 s |
| Extract requested by | PSI Anil Pawar, Kothrud Police Station (letter dated 15 August 2026) |
| Extract certified by | Imran Sheikh, Junior Engineer, Signal Cell, Pune Municipal Corporation |
| Log period | 14 August 2026, 22:12:00 to 22:15:00 IST |

### Phase plan

| Phase | Movement | Normal timings |
| --- | --- | --- |
| 1 | Karve Road, east-west (both directions) | Green 38 s, amber 3 s, all-red 3 s |
| 2 | Lane 7, north-south (both directions) | Green 22 s, amber 3 s, all-red 3 s |

### Event log (all times IST, controller clock)

| Time | Event | Detail |
| --- | --- | --- |
| 22:13:03 | Phase 1 green | East-west green begins |
| 22:13:41 | Phase 1 amber | East-west amber begins (38 s of green completed) |
| 22:13:44 | Phase 1 red | East-west red begins. North-south still red |
| 22:13:44 to 22:13:47 | All-red clearance | All four arms red for 3 s |
| 22:13:47 | Phase 2 green | North-south green begins |
| 22:13:49 | Controller note | Loop detector on Lane 7 north approach (stop line) registered vehicle presence at 22:13:48. Detector on Karve Road west approach registered vehicle presence at 22:13:48 |
| 22:14:09 | Phase 2 amber | North-south amber begins |
| 22:14:12 | Phase 2 red | North-south red |
| 22:14:15 | Phase 1 green | East-west green begins |

### Engineer's remarks

1. At the time of collision, recorded by the junction CCTV as 22:13:49, the Karve Road (east-west) signal had been **red for 5 seconds**, having turned amber at 22:13:41 and red at 22:13:44.
2. The Lane 7 (north-south) signal had been **green for 2 seconds**.
3. There was **no controller fault, no flashing-amber mode and no manual override** at any point in the log period. All lamp heads reported healthy. The east-west amber lasted the full 3 seconds.
4. The east-west red lamp for eastbound traffic is visible from at least 120 m on the approach, per the site survey.

Signed: Imran Sheikh, Junior Engineer, Signal Cell, Pune Municipal Corporation
