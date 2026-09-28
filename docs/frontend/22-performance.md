# Performance

Build before checking route bundles:

```bash
pnpm -C frontend build
pnpm -C frontend check:bundle
```

The [bundle checker](../../frontend/scripts/check-bundle-budget.mjs) reads Next's
app build manifest, deduplicates JavaScript files for each configured route, and
compares their gzip total with the budget in that script. Keep that file as the
single source for route thresholds.

Use browser performance and network tools on a production build to investigate
slow rendering, layout shifts, long tasks, duplicate RPC reads, or excess polling.
Record route, device/network conditions, release/build identity, and measurements
before and after a change. Passing the bundle check alone does not measure runtime
latency or establish a Core Web Vitals result.

[Next configuration](../../frontend/apps/web/next.config.mjs) transpiles the shared
packages and produces standalone output rooted at the frontend workspace. Keep
shared package files and generated ABIs inside the build trace. Review the
[Dockerfiles](../../frontend/deploy/docker) when changing runtime dependencies.
