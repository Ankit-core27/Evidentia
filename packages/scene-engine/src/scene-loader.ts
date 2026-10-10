import { assetRegistry, type AssetRegistry } from './assets/asset-registry.js';
import { validateScene } from './schema/scene.schema.js';
import type { SceneDefinition, ValidationIssue } from './types/scene.js';

export type SceneLoadDiagnosticCode =
  | 'INVALID_JSON'
  | 'UNSUPPORTED_SCHEMA_VERSION'
  | 'INVALID_SCENE'
  | 'INVALID_REFERENCE'
  | 'UNKNOWN_ASSET';

export interface SceneLoadDiagnostic extends ValidationIssue {
  code: SceneLoadDiagnosticCode;
}

export type SceneLoadResult =
  | { success: true; scene: SceneDefinition; diagnostics: [] }
  | { success: false; diagnostics: SceneLoadDiagnostic[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function classifyValidationIssue(issue: ValidationIssue): SceneLoadDiagnosticCode {
  if (issue.message.startsWith('Asset ID "') || issue.message.startsWith('Asset "')) {
    return 'UNKNOWN_ASSET';
  }
  if (/roomId|parentId|objectId|room "[^"]+" was not found|boundary room/.test(issue.message)) {
    return 'INVALID_REFERENCE';
  }
  return 'INVALID_SCENE';
}

function validationDiagnostic(issue: ValidationIssue): SceneLoadDiagnostic {
  return { ...issue, code: classifyValidationIssue(issue) };
}

function parseInput(input: unknown): { value: unknown } | { diagnostic: SceneLoadDiagnostic } {
  if (typeof input !== 'string') return { value: input };
  try {
    return { value: JSON.parse(input) as unknown };
  } catch (error) {
    return {
      diagnostic: {
        code: 'INVALID_JSON',
        path: '$',
        message: error instanceof SyntaxError
          ? `Scene JSON could not be parsed: ${error.message}`
          : 'Scene JSON could not be parsed.',
      },
    };
  }
}

export function loadScene(
  input: unknown,
  registry: AssetRegistry = assetRegistry,
): SceneLoadResult {
  const parsedInput = parseInput(input);
  if ('diagnostic' in parsedInput) {
    return { success: false, diagnostics: [parsedInput.diagnostic] };
  }

  const value = parsedInput.value;
  if (
    isRecord(value) &&
    typeof value.schemaVersion === 'string' &&
    value.schemaVersion !== '1.0'
  ) {
    return {
      success: false,
      diagnostics: [{
        code: 'UNSUPPORTED_SCHEMA_VERSION',
        path: 'schemaVersion',
        message: `Schema version "${value.schemaVersion}" is not supported. Supported version: "1.0".`,
      }],
    };
  }

  const validation = validateScene(value, registry);
  if (!validation.success || !validation.data) {
    return {
      success: false,
      diagnostics: validation.errors.map(validationDiagnostic),
    };
  }

  if (validation.data.evidenceMarkers.length > 0 && !registry.evidence_marker) {
    return {
      success: false,
      diagnostics: [{
        code: 'UNKNOWN_ASSET',
        path: 'evidenceMarkers',
        message: 'Evidence markers require the "evidence_marker" asset, which is not present in the asset registry.',
      }],
    };
  }

  return { success: true, scene: validation.data, diagnostics: [] };
}
