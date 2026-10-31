# Recommended ranking

Recommended is the homepage's default order. It is calculated from stored GitHub
metadata and eligible project membership, in PostgreSQL before pagination.
Other explicit sorts and the category/tag/license default of Most stars are
unchanged. Featured placements and collection member positions are independent.

The policy lives in
[`PROJECT_RANKING`](../packages/api/src/queries/project-ranking.ts). This is an
AltStack formula.

## Formula

```text
popularity = 0.5 × ln(1 + stars) / ln(1 + 10,000)
           + 0.5 × ln(1 + forks) / ln(1 + 1,000)

ageFactor = 1 − 0.5 × min(repositoryAgeDays / 1826.25, 1)

activityFactor = 0.5 ^ (max(daysSinceLastCommit − 90, 0) / 180)

score = popularity × ageFactor × activityFactor
        × (verified ? 1.05 : 1)
        × (archived ? 0.1 : 1)
```

Stars and forks have equal weights at their reference counts. Logarithms reduce
the advantage of very large repositories. The reference counts are fixed policy
values, rather than maxima of the current result set, so filtering does not
change a project's underlying score. Popularity can exceed one; this is not a
percentage score.

Age is measured from repository creation, never listing submission. Its factor
falls from one to one-half over five years and stays at one-half thereafter.
Activity has a 90-day grace period, then halves every 180 additional days without
a commit. Archived projects retain 10% of their otherwise calculated score and
remain visible.

Verification uses the existing eligible-member check. It does not grant an
unconditional first position, and losing eligible membership removes the bonus
without a scheduled score refresh.

## Missing data and time

- An unknown creation date has a neutral age factor of one.
- An unknown last-commit date with no completed metadata fetch has a neutral
  activity factor of one. Missing metadata is not evidence of inactivity.
- A completed metadata fetch with no commit indicates an empty repository under
  the current GitHub fetch contract; its activity factor is zero.
- Future dates are bounded to zero elapsed days, preventing factors above one.
- Zero stars and zero forks produce a zero score, including for verified listings.

The reference time is midnight in Asia/Jakarta, matching the GitHub snapshot
calendar. Time-based factors remain constant within that day. A successful
metadata refresh or membership change can still change the order immediately;
separate requests do not share a frozen database snapshot.

Every ordering ends with project ID descending to resolve equal scores.
No score column, migration, extra GitHub request, or scoring job is required.
The current formula is used on every Recommended search.

## Validation

The PostgreSQL ranking tests cover normalized contributions, age boundaries,
activity decay, unknown/empty metadata, future dates, verification removal,
archived visibility, daily stability, filtering, and pagination ties. Existing
ownership and license tests cover the integration with eligibility and other
explicit sorts.
