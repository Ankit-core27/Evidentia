import { Text, useGLTF } from '@react-three/drei';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  Component,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { Color, Mesh, type EulerOrder, type Group, type Material, type Object3D } from 'three';

import { getAssetRegistryEntry, resolveAssetTransform } from './assets/asset-registry.js';
import type { SceneSelection, SceneTransform } from './types/scene.js';

const objectSelectionTint = new Color('#22d3ee');
const evidenceSelectionTint = new Color('#f59e0b');

interface SceneObjectProps {
  id: string;
  assetId: string;
  name: string;
  transform: SceneTransform;
  rotationOrder: EulerOrder;
  selected?: boolean;
  onSelect?: (selection: SceneSelection) => void;
  markerNumber?: number;
  markerLabel?: string;
  selection: SceneSelection | null;
}

interface ModelProps extends SceneObjectProps {
  url: string;
}

interface ModelInstance {
  object: Object3D;
  materials: Material[];
  tintedMaterials: Array<{ material: Material & { color: Color }; color: Color }>;
}

function Model({ url, ...props }: ModelProps) {
  const { scene } = useGLTF(url);
  const model = useMemo<ModelInstance>(() => {
    const object = clone(scene);
    const materials: Material[] = [];
    const tintedMaterials: ModelInstance['tintedMaterials'] = [];

    object.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;
      const mesh = child;
      const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const clonedMaterials = sourceMaterials.map((source) => {
        const material = source.clone();
        materials.push(material);
        if ('color' in material && material.color instanceof Color) {
          tintedMaterials.push({ material: material as Material & { color: Color }, color: material.color.clone() });
        }
        return material;
      });
      mesh.material = Array.isArray(mesh.material) ? clonedMaterials : clonedMaterials[0];
    });

    return { object, materials, tintedMaterials };
  }, [scene]);

  useEffect(() => {
    model.tintedMaterials.forEach(({ material, color }) => {
      material.color.copy(color);
      if (props.selected) {
        material.color.lerp(
          props.selection?.kind === 'evidence-marker' ? evidenceSelectionTint : objectSelectionTint,
          0.55,
        );
      }
    });
  }, [model, props.selected, props.selection?.kind]);

  useEffect(
    () => () => {
      model.materials.forEach((material) => material.dispose());
    },
    [model],
  );

  return (
    <>
      <primitive object={model.object} dispose={null} />
      {(props.markerNumber !== undefined || props.markerLabel !== undefined) && (
        <Text
          position={[0, 0.35, 0]}
          fontSize={0.22}
          color="white"
          outlineColor="#111827"
          outlineWidth={0.025}
          anchorX="center"
          anchorY="middle"
        >
          {props.markerLabel ?? props.markerNumber}
        </Text>
      )}
    </>
  );
}

function AssetPlaceholder({
  label,
  message,
  dimensions,
}: {
  label: string;
  message: string;
  dimensions?: [number, number, number];
}) {
  return (
    <group>
      <mesh castShadow>
        <boxGeometry args={dimensions ?? [0.5, 0.5, 0.5]} />
        <meshStandardMaterial color="#7f1d1d" wireframe />
      </mesh>
      <Text
        position={[0, (dimensions?.[1] ?? 0.5) * 0.75 + 0.15, 0]}
        fontSize={0.12}
        maxWidth={2}
        color="#fecaca"
        outlineColor="#111827"
        outlineWidth={0.012}
        anchorX="center"
        anchorY="middle"
        textAlign="center"
      >
        {`${label}\n${message}`}
      </Text>
    </group>
  );
}

class AssetErrorBoundary extends Component<
  { children: ReactNode; label: string; dimensions?: [number, number, number] },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <AssetPlaceholder
          label={this.props.label}
          message={`Asset failed to load: ${this.state.error.message}`}
          dimensions={this.props.dimensions}
        />
      );
    }
    return this.props.children;
  }
}

export function SceneObject(props: SceneObjectProps) {
  const group = useRef<Group>(null);
  const entry = getAssetRegistryEntry(props.assetId);
  const transform = useMemo(
    () => resolveAssetTransform(
      props.transform,
      entry?.calibration,
      entry?.defaultScale,
      props.rotationOrder,
    ),
    [entry?.calibration, entry?.defaultScale, props.rotationOrder, props.transform],
  );
  const rotation = useMemo(
    () =>
      transform.rotation.map((degrees) => (degrees * Math.PI) / 180) as [
        number,
        number,
        number,
      ],
    [transform.rotation],
  );
  const fallbackDimensions: [number, number, number] | undefined = entry?.dimensions
    ? [
        entry.dimensions.width ?? 0.5,
        entry.dimensions.height ?? 0.5,
        entry.dimensions.depth ?? 0.5,
      ]
    : undefined;

  useLayoutEffect(() => {
    if (!group.current) return;
    group.current.rotation.order = props.rotationOrder;
    group.current.rotation.set(...rotation, props.rotationOrder);
  }, [props.rotationOrder, rotation]);

  const handleSelect = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    if (props.selection) props.onSelect?.(props.selection);
  };

  return (
    <group
      ref={group}
      position={transform.position}
      rotation={rotation}
      scale={transform.scale}
      onClick={handleSelect}
      userData={{ sceneObjectId: props.id, assetId: props.assetId }}
    >
      {!entry ? (
        <AssetPlaceholder label={props.name} message={`Unknown asset ID: ${props.assetId}`} />
      ) : (
        <AssetErrorBoundary label={props.name} dimensions={fallbackDimensions}>
          <Suspense
            fallback={
              <AssetPlaceholder
                label={props.name}
                message="Loading model…"
                dimensions={fallbackDimensions}
              />
            }
          >
            <Model {...props} url={entry.url} />
          </Suspense>
        </AssetErrorBoundary>
      )}
    </group>
  );
}
