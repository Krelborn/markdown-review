export const planPath = "docs/plans/rate-limiting.md";

export const rolloutPath = "docs/plans/rollout.md";

const frontmatter = ["---", "title: Rate limiting for the public API", "status: draft", "owner: platform-team", "---"];

const table = [
  "| Plan       | Requests per minute | Burst |",
  "| ---------- | ------------------: | ----: |",
  "| Free       |                  60 |    20 |",
  "| Team       |                 600 |   100 |",
  "| Enterprise |                6000 |  1000 |",
];

const sequenceDiagram = [
  "```mermaid",
  "sequenceDiagram",
  "  Client->>API: GET /v1/orders",
  "  API->>Redis: take a token",
  "  Redis-->>API: tokens left",
  "  API-->>Client: 200, or 429 with Retry-After",
  "```",
];

const openQuestions = [
  "## Open questions",
  "",
  "- [ ] Should internal services bypass the limiter?",
  "- [x] Do failed requests count? Yes, every request counts.",
];

const note = ["> [!NOTE]", "> Limits apply per API key, not per IP address."];

/**
 * The plan the agent asks the user to review
 */
export const planBefore = [
  ...frontmatter,
  "",
  "# Rate limiting for the public API",
  "",
  "## Goal",
  "",
  "Protect the public API from bursts of traffic without slowing down well-behaved clients. Each API key gets its own " +
    "budget, and a client that goes over it gets a `429 Too Many Requests` with a `Retry-After` header.",
  "",
  "## Approach",
  "",
  "We use a token bucket per API key, stored in Redis so that every instance of the API shares the same count. The " +
    "bucket refills at the plan's rate and holds up to its burst.",
  "",
  ...table,
  "",
  "```ts",
  "export async function takeToken(apiKey: string, plan: Plan): Promise<boolean> {",
  "  const { burst, rate } = limits[plan];",
  "  const left = await redis.eval(takeTokenScript, [bucketKey(apiKey)], [rate, burst, Date.now()]);",
  "  return left >= 0;",
  "}",
  "```",
  "",
  ...sequenceDiagram,
  "",
  "## Rollout",
  "",
  "1. Ship the limiter in log-only mode and record who would be limited.",
  "2. Email the customers who would hit the limit.",
  "3. Enforce the limit on the Free plan, then on the others a week later.",
  "",
  ...openQuestions,
  "",
  ...note,
  "",
].join("\n");

/**
 * The plan once the agent has answered the first round of comments
 */
export const planAfter = planBefore
  .replace(
    "## Rollout",
    [
      "## Failure modes",
      "",
      "If Redis is unreachable, the limiter fails open: it lets the request through and logs a warning, so an outage " +
        "of the cache never becomes an outage of the API.",
      "",
      "## Rollout",
    ].join("\n")
  )
  .replace(
    "## Open questions",
    [
      "## Monitoring",
      "",
      "A dashboard shows the rate of `429` responses per plan, and an alert fires when more than 1% of a plan's " +
        "requests are limited for ten minutes.",
      "",
      "## Open questions",
    ].join("\n")
  );

/**
 * The plan cut down to the kinds of content the app renders, to show them in one view
 */
export const renderedPlan = [
  ...frontmatter,
  "",
  "# Rate limiting for the public API",
  "",
  ...note,
  "",
  "## Limits",
  "",
  ...table,
  "",
  "## Flow",
  "",
  ...sequenceDiagram,
  "",
  ...openQuestions,
  "",
].join("\n");

/**
 * A second doc of the review, which the plan's rollout links to
 */
export const rollout = [
  "# Rollout of rate limiting",
  "",
  "See the [plan](rate-limiting.md) for the limits themselves.",
  "",
  "## Log-only week",
  "",
  "The limiter records every request it would have rejected, with the API key and plan, but lets it through.",
  "",
  "## Customer email",
  "",
  "We email the owner of every key that would have been limited, with its peak rate and the limit it will get.",
  "",
].join("\n");
