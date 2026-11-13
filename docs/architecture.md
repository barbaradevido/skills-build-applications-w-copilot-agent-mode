# OctoFit Tracker architecture

OctoFit Tracker is a three-tier application for a school fitness program. The starter code includes API contracts and intentionally incomplete implementation points so you can use GitHub Copilot agent mode in a test-driven loop.

![Three-tier OctoFit architecture](../.github/images/octofit-architecture.svg)

## Tier boundaries

- **Presentation tier**: React 19, Vite, React Router, Bootstrap, and a shared API client in `octofit-tracker/frontend/src`.
- **Logic tier**: Express and TypeScript routes/services in `octofit-tracker/backend/src` expose `/api/*` behavior on port `8000`.
- **Data tier**: Mongoose models and seed data in `octofit-tracker/backend/src/models` and `src/scripts/seed.ts` persist to MongoDB on port `27017`.

## Ports and environment rules

- MongoDB: `27017`
- Express API: `8000`
- Vite frontend: `5173`
- The browser calls relative `/api` paths. Vite proxies them to `http://localhost:8000`, so the unauthenticated API port stays private in Codespaces. `VITE_API_BASE_URL` can override the base URL.

## API contract

| Capability | Method and path | Expected behavior |
| --- | --- | --- |
| Activity tracking | `GET /api/activities`, `POST /api/activities` | List and create valid activity records. POST accepts `userId`, `teamId`, `type`, and `minutes`; `userId` and `teamId` must be well-formed IDs for an existing user and team; otherwise respond with a deliberate 4xx (never a 500 from a cast error). A created activity stores the submitted `user`, `team`, `type`, and `minutes` plus computed `points` and `occurredAt`. |
| Teams | `GET /api/teams`, `POST /api/teams` | List and create teams with members. Created and listed teams keep the submitted `name` and `mascot`. Reject a team without a name with `400`. |
| Leaderboard | `GET /api/leaderboard` | Return teams ordered by the sum of their activity points, highest first. Each entry has `teamName`, `totalPoints`, and a 1-based `rank`. |
| Workout suggestions | `GET /api/workouts/suggestions/:userEmail` | Recommend workouts from recent activity patterns for the matching seeded user's email address. The first suggestion's `focus` matches that user's goal or recent activity, with a `reason` explaining why. An email with no matching user returns a deliberate 4xx (for example, `404`). |

## Implementation decisions

Record your plan here before editing code.

- Presentation tier decision: Build the app as route-based pages that fetch from the API and render accessible loading, empty, and error states. Each route should be driven by the contract in `octofit-tracker/frontend/tests/app.contract.test.tsx`, keeping the UI thin and focused on rendering data rather than business logic.
- Logic tier decision: Keep the Express API in a single app entry point with route handlers that validate request bodies, convert bad references into deliberate 4xx responses, and return normalized JSON payloads for activities, teams, leaderboard, and workout suggestions.
- Data tier decision: Define strict Mongoose schemas for users, teams, activities, and workouts, with required fields, default arrays, and data relationships that match the seeded fixtures and API contract. Use seed idempotency to preserve existing data and add new records without duplication.
- Activity tracking approach: Require `user`, `team`, `type`, `minutes`, `points`, and `occurredAt` at the model layer; compute point totals from the submitted activity and reject invalid or missing user/team references with 4xx responses instead of cast errors.
- Team management approach: Treat team membership as a Mongo array of user IDs, default it to an empty array, and validate that `name` and `mascot` are present while allowing list/create endpoints to return the members array in the response.
- Leaderboard approach: Aggregate activity points by team, sort descending, and assign 1-based ranks while preserving a stable order for tied values when needed by the data contract.
- Workout suggestions approach: Match each seeded user's email to their latest activity pattern or fitness goal, choose the highest-priority workout that aligns with that pattern, and include a reasoning string describing the link to the user's recent activities.

## Test plan

Record the commands you run and what each failure means.

- Data-tier command: `npm run test:data --prefix octofit-tracker/backend`  
  Failing tests here indicate the Mongo models do not enforce the required schema contract. The current failures show missing validation for `name`, `email`, `fitnessGoal`, `team`, `activity` fields, and `Workout.focus`/`minutes`/`difficulty` — this is the root data-layer contract to fix first.
- API command: `npm run test:api --prefix octofit-tracker/backend`  
  Failing tests here indicate the Express routes are either not implemented or not validating input properly. The response mismatches show that invalid activities and teams are returning 501/incorrect statuses, leaderboard aggregation is empty, and workout suggestions are not matching the seeded user patterns.
- Frontend command: `npm test --prefix octofit-tracker/frontend`  
  Failing tests here indicate the React app is still in the placeholder state and has not connected to the API contract. The implementation must render the activity list, team list, leaderboard, and workout suggestions with the expected loading, empty, and error states.
- Backend build command: `npm run build --prefix octofit-tracker/backend`  
  This confirms the TypeScript backend compiles cleanly once the data models and API handlers satisfy the contract; it is a secondary safety check after the domain logic is fixed.
- Frontend build command: `npm run build --prefix octofit-tracker/frontend`  
  This confirms the Vite/React presentation layer compiles once the UI is wired to the API and the tests are satisfied; it is a final integration check after the API contract is stable.
