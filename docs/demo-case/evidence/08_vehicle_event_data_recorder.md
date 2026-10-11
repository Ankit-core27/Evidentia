# EVENT DATA RECORDER (EDR) DOWNLOAD REPORT

**Vehicle:** Honda City, registration MH12 KE 4417 (white)
**Examined by:** Forensic Science Laboratory, Pune (Digital and Automotive Section), Examiner Dr Anjali Phadke
**Date of examination:** 18 August 2026
**Reference:** FSL/DAS/2026/1184
**Requested by:** PSI Anil Pawar, Kothrud Police Station
**Method:** Image taken from the airbag control module through the diagnostic port, with write blocker. The image has SHA-256 hash `7f3a91d2c0b84e5aa61f9e0c2b7d4f13c9a6e82d5b1c0f47a38e9d6b25c140ae`.

## 1. Recorded event

The module recorded a **non-deployment event** (impact threshold reached, no airbag deployment). The event is time-stamped by the module's internal clock, which was found to be **3 seconds ahead** of the controller clock when compared at the time of examination. Times below are corrected to controller (IST) time.

| Item | Value |
| --- | --- |
| Event time (corrected) | 14 August 2026, 22:13:49 IST |
| Maximum change in velocity | 14 km/h (forward, with a lateral component) |
| Delta-V direction | Forward and slightly left |

## 2. Pre-crash data (5 seconds, sampled every 0.5 s)

| Time before impact (s) | Speed (km/h) | Accelerator pedal (%) | Service brake |
| --- | --- | --- | --- |
| -5.0 | 64 | 41 | Off |
| -4.5 | 65 | 46 | Off |
| -4.0 | 65 | 48 | Off |
| -3.5 | 66 | 52 | Off |
| -3.0 | 66 | 55 | Off |
| -2.5 | 66 | 55 | Off |
| -2.0 | 66 | 54 | Off |
| -1.5 | 66 | 54 | Off |
| -1.0 | 64 | 0 | **On** |
| -0.5 | 52 | 0 | On |
| 0.0 | **44** | 0 | On |

- Brake first applied about **0.9 seconds** before impact.
- The accelerator remained pressed at about 54 percent until the brake was applied. There is no sign of the driver easing off the accelerator for the signal before the brake was applied.
- Steering input: within plus or minus 3 degrees throughout. **No evasive steering.**
- Anti-lock braking active: Yes, from -0.9 s.
- The posted speed limit at the location is 40 km/h. The vehicle was recorded at **66 km/h**, which is **26 km/h over the limit**, up to 1.0 s before impact.

## 3. Occupant data

| Item | Value |
| --- | --- |
| Driver seat belt | Buckled |
| Front passenger seat occupant classification | **Occupied** (adult-class occupant sensed) |
| Front passenger seat belt | **Buckled** at the time of the event |
| Rear seats | Not occupied |

The occupant classification sensor and the seat belt buckle switch both indicate that **an adult occupied the front passenger seat** at the time of the event.

## 4. Connected devices

The infotainment head unit log (extracted by the same lab, ref FSL/DAS/2026/1184-B) shows a **phone paired by Bluetooth** named "Rajesh iPhone". The log shows the call was routed to the **phone's own speaker, not through the car's hands-free system**, from 22:12:58 onward. The head unit's "call routed to car" state was not set at any time in the log period.

## 5. Limitations

- The module does not record who was in the passenger seat, only that an adult-class occupant was sensed.
- The module does not record the state of the traffic signal.
