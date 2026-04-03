# STEP 8 — TESTING & QA

## Purpose

To validate the functionality of the system by comparing inputs with expected outputs and verifying system behavior.

---

## CORE TEST CASES

### 1. ROOM SYSTEM

| Test ID | Scenario     | Expected Result                        | Status |
| ------- | ------------ | -------------------------------------- | ------ |
| TC-01   | Create Room  | Room ID generated and host initialized | PASS   |
| TC-02   | Join Room    | Player successfully joins lobby        | PASS   |
| TC-03   | Invalid Room | Error message shown                    | PASS   |
| TC-04   | Reconnect    | Player reconnects with same identity   | PASS   |

---

### 2. PLAYER SYSTEM

| Test ID | Scenario         | Expected Result                 | Status |
| ------- | ---------------- | ------------------------------- | ------ |
| TC-05   | Player Join      | Player appears on host screen   | PASS   |
| TC-06   | Color Assignment | Each player has a unique color  | PASS   |
| TC-07   | Disconnect       | Player marked disconnected      | PASS   |
| TC-08   | Rejoin           | Player state restored correctly | PASS   |

---

### 3. GAME LIFECYCLE

| Test ID | Scenario        | Expected Result                   | Status |
| ------- | --------------- | --------------------------------- | ------ |
| TC-09   | Game Start      | Game loads on host                | PASS   |
| TC-10   | Minimum Players | Game pauses if players < required | PASS   |
| TC-11   | Resume          | Game resumes when players rejoin  | PASS   |
| TC-12   | Return to Lobby | System resets to lobby state      | PASS   |

---

### 4. INPUT SYSTEM

| Test ID | Scenario          | Expected Result        | Status |
| ------- | ----------------- | ---------------------- | ------ |
| TC-13   | Movement Input    | Player moves correctly | PASS   |
| TC-14   | Diagonal Movement | No speed boost         | PASS   |
| TC-15   | Continuous Input  | System remains stable  | PASS   |

---

### 5. RACER GAME

| Test ID | Scenario     | Expected Result                | Status |
| ------- | ------------ | ------------------------------ | ------ |
| TC-16   | Car Movement | Smooth movement based on input | PASS   |
| TC-17   | Rotation     | Correct directional rotation   | PASS   |
| TC-18   | Checkpoints  | Checkpoint progression tracked | PASS   |
| TC-19   | Lap Count    | Lap increments correctly       | PASS   |
| TC-20   | Finish       | Winner determined correctly    | PASS   |
| TC-21   | Pause        | Game pauses when players < 2   | PASS   |

---

### 6. PAINT GAME

| Test ID | Scenario          | Expected Result                 | Status |
| ------- | ----------------- | ------------------------------- | ------ |
| TC-22   | Painting          | Cells change color correctly    | PASS   |
| TC-23   | Territory Control | Ownership updates accurately    | PASS   |
| TC-24   | Score Update      | Scores reflect painted area     | PASS   |
| TC-25   | Powerups          | Effects applied correctly       | PASS   |
| TC-26   | Freeze Effect     | Player movement stops instantly | PASS   |
| TC-27   | Pause System      | Game pauses on disconnect       | PASS   |
| TC-28   | Game Over         | Winner displayed on host        | PASS   |

---

### 7. SOCKET COMMUNICATION

| Test ID | Scenario            | Expected Result                  | Status |
| ------- | ------------------- | -------------------------------- | ------ |
| TC-29   | Input Sync          | Host updates in real-time        | PASS   |
| TC-30   | State Sync          | Server state reflected correctly | PASS   |
| TC-31   | Disconnect Handling | No system crash                  | PASS   |

---

### 8. HOST RENDERING

| Test ID | Scenario         | Expected Result         | Status |
| ------- | ---------------- | ----------------------- | ------ |
| TC-32   | Player Rendering | Players visible on host | PASS   |
| TC-33   | Pause UI         | Pause overlay displayed | PASS   |
| TC-34   | Winner UI        | Winner shown correctly  | PASS   |

---

## SUMMARY
- Multiplayer interaction stable
- Modular game system functioning correctly
- No critical failures observed
