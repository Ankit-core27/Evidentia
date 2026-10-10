# Forensix Scene Planner

This package proposes scene definitions independently of the renderer. It consumes the public `@forensix/scene-engine` types, Zod schema, asset registry, `loadScene()` and spatial diagnostics. The first provider is deliberately deterministic and mock-only; it is not an LLM integration.

```ts
import { planScene } from '@forensix/scene-planner';

const result = await planScene({
  environmentType: 'indoor',
  description: 'A synthetic house has a living room, bedroom, and kitchen connected by doorways.',
});

if (result.success) {
  // result.scene is schema- and asset-validated before it can be rendered.
}
```

## Provider interface

Implement `ScenePlannerProvider.generateScene()` to use a future server-side model. The planner supplies the provider with the existing engine Zod scene schema as a structured response format; every result is still passed through `loadScene()` and `diagnoseScene()`. Providers must not bypass this validation. Credentials belong in a server process and must never be added to Vite environment variables. No provider credentials, SDK or backend endpoint are currently required or included.

## Synthetic placement limits

The mock provider creates a connected illustrative layout when no exact geometry is supplied, with all assumptions noted in `scene.metadata.planner`. Supplied dimensions and positions are preserved. An unmeasured object position is left out of the renderable object collection and surfaced as a warning rather than assigned invented coordinates. Unknown/unpermitted assets and invalid room references are errors; the provider never chooses a substitute model. Planner provenance and asset calibration are metadata, not a claim of measured accuracy or forensic confidence. The planner does not infer guilt, cause of death, weapon use or chronology.

`PlannerRequest` can supply room/object constraints, permitted asset IDs, explicit wall-to-wall connections, an entrance room, and whether disconnected rooms are intentional. Door openings are generated only for explicit requested connections or the deterministic mock's documented sequential illustrative arrangement. The planner does not move caller-positioned rooms to repair misalignment; topology and spatial errors prevent a scene from being returned as successful.

Run `npm test` in this package for provider, schema, asset and topology checks.
