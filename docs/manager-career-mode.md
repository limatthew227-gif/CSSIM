# Manager Career Mode Specification

Status: Product and implementation specification  
Working title: **Organization Manager**  
Target: Major Draft Lab player career mode

## 1. Summary

Organization Manager is a persistent career mode where the user runs a Counter-Strike organization across multiple seasons. The user controls non-Major tournament registration, roster construction, contracts, trades, staff, finances, and long-term strategy while the existing match simulator handles competition. Major participation is assigned automatically from VRS.

This mode should feel like managing one club inside a living Counter-Strike world. AI teams sign players, reject or counter trade offers, register for events, gain and lose VRS points, change lineups, and develop over time. Every completed match remains connected to the Vault and player history.

## 2. Product Goals

- Give the user meaningful decisions between tournaments, not only during matches.
- Make tournament access earned through VRS ranking, qualifiers, invitations, and registration.
- Replace one-click player swaps with believable contract and trade negotiation.
- Preserve a coherent world where every team has one unique VRS rank, roster, schedule, and history.
- Make age, potential, form, role fit, salary, and contract status matter in different ways.
- Reuse Event Overview, live matches, Auto Coach, player pages, rankings, and the Vault.
- Keep the mode understandable without requiring the user to manage every minor operational detail.

## 3. Non-Goals for the First Release

- No real-money gambling, loot boxes, or monetization systems.
- No manual facility construction or detailed travel booking.
- No multi-user online league.
- No unrestricted player editor inside an active ranked career.
- No daily training minigames. Training is handled through plans and simulated outcomes.
- No full legal contract simulator. Contracts use a small set of readable terms.

## 4. Core Fantasy and Loop

The user should repeatedly answer four questions:

1. **Where should we compete?** Review the calendar and register for appropriate tournaments.
2. **Who should represent us?** Manage starters, bench players, contracts, trades, and free agents.
3. **How should we prepare?** Set training focus, lineup, map priorities, and coaching control.
4. **What did we learn?** Review results, VRS movement, development, finances, and new opportunities.

The standard loop is:

`Inbox -> Calendar -> Registration -> Preparation -> Tournament -> Review -> Market -> Next week`

## 5. Starting a Career

The setup flow asks the user to:

- Select an existing organization or create a custom organization.
- Choose the starting date and database era.
- Choose a starting reputation tier: contender, established, or elite.
- Select normal, hard, or legend management difficulty.
- Confirm the inherited roster, coach, contracts, cash, VRS points, and board expectations.

Recommended default: start as a contender with five players, one coach, six months of operating cash, and a VRS rank between 25 and 40. The team is automatically assigned to the Major path selected by its launch-day VRS rank.

Existing Classic, Circuit, Random, and Spectator modes remain available and unchanged. Manager mode is a new save type and does not silently convert old saves.

### 5.1 Takeover Onboarding

Manager mode does not use the fantasy draft. The first playable screen is an organization takeover desk:

1. Filter and compare existing organizations by VRS tier.
2. Select a club and inspect its inherited five-player roster, coach, VRS points, operating cash, contracts, and payroll.
3. Confirm the takeover. Built-in organizations retain their visual identity and head coach; a custom organization with no coach appoints one before entering headquarters.
4. Arrive at headquarters with the inherited squad intact and an Inbox prompt to audit contracts and choose the first tournament.

The opening choice should be about the situation the manager wants to inherit, not about assembling an immediately optimal fantasy lineup. Elite clubs begin with stronger rankings and higher expectations, while challenger clubs have more forgiving objectives and more routes through open events.

This direction follows the useful common loop in current esports management games: take over an existing team, assess the roster, then improve it through recruitment, training, contracts, and tournament planning. The match simulator remains Major Draft Lab's differentiator and is entered through the calendar rather than replacing the management layer.

### 5.2 Design References

- [Esports Manager 2026](https://store.steampowered.com/app/2749950/Esports_Manager_2026/) supports taking over an existing team and centers its loop on contracts, transfers, training, morale, staff, and tournament results.
- [Esports Life Tycoon](https://store.steampowered.com/app/897410/Esports_Life_Tycoon/) connects recruitment with player well-being, team chemistry, opponent analysis, staff, and facilities.
- [Teamfight Manager](https://store.steampowered.com/app/1372810/Teamfight_Manager/) makes the choice between recruiting new talent and developing the current roster a recurring management decision.

Major Draft Lab should borrow the clarity of those loops while keeping Counter-Strike-specific VRS access, roster locks, map preparation, live coaching, and the Vault as its own identity.

## 6. Time and World Simulation

Manager mode uses a week-based calendar with specific event dates and registration deadlines.

- The world advances only when the user presses **Continue**, begins a match, or confirms travel to an event.
- Inbox items that require a decision stop automatic advancement.
- AI matches, registrations, roster moves, contract expirations, and VRS changes resolve during advancement.
- A tournament blocks its listed dates. Overlapping registrations are not allowed unless one is only a backup qualifier.
- Players continue to age by 0.5 years after each Major, matching the existing save-local aging rule.
- Non-Major events affect form and development evidence but do not trigger the 0.5-year age step.
- Each Major is a development checkpoint where OVR changes are resolved and potential remains hidden or partially scouted.

The world simulation must be deterministic from the save seed. Reloading the same save before advancing should not produce different AI decisions.

## 7. Tournament Calendar and Registration

Every tournament is represented by an event record with:

- Name, organizer, region, tier, dates, and format.
- Team capacity and registered team list.
- Entry method: invite, VRS invitation, open registration, closed qualifier, or linked qualification.
- Minimum and maximum VRS rank, if applicable.
- Regional eligibility, if applicable.
- Registration deadline and roster-lock date.
- Entry fee, travel cost, prize pool, and VRS weight. Valve-funded Majors have a $0 organization commitment.
- Major sticker revenue is cumulative: $400,000 on reaching Stage 1, $550,000 at Stage 2, and $700,000 at Stage 3. Advancing pays only the difference between tiers.
- A Major champion earns an additional $500,000 organization share from the Champions Capsule.
- Linked qualifier and destination event IDs.
- Schedule conflicts and current registration status.

### Registration Flow

1. The Calendar shows every announced event, not only events the team can enter.
2. The event page explains eligibility with a clear pass/fail checklist.
3. The user selects **Register**, **Accept Invite**, **Join Qualifier**, or **Watchlist**.
4. Open events confirm immediately when space exists.
5. Oversubscribed events select teams by invitation priority, VRS, region, and application time.
6. A rejected application creates an inbox message and suggests realistic alternatives.
7. A roster lock stores the five starters and any permitted substitute for that event.

The user may withdraw before roster lock with a small reputation cost. Withdrawing after roster lock adds a larger reputation penalty and may forfeit fees.

### Event Discovery

The Calendar has four views:

- **My Schedule:** confirmed events, deadlines, and conflicts.
- **Available:** events the team can currently enter.
- **All Events:** the complete world calendar.
- **Qualifying Paths:** visual routes from open qualifiers to elite events and Majors.

## 8. Invitations and Reputation

Tournament access uses both objective VRS standing and organization reputation.

- VRS determines competitive seeding and rank-based invitations.
- Reputation influences discretionary invites, organizer trust, sponsor interest, and withdrawal penalties.
- Winning strong events increases both VRS and reputation.
- Farming weak events gives reduced VRS value and limited reputation.
- A new lineup does not reset the organization ranking, but major roster turnover applies the existing VRS roster-change penalty.

Invitation logic must always explain why an invite was received or missed. Example: `Invited: #14 VRS, top eight eligible teams in Europe.`

## 9. Organization Roster

An organization may hold:

- Five registered starters.
- Up to two bench or substitute players.
- One head coach.
- Optional analyst and scout roles in a later release.

Every player has save-local status:

- Contract terms and remaining duration.
- Salary, buyout, and squad role.
- Starter, bench, transfer-listed, or unavailable state.
- Morale, recent form, fatigue, and team familiarity.
- Career age, OVR, hidden potential, and scouting confidence.
- Trade history and previous organizations.

The user must have five eligible starters before a roster lock. Role warnings are allowed, but a lineup missing required role coverage receives the existing composition penalties.

## 10. Contracts and Free Agency

A contract contains:

- Duration measured in Major cycles: 0.5, 1, 1.5, or 2 years.
- Salary per month.
- Signing bonus.
- Buyout amount.
- Expected squad role: star, starter, rotation, prospect, or bench.
- Optional performance bonus for Major qualification or tournament wins.

Contract negotiation is turn-based through the Inbox:

1. The user submits terms.
2. The player evaluates salary, role, team strength, reputation, nationality/region preference, and competing offers.
3. The player accepts, rejects, or counters after one to three in-game days.
4. Repeated low offers reduce willingness to negotiate for a short period.

Expiring players may sign a pre-contract in the final contract window. Free agents can be signed without team compensation but may demand a larger signing bonus.

## 11. Trade and Transfer Negotiation

The Trade Center lets the user approach any organization and request a player. A proposal may include:

- One incoming player.
- Zero or one outgoing player in the first release.
- A cash payment from either team.
- Optional buyout activation instead of negotiation.

Future releases may add multi-player packages, salary retention, and conditional bonuses.

### Negotiation States

`Draft -> Submitted -> Considering -> Accepted | Rejected | Countered | Withdrawn | Expired`

The receiving AI team evaluates:

- Current OVR and projected performance.
- Age and hidden potential known to that AI team.
- Recent event form and sample size.
- Contract value relative to salary and duration.
- Role scarcity and the team's lineup needs.
- Starter importance, bench status, and transfer-list status.
- VRS/reputation difference between organizations.
- Whether the proposed outgoing player solves a real roster need.
- Relationship effects from previous fair, unfair, or abandoned negotiations.

A conceptual valuation is:

`trade value = performance + potential + role scarcity + contract surplus + form - age risk - salary burden`

The exact weights remain hidden, but the UI provides reasons such as:

- `We cannot lose our only IGL.`
- `Your offer is close, but we require $18,000 more.`
- `The player is interested, but your proposed squad role is too small.`
- `We value your prospect more highly than the veteran offered.`

### Trade Rules

- Both teams must retain at least five contracted players or have a legal completion plan.
- A player cannot appear in two active negotiations simultaneously without being marked available.
- Accepted trades require player contract approval when salary or squad role changes.
- Event roster locks may delay the transfer until the event ends.
- AI teams cannot accept offers that leave them without essential role coverage unless they have a replacement deal queued.
- The user cannot repeatedly resubmit the same rejected offer without changing its value.
- Trade decisions are saved at submission time and resolve deterministically.

## 12. AI Team Management

Every AI organization has a lightweight manager profile:

- Ambition: rebuild, contend, or maintain.
- Budget tier and salary tolerance.
- Preferred regions and player nationalities.
- Risk tolerance for prospects and veterans.
- Roster needs by role.
- Job security and recent performance pressure.

AI teams must:

- Register for events appropriate to their VRS and region.
- Avoid impossible schedule conflicts.
- Renew core players before chasing replacements.
- Bench or list players after sustained underperformance.
- Pursue free agents and trades that solve actual needs.
- Preserve historical era teams as distinct organizations where the database intentionally includes them.
- Allow a historical organization to be chosen as the user's takeover, carrying that one roster into the current career as an alternate-history club.
- Build AI-controlled 2026 tournament fields from contemporary rosters. Historical rosters do not enter qualifiers or invitations unless they are the user's selected club.
- Produce one unique ranking entry per organization/era identity.

AI roster moves should be infrequent enough that team identities remain recognizable. A normal target is two to five moves across the entire top-30 world per Major cycle.

Elite clubs add a control premium to superstar valuations and do not make speculative roster swaps. A top-10 team only opens a place after both a disappointing team result and a meaningful sample in which that specific player performed well below his expected level. Lower-ranked teams have progressively more rebuilding tolerance.

## 13. Scouting and Hidden Potential

Potential remains save-local and is never shown as perfectly known at career start.

- HLTV prospect report placement seeds the hidden talent prior.
- Age, report frequency, ranking position, maps played, and current OVR shape the potential range.
- A scout report reveals a range such as `84-89`, not the exact ceiling.
- More scouting narrows the range but never guarantees development.
- Tournament performance updates confidence in the projection.
- AI teams have their own knowledge of players and do not share the user's uncertainty.

Player pages add a **Manager** tab containing contract status, interest, estimated value, scout confidence, transfer availability, and fit with the current roster.

## 14. Development, Form, Morale, and Familiarity

- OVR development continues to use age, potential, performance, placement, role, and sample size.
- Form is short-term and influences the next maps without permanently changing OVR.
- Morale responds to results, promised squad role, benching, failed transfers, and contract talks.
- Familiarity grows when the same core plays together and declines after roster moves.
- Familiarity affects team coordination modestly; it must not overpower player quality.
- A player requesting a transfer does not automatically become unusable, but prolonged unhappiness affects form and renewal interest.

No single bad event should destroy a player. Development and morale changes require meaningful samples and use visible caps.

## 15. Finances

The organization ledger tracks:

### Income

- Prize money.
- Sponsor payment.
- Tournament participation stipend.
- Player sale or trade cash.
- Board investment for lower difficulty starts.

### Expenses

- Player and staff salary.
- Signing bonuses and buyouts.
- Entry fees and travel for non-Major events; Valve covers Major participation.
- Scouting assignments.
- Withdrawal penalties.

Finances should create tradeoffs without becoming accounting work. Salaries resolve monthly, while event costs and transfer fees resolve immediately.

The game warns before a transaction would leave less than two months of payroll. Debt is allowed only through an emergency board advance that damages reputation and future budget.

## 16. Staff and Auto Coach

The manager controls personnel and preparation; the coach controls match tactics.

- **Manual Coaching:** the user makes timeout and strategy calls during live matches.
- **Auto Coach:** the coach automatically handles timeouts and strategy changes using their style and rating.
- Better coaches make stronger recommendations, adapt earlier, and waste fewer timeouts.
- The user can set a pre-match philosophy even with Auto Coach enabled.
- Staff contracts and coach trades use the same basic negotiation framework as players, without player swaps in the first release.

## 17. Manager Universe Hub

The existing Universe page becomes the home screen for Manager mode.

### First Viewport

- Current date and next mandatory deadline.
- Team VRS rank, cash, monthly payroll, form, and board confidence.
- Next event or open registration.
- Decision Inbox with the most urgent item first.
- Continue button showing what date or decision it advances to.

### Primary Navigation

- **Home:** Universe hub and inbox.
- **Calendar:** events, registrations, and qualifying paths.
- **Roster:** lineup, contracts, roles, morale, and development.
- **Market:** trades, free agents, transfer list, and scouting.
- **Rankings:** unique VRS table and event qualification cutoffs.
- **Finances:** cash flow, payroll, and transaction history.
- **Vault:** saved team, player, event, and match history.

The interface should remain dense and operational. Avoid decorative dashboard cards and keep tables optimized for comparison and repeated actions.

## 18. Inbox and Notifications

All decisions enter one ordered Inbox:

- Trade responses and counteroffers.
- Player contract responses.
- Tournament invitations and registration results.
- Registration and roster-lock deadlines.
- Player concerns, transfer requests, and injury/unavailability notices if injuries are added later.
- Sponsor or board objectives.
- Scout report completion.
- VRS and event qualification changes.

Each item has a severity, deadline, related entity, and direct action. The game cannot advance past an expired mandatory choice without resolving it automatically using a clearly stated fallback.

## 19. Match and Tournament Integration

- Registered events use the existing Swiss, playoff, veto, match, result, stats, and Event Overview screens.
- Event records carry a stable event instance ID so multiple tournaments and seasons never merge in player history.
- The selected locked lineup is copied into the event instance; later trades do not rewrite old results.
- All maps are recorded in the Vault with event, season, stage, organization, and player-instance identity.
- Player pages list placements and results by event instance, not by generic stage labels.
- Simulated AI matches update the event overview, VRS table, and world news even when the user does not participate.

## 20. Persistence and Data Ownership

Manager mode uses a versioned `ManagerCareerState` stored inside the run snapshot. Source roster data remains immutable.

Required persistent state includes:

```ts
interface ManagerCareerState {
  version: number;
  seed: string;
  date: string;
  organizationId: string;
  cash: number;
  reputation: number;
  boardConfidence: number;
  contracts: PlayerContract[];
  staffContracts: StaffContract[];
  worldTeams: WorldTeamState[];
  eventInstances: EventInstance[];
  registrations: Registration[];
  negotiations: Negotiation[];
  inbox: InboxItem[];
  finances: LedgerEntry[];
  scouting: ScoutReport[];
  careerHistory: CareerHistoryEntry[];
}
```

Stable IDs are required for:

- Career/save universe.
- Organization era.
- Player identity and player career instance.
- Event template and event instance.
- Registration, contract, negotiation, and ledger transaction.

Save migration must be additive and tested. Missing new fields receive deterministic defaults. Old Classic and Circuit snapshots must continue loading without creating Manager state.

## 21. Core Simulation Order

When advancing the calendar, systems resolve in this order:

1. Expire deadlines and negotiations.
2. Resolve submitted contract and trade decisions.
3. Apply completed transfers and roster-lock delays.
4. Resolve tournament registrations and invitations.
5. Simulate AI event matches scheduled for the interval.
6. Apply prize money, VRS changes, form, and world news.
7. Process salaries and recurring finances.
8. Update scouting, morale, familiarity, and board confidence.
9. Generate Inbox items for the new date.

This order prevents a player from transferring before finishing a roster-locked event and prevents registrations from using outdated rankings.

## 22. Management Difficulty

Difficulty changes information and AI competence, not hidden score bonuses inside matches.

- **Normal:** wider finances, more negotiation guidance, slower AI market competition.
- **Hard:** tighter budgets, stronger counteroffers, fewer discretionary invites.
- **Legend:** limited scouting certainty, aggressive AI bidding, demanding board targets.

Match difficulty remains a separate setting and continues to control match simulation.

## 23. Failure and Recovery

There is no arbitrary game over after one bad season.

- Low board confidence reduces future budget and may trigger a warning objective.
- Sustained failure can cause dismissal, ending that organization tenure.
- The save may continue by accepting an offer from another organization.
- Bankruptcy triggers an emergency board advance or forced player sale before dismissal.
- A manager history page records teams managed, trophies, Major placements, trades, and career earnings.

Changing organizations is a later milestone, but the state model should not assume the user controls one organization forever.

## 24. First Release Scope (MVP)

The first playable Manager release should include:

- Persistent calendar covering one Major cycle.
- Eight to twelve tournament templates across multiple tiers.
- Event registration, invitations, deadlines, conflicts, and roster locks.
- Five starters plus one bench slot.
- Player contracts, free agency, buyouts, and one-for-one trade offers with cash.
- AI accept, reject, and counter behavior with visible reasons.
- Dynamic AI event registration and limited roster movement.
- Unique VRS ranking and qualification paths.
- Basic salary, prize, fee, and transfer ledger.
- Manager Universe home, Calendar, Roster, Market, and Inbox screens.
- Existing match flow, Auto Coach, Event Overview, player pages, and Vault integration.

Do not add staff departments, academy leagues, injuries, sponsors, or job switching until the core calendar and trade loop is stable.

## 25. Recommended Delivery Phases

### Phase 1: Career Foundation

- Add Manager save type, deterministic clock, world team state, and versioned persistence.
- Build Calendar and Inbox.
- Convert current Circuit events into event templates and instances.

### Phase 2: Tournament Management

- Add registration, eligibility, invitations, deadlines, conflicts, and roster locks.
- Simulate AI registrations and non-user matches.
- Connect VRS movement and qualifying paths.

### Phase 3: Contracts and Market

- Add contracts, payroll, free agents, transfer list, and player interest.
- Replace the current one-click transfer window in Manager mode.

### Phase 4: Trades

- Add organization approaches, one-for-one offers, cash, counters, delays, and AI roster needs.
- Add negotiation history and relationship memory.

### Phase 5: Career Depth

- Add morale, familiarity, board confidence, reputation, scouting ranges, and financial pressure.
- Expand Universe news and player Manager tabs.

### 25.1 Implementation Status (July 21, 2026)

- **Phase 1 playable:** versioned Manager save state, deterministic date, headquarters, Inbox, ledger, and one-cycle calendar.
- **Phase 2 playable foundation:** eligibility, registration, deadlines, conflicts, roster locks, travel gates, event launch, prize settlement, VRS movement, and one unified Major cycle. The calendar currently includes direct single-elimination, Swiss, round-robin, and invite formats, with cash prizes separated from qualification stakes. Major entry is recalculated from the manager's VRS at launch: ranks 1-8 enter Stage 3, 9-16 enter Stage 2, 17-24 enter Stage 1, and 25+ enter the MRQ. Qualifying advances the same locked roster through later stages without a new registration or fee. Older saves with the retired standalone MRQ are migrated into this unified Major.
- **Career-era rule:** historical organizations remain valid manager takeovers, but AI-controlled 2026 event fields use contemporary rosters. A selected historical club is the sole deliberate carryover into the current-world circuit.
- **Phase 3 playable foundation:** existing-organization takeover, inherited contracts, monthly payroll, operating runway, and a dedicated Roster and Contracts screen.
- **Recruitment Hub playable:** deterministic free-agent and transfer-listed pools, role/search filters, save-local shortlists, paid scouting reports, hidden potential ranges, player-interest scoring, contract offers, reserve signings, signing bonuses, payroll changes, ledger entries, and Inbox responses.
- **Contract renewals playable:** final-cycle and expired deals can be renegotiated from Roster and Contracts with salary, term, interest, and a renewal bonus. Renewed expired players return to the bench, while former signings correctly re-enter free agency instead of remaining permanently blocked by market history.
- **Phase 4 playable:** scouted transfer-listed players support one-for-one proposals with cash adjustments, seller valuation, deterministic one-to-three-day responses, accept/reject/counter outcomes, competing bids, three-round negotiation limits, expiring counters, withdrawals, club relationship memory, full negotiation history, and roster-lock delays. Delayed deals reserve their cash when accepted; completed exchanges update both clubs' future rosters, contracts, cash, the ledger, Inbox, and future unlocked event rosters.
- **Phase 4 completion gate:** trade decisions, active counters, rival pressure, relationship history, and seller roster moves persist through save migration and are covered by deterministic state-transition tests. The Recruitment Hub keeps completed and failed talks available in a dedicated Negotiations view.
- **Lineup management playable:** the Roster screen supports an explicit starting five across an eight-player squad, updates starter and bench status, carries unlocked lineup changes into event registration, and prevents changes after roster lock.
- **Roster planning playable:** a five-slot depth chart exposes IGL, AWP, Entry, Support, and flex coverage before registration. Vacant roles link directly to filtered recruitment, while surplus bench contracts can be released for a settlement without bypassing event locks or the five-player minimum.
- **Player training playable:** every contracted player has a persistent balanced, mechanics, tactics, role, or recovery plan. Event cycles convert age, remaining potential, participation, placement, and performance against expectations into development progress; younger high-potential performers improve fastest, bench players progress at a reduced rate, and every completed development level updates the player's saved OVR and underlying attributes. Recovery trades most development speed for morale and form restoration, and training plans lock while an event is active.
- **Potential Lab playable:** a manager can commit $200,000 to a save-deterministic heads-or-tails flip for any contracted player. A correct call permanently adds one to that player's save-local potential, with no 99 ceiling; a miss still consumes the investment. Every attempt is recorded in the player's development plan, organization ledger, and Inbox.
- **Performance Camps playable:** between events, the manager can reserve a seven-day System, Firepower, or Reset camp. Camps become real calendar checkpoints, cannot overlap a confirmed tournament, charge the ledger when booked, and resolve squad-wide familiarity, development progress, morale, and form through normal date advancement.
- **Roster operations redesigned:** Lineup, Development, and Contracts now use separate workspaces. The lineup view provides a visual starting-five selector, Development combines training and Potential Lab records, and Contracts uses responsive player cards instead of a wide spreadsheet.
- **Phase 5 playable foundation:** save-local morale, recent form, and familiarity move after events, benching, signings, trades, and failed transfer talks. These values use capped modifiers in the next event. Headquarters now exposes a persistent board mandate, payroll runway pressure, squad pulse, and a separate Universe transfer wire. Player profiles include a Manager tab for contracts, scouting confidence, value, availability, and roster fit. Completed seasons now roll into alternating Spring/Fall six-month cycles with fresh event dates, registrations, board mandates, and contract-year decisions.
- **Club history playable:** every newly completed Manager event stores an immutable archive of its field, stage, standings, bracket, series, and map results. Completed rows in Headquarters and Calendar reopen the full event overview, while Club Honors presents separate Major and LAN ledgers with placements, prize money, VRS movement, records, and event drilldowns. Older saves without archive metadata use a Vault-backed recap so their existing match history remains accessible.

## 26. Acceptance Criteria

Manager mode is ready for its first public-quality release when:

- A user can play continuously through a full Major cycle without returning to setup.
- The user can discover, register for, play, withdraw from, and review tournaments.
- Eligibility and rejection reasons are always visible and correct.
- A trade can be proposed, countered, accepted, delayed by roster lock, and reflected on both teams.
- AI teams never field duplicate players or fewer than five eligible starters.
- Every world team has one unique VRS position after each ranking update.
- Player contracts, ages, potential, OVR, and roster history remain isolated to that save.
- Past event results and player placements remain correctly split in the Vault.
- Reloading a save preserves pending negotiations, deadlines, registrations, and deterministic outcomes.
- Existing Classic, Circuit, Random, and Spectator saves still load and play correctly.
- All state transitions have unit tests, especially registration, negotiation, roster lock, VRS, and migration behavior.

## 27. Product Principle

Every screen should answer at least one of these questions without forcing the user to hunt:

- What needs my attention now?
- What happens if I wait?
- Why did this team or player make that decision?
- How does this affect my next tournament and long-term career?

When the game can answer those four questions consistently, Manager mode will feel like a connected world rather than a collection of menus.
