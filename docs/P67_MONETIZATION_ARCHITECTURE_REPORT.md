# P67 MONETIZATION ARCHITECTURE REPORT

## 1. Current Value Analysis

The existing product was audited as capability families rather than individual route names. Low-cost, high-learning-value foundations belong to Free. Expensive evaluation, simulation and deep analytics belong to Premium. Career-specific outcomes belong to Pro. Teacher, creator, marketplace and organization operations remain platform capabilities, not learner paywalls.

The machine-readable audit is `content/premium-monetization-architecture.json`. It records feature, user value, relative operating cost and recommended tier for foundations, four skills, dictionary/translation, handwriting/pronunciation, offline learning, daily learning, mastery/errors, AI, TOPIK, conversation, reading/dictation, immersion, voice, outcomes, real-world assistance, career use and platform operations.

## 2. Feature Tier Mapping

| Capability family | User value | Cost | Recommended tier |
| --- | --- | --- | --- |
| Hangul, Beginner Path, basic lessons/grammar/vocabulary | Start from zero and form a durable foundation | Low | Free |
| Basic listening/speaking/writing, handwriting/pronunciation | Practise every core language skill | Medium | Free |
| Basic SRS, mastery/errors, progress, daily plan, journal/achievements | Remember, see progress and maintain a habit | Low | Free |
| Dictionary/translation, Offline Core, community foundation | Learn reliably in daily conditions | Medium | Free |
| AI assistance | Get explanations and recommendations when needed | High | Limited by plan, never unavailable to Free |
| Full TOPIK, mock exams, advanced analytics/outcomes | Prepare systematically and understand bottlenecks | Medium | Premium |
| Conversation, reading/dictation, immersion/real-world assistant | Build deeper practical competence | Medium–High | Premium |
| Advanced voice and personalized plans | Receive deeper feedback and sequencing | High | Premium |
| Career, interview, business, professional writing, teacher feedback | Reach professional outcomes | High | Pro |
| Teacher/organization, content operations, marketplace, admin analytics | Operate the education platform | High | Platform role, not a learner tier |

## 3. Free Plan

Free is a real learning product. It preserves Hangul Foundation, Beginner Path, foundational lessons and skills, basic vocabulary and SRS, mastery/error support, progress, daily learning, journal/achievements, Offline Core and limited AI assistance. Core capability keys are protected by an explicit ethical rule in the client and matching server entitlement records. Expiry cannot lock core learning or remove progress.

## 4. Premium Plan

Premium targets serious TOPIK and communication learners. It adds the full TOPIK roadmap and mock exams, advanced analytics and outcome reports, 50 AI requests per day, detailed speaking feedback, personalized plans, conversation simulation, reading/dictation labs, immersion scenarios and document/menu/sign assistance. The number is an initial technical fair-use limit, not a published commercial price or promise.

## 5. Pro Plan

Pro inherits Premium and adds Career Korean, interview practice, Business Korean, professional writing and teacher feedback. AI is represented as a 200-request daily fair-use ceiling instead of the misleading phrase “absolute unlimited.” Pricing remains intentionally undecided until value, operating cost, Vietnamese affordability, educational access and provider fees are researched.

## 6. Permission System

`ServerEntitlementService` resolves effective access from a fresh server projection, signed auth metadata, a seven-day offline projection cache, or Free fallback. `FeaturePermissionService` returns `allowed`, `limited` or `blocked` with the required plan and source. An expired entitlement becomes Free; a cancellation with a future period end retains confirmed access until that end. The browser exposes no plan setter, and local checkout confirmation cannot grant access.

## 7. AI Monetization

Free receives 5 requests/day, Premium 50 and Pro 200 fair-use requests/day. `commercial_claim_ai_usage` locks the per-user/day row before incrementing so concurrent calls cannot exceed quota. Enforcement in `api/chat.js` is enabled only with `BILLING_ENFORCEMENT_ENABLED=true`; this makes rollout reversible while preserving the existing AI fallback. A quota response explicitly says core learning remains available.

## 8. Subscription Architecture

The additive migration supports `user_id`, `tier/plan`, `status`, `start_date`, `end_date`, `payment_provider` and cancellation-at-period-end metadata. Valid plans are Free, Premium and Pro; statuses are trial, active, expired and cancelled. A one-time seven-day Premium trial requires explicit no-auto-charge confirmation, stores no payment method and cannot silently convert.

Billing endpoints authenticate the Supabase session and rate-limit requests. Provider adapters are defined for Stripe, Google Play, Apple Store and local payment, but checkout deliberately returns `PAYMENT_PROVIDER_NOT_CONFIGURED` until credentials, pricing, signed webhooks and store-policy review are complete. Only a server webhook or audited admin RPC may change entitlements. Cancellation requests preserve learning progress.

The admin route reads at most 50 recent subscriptions and access-audit entries and 25 payment events under existing Admin RLS. Grant/revoke calls a security-definer RPC, validates plan/status/reason and records actor, before/after state and source.

## 9. Analytics

The model defines Free-to-Premium conversion, Premium retention, subscription churn, aggregated revenue and cancellation reason. Existing P39 aggregate payment/revenue tables are reused. P67 adds privacy-safe pricing-research records and explicit upgrade-interest tracking; no payment card data or learning content is added to analytics.

## 10. Security Review

- Subscription and AI quota authority is server-side; offline cache is explicitly non-authoritative.
- Subscription cache is excluded from `USER_SYNC_KEYS`, so CloudSync cannot overwrite server entitlement state.
- RLS protects trials, cancellations, audits, AI usage and pricing research.
- Admin mutation requires an Admin role and writes an immutable audit entry.
- Billing endpoints accept only allowlisted plans, providers and periods and use a rate-limit bucket.
- No provider secret, service-role key or card data is present in browser code.
- The migration does not delete or update learning progress, SRS, mastery or learning history.

## 11. Testing

- Static/contract regression: 57/57 test files passed.
- P67 unit contract: Free, Premium, Pro, expired, signed metadata, offline cache, CloudSync isolation, RLS, APIs, quota locking and secret boundaries passed.
- Real browser: 360, 768, 1024, 1440 and 1920 px passed in dark mode with no horizontal overflow.
- Real browser entitlement cases: Free, Premium, Pro and expired fallback passed.
- Offline reload retained the last server-verified projection and existing progress marker.
- Production build, release readiness, P47 safety/data integrity, P48 learning integrity and P49 offline PWA checks are part of the final validation pass.

## 12. Remaining Risks

- The Supabase migration must be applied and verified in the target project before enforcement is enabled.
- No provider is live: pricing, tax, refunds, store policy, signed webhook replay protection and provider credentials still require an explicit launch decision.
- Technical AI limits require cost and user research before becoming commercial policy.
- Offline entitlement cache improves continuity but cannot authorize a purchase, trial or renewal; a server refresh is still required online.
- End-to-end provider sandbox payment and hosted-Supabase concurrency tests remain pending until provider/project configuration is supplied.

## 13. Git

- Commit message: `feat: build ethical premium monetization architecture`
- SHA: reported from Git after the commit is created.
- Push: target is `origin/main`; the final handoff records the verified result.
