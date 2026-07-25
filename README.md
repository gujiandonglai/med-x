# 病毒清理者 MED-X

A 3D roguelike action-shooter built with Three.js (native ES modules, no
bundler). You play a nanobot dispatched into the human body — fight your
way through three organ biomes (blood vessel → lung → liver), each capped
by a multi-phase boss, while a living immune-system ecosystem (red/white
blood cells, platelets, macrophages, dendritic cells) fights alongside
and around you.

This is a **vertical slice**: one fully playable loop covering every
system in the design doc, built for extension rather than as a demo.

## Running it

Browsers block ES module imports over `file://`, so you need a static
file server. From this folder:

```bash
python3 -m http.server 8080
# or: npx serve .
```

Then open `http://localhost:8080`. No build step, no npm install needed
to run — `three.js` and the postprocessing addons are already vendored
into `vendor/`.

## Controls

| Action | Key |
|---|---|
| Move | WASD |
| Look | Mouse (click the canvas to lock the pointer) |
| Fire primary | Left click |
| Secondary weapon / skill | Q |
| Active skill | E |
| Ultimate | F |
| Dodge roll | Space |
| Sprint | Shift |
| Interact (supply/shop/event rooms) | C |
| Pause | Esc |

## Architecture

Matches the modular directory layout from the design doc — each folder
owns one concern and mostly talks to the rest through `world` (see
`src/main.js`) or `Core/EventBus.js`, not to each other directly.

```
src/
  core/        EventBus, ObjectPool, SpatialHash, InputManager, Config
               (all game-balance data), I18n (zh/en strings), the game-flow
               state machine
  ai/          Generic FiniteStateMachine (used for both game-flow AND
               enemy/boss AI) + steering helpers (seek/flee/wander/patrol)
  rendering/   SceneManager (renderer/camera/bloom postprocessing),
               EnvironmentBuilder (procedural room geometry), EffectsFactory
               (pooled particle bursts)
  gameplay/    Player, Enemy, Boss, EcosystemAgents, Projectile (pooled),
               Weapons, RoomManager (run/room progression), UpgradeSystem,
               Health (shared health+shield+status-effect component)
  physics/     Circle-collision + obstacle/arena resolution on the spatial hash
  audio/       AudioManager — synthesized SFX/music (see note below)
  ui/          HUD.js — the entire DOM UI layer (menus, HUD, modals)
  save/        SaveManager — settings, meta-progression, run snapshot
  networking/  NetworkStub — documented no-op interface for future co-op
  main.js      World: owns every subsystem + the frame loop
```

## What's implemented

- **3 heroes**, each with a full 5-part kit (primary/secondary/active/
  passive/ultimate): Assault (SMG + grenades + charge dash), Sniper
  (railgun + marker dart + focus aim), Guardian (scalpel melee + shield
  field + immune pulse).
- **Roguelike loop**: procedurally-typed rooms (combat/elite/supply/
  event/shop/hidden) per act, 3-choice upgrade offers after each fight,
  15 upgrades including 4 mutually-exclusive elemental payloads
  (freeze/burn/shock/corrode).
- **7 enemy types** with distinct FSM behaviors (melee, split-on-death,
  self-destruct, stealth/cloak, shielded, parasite, support-healer) plus
  an elite variant, and a multi-phase boss (telegraphed slam / spore
  burst / summon adds / charge sweep, with a fourth enrage phase).
- **Living ecosystem**: red blood cells (ambient traffic — killing them
  dings organ health), white blood cells (patrol + engage viruses on
  their own), platelets (seek and heal wounded allies), macrophages
  (hunt down weakened enemies), dendritic cells (summon reinforcement
  white blood cells on spotting a threat) — all running independently of
  player input.
- **ATP resource economy**: every shot/dash/skill costs ATP; glucose/
  lipid/mitochondria pickups and supply rooms restore it.
- **Pooling**: projectiles, particle bursts, and enemies (per-type pools)
  are all acquired/released rather than constructed per spawn.
- **Full menu system**: New Game / Continue / Save Data / Settings / Exit,
  hero select, pause menu (resume/save/settings/main menu), settings
  (music volume, SFX volume, language), a save-data screen with delete.
- **中文 + English**, switchable live from Settings — every player-facing
  string routes through `Core/I18n.js`.
- Bloom/HDR postprocessing, per-biome fog/color themes, a "microscope
  fantasy" environment (organic membrane walls, floating glowing cells,
  a drifting DNA-helix centerpiece).

## Known simplifications (by design, for this vertical-slice pass)

- **Audio is fully synthesized** (Web Audio oscillators/noise), not
  sample-based — there's no audio asset pipeline available in the
  environment this was built in. `Audio/AudioManager.js` is written so
  swapping in real `.mp3`/`.ogg` files later doesn't change its public
  API (`playSFX`/`setBiomeMusic`).
- **Save persistence** tries `localStorage` first and silently falls
  back to an in-memory store if that throws (e.g. inside a sandboxed
  preview iframe) — see the comment at the top of `save/SaveManager.js`.
  Self-hosted (per "Running it" above), it persists normally across
  reloads.
- **Boss fights aren't checkpointed mid-fight** — Continue restores you
  to the start of whatever room you were in.
- **Networking is a documented stub** (`networking/NetworkStub.js`) —
  no multiplayer transport yet, per the design doc's own phasing.
- **No touch/mobile control scheme** — this is a mouse+keyboard build;
  the UI is responsive down to small desktop windows but there's no
  on-screen joystick.
- Only one boss (`necroCore`) is defined; each act re-skins it with the
  biome's accent color. Adding more just means adding entries to
  `Core/Config.js#BOSSES` — the Boss class is fully data-driven.
- The overheat/jam mechanic mentioned in `ATP_ECONOMY.overheat` is
  defined but not yet wired into weapon firing (ATP-gating alone
  currently prevents infinite output).

## Extending it

Everything gameplay-facing is data in `Core/Config.js` — new heroes,
enemies, upgrades, biomes, and boss phases are additions to that file,
not new code, as long as they reuse an existing `behavior`/attack id. New
*behaviors* go in `Enemy.js`'s FSM or `Boss.js`'s `attacksData` dispatch.
New UI strings go in `Core/I18n.js` under both `zh` and `en`.
