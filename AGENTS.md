<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Plan prices/limits live only in the `plans` table; server code and DB triggers read them (single source of truth, admin-editable).
- Usage limits are enforced server-side via `consume_usage` RPC and insert triggers; never trust client checks.
- Payment provider code is isolated in `src/lib/payments.server.ts` + `billing.server.ts`; subscriptions activate only after NoHoldPay's API confirms the payment server-to-server (via signed webhook or return-page re-check), so the gateway can be swapped.
- A provider checkout link is read defensively from the create-payment response and must validate as an http(s) URL before the browser is sent there; a missing link surfaces the provider response instead of navigating.
- Admin access requires owner email AND `super_admin` role, checked per request in `requireAdmin` middleware.
- Shared visual roles live in `src/styles.css`; page sections use unframed bands and records use cards so all routes stay visually consistent.
- App navigation groups the existing routes in a scrollable desktop sidebar and a mobile More sheet so every destination remains accessible on short screens.
