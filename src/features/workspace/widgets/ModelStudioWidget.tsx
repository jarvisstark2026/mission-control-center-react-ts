import { useEffect, useMemo, useRef, useState } from 'react';
import type { WebGLRenderer } from 'three';

import {
  WorkspaceCompactList,
  WorkspaceContentHeader,
  WorkspaceContentShell,
  WorkspaceEmptyState,
  WorkspaceSectionFrame,
  WorkspaceStatusStrip,
} from '../workspaceBlocks';
import { createLocalFileObjectUrl, formatLocalFileSize, revokeLocalFileObjectUrl, type LocalFileRecord } from '../workspaceLocalFiles';
import { loadModelStudioState, saveModelStudioState } from '../workspaceWidgetFeatureModels';
import { usePersistentWorkspaceState } from '../usePersistentWorkspaceState';
import { WorkspaceEvidenceAttachPanel } from '../WorkspaceEvidenceAttachPanel';
import type { OperationalOsRuntime } from '../../operational-os';
import type { ShellRole } from '../../shell/roles';

export type ModelStudioWidgetProps = {
  files?: LocalFileRecord[];
  activeFileId?: string | null;
  selectedFileId?: string | null;
  onBrowseFiles?: (files: FileList | File[]) => Promise<LocalFileRecord[]>;
  onOpenPreview?: (file: LocalFileRecord) => void;
  role: ShellRole;
  operationalOs: OperationalOsRuntime;
};

function getBestModelFile(files: LocalFileRecord[], storedFileId: string | null, activeFileId?: string | null, selectedFileId?: string | null) {
  return (
    files.find((record) => record.id === storedFileId && record.previewKind === 'model') ??
    files.find((record) => record.id === activeFileId && record.previewKind === 'model') ??
    files.find((record) => record.id === selectedFileId && record.previewKind === 'model') ??
    files.find((record) => record.previewKind === 'model') ??
    null
  );
}

export function ModelStudioWidget({ files = [], activeFileId = null, selectedFileId = null, onBrowseFiles, onOpenPreview, role, operationalOs }: ModelStudioWidgetProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [modelState, setModelState] = usePersistentWorkspaceState(loadModelStudioState, saveModelStudioState);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [renderStatus, setRenderStatus] = useState(modelState.lastStatus);
  const modelFiles = files.filter((record) => record.previewKind === 'model');
  const selectedModel = getBestModelFile(files, modelState.selectedModelFileId, activeFileId, selectedFileId);
  const selectedModelId = selectedModel?.id ?? null;

  useEffect(() => {
    const nextUrl = selectedModel ? createLocalFileObjectUrl(selectedModel) : null;
    setObjectUrl(nextUrl);
    return () => revokeLocalFileObjectUrl(nextUrl);
  }, [selectedModel]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !objectUrl || !selectedModel) {
      if (mount) mount.replaceChildren();
      return;
    }

    let cancelled = false;
    let animationFrame: number | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let renderer: WebGLRenderer | null = null;

    setRenderStatus('Loading model');
    mount.replaceChildren();

    void Promise.all([import('three'), import('three/examples/jsm/loaders/GLTFLoader.js')])
      .then(([THREE, { GLTFLoader }]) => {
        if (cancelled || !mount) return;
        const width = Math.max(220, mount.clientWidth || 320);
        const height = Math.max(180, mount.clientHeight || 220);
        const nextRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer = nextRenderer;
        nextRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        nextRenderer.setSize(width, height);
        mount.replaceChildren(nextRenderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(38, width / height, 0.01, 1000);
        camera.position.set(1.8, 1.4, 2.4);
        scene.add(new THREE.AmbientLight(0x82d7ff, 1.2));
        const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
        keyLight.position.set(3, 4, 5);
        scene.add(keyLight);
        const fillLight = new THREE.PointLight(0x4bd7ff, 2, 8);
        fillLight.position.set(-3, 2, 2);
        scene.add(fillLight);

        const grid = new THREE.GridHelper(3, 12, 0x36d9ff, 0x143047);
        grid.position.y = -0.72;
        scene.add(grid);

        const loader = new GLTFLoader();
        loader.load(
          objectUrl,
          (gltf) => {
            if (cancelled) return;
            const root = gltf.scene;
            scene.add(root);
            const box = new THREE.Box3().setFromObject(root);
            const size = new THREE.Vector3();
            const center = new THREE.Vector3();
            box.getSize(size);
            box.getCenter(center);
            root.position.sub(center);
            const maxAxis = Math.max(size.x, size.y, size.z, 0.001);
            root.scale.setScalar(1.45 / maxAxis);
            camera.lookAt(0, 0, 0);
            setRenderStatus('Model loaded');
            setModelState((current) => ({
              ...current,
              selectedModelFileId: selectedModel.id,
              lastModelName: selectedModel.file.name,
              lastStatus: 'Model loaded',
              updatedAt: new Date().toISOString(),
            }));

            const render = () => {
              root.rotation.y += 0.004;
              renderer?.render(scene, camera);
              animationFrame = requestAnimationFrame(render);
            };
            render();
          },
          undefined,
          (error: unknown) => {
            if (cancelled) return;
            setRenderStatus(error instanceof Error ? `Model load failed: ${error.message}` : 'Model load failed');
          },
        );

        resizeObserver = new ResizeObserver(() => {
          const nextWidth = Math.max(220, mount.clientWidth || width);
          const nextHeight = Math.max(180, mount.clientHeight || height);
          camera.aspect = nextWidth / nextHeight;
          camera.updateProjectionMatrix();
          renderer?.setSize(nextWidth, nextHeight);
        });
        resizeObserver.observe(mount);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setRenderStatus(error instanceof Error ? `Renderer unavailable: ${error.message}` : 'Renderer unavailable');
      });

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      renderer?.dispose();
      mount.replaceChildren();
    };
  }, [objectUrl, selectedModel, setModelState]);

  const modelItems = useMemo(
    () =>
      modelFiles.slice(0, 6).map((file) => ({
        id: file.id,
        meta: 'model',
        title: file.file.name,
        detail: `${formatLocalFileSize(file.file.size)} / ${file.path}`,
        state: file.id === selectedModelId ? 'active' : 'file',
        action: {
          label: file.id === selectedModelId ? 'Preview' : 'Load',
          onClick: () => {
            if (file.id === selectedModelId) {
              onOpenPreview?.(file);
              return;
            }
            setModelState((current) => ({
              ...current,
              selectedModelFileId: file.id,
              lastModelName: file.file.name,
              lastStatus: 'Selected for render',
              updatedAt: new Date().toISOString(),
            }));
          },
        },
      })),
    [modelFiles, onOpenPreview, selectedModelId, setModelState],
  );

  return (
    <WorkspaceContentShell className="model-studio-surface widget-feature-shell">
      <WorkspaceContentHeader
        className="model-studio-head"
        eyebrow="3D asset"
        title={selectedModel?.file.name ?? modelState.lastModelName ?? 'model inspection'}
        metaEyebrow="source"
        meta={selectedModel ? 'file' : 'unavailable'}
      />
      <WorkspaceStatusStrip
        source={selectedModel ? 'file' : 'unavailable'}
        status={selectedModel ? renderStatus : 'no supported model loaded'}
        count={`${modelFiles.length} model files`}
        updatedAt={selectedModel ? formatLocalFileSize(selectedModel.file.size) : 'GLB / GLTF only'}
        action={{
          label: 'Browse',
          onClick: () => document.getElementById('model-studio-file-input')?.click(),
          disabled: !onBrowseFiles,
          title: 'Load GLB or GLTF model files',
        }}
      />
      {selectedModel ? (
        <WorkspaceEvidenceAttachPanel
          role={role}
          operationalOs={operationalOs}
          evidence={{
            type: 'file',
            title: selectedModel.file.name,
            source: selectedModel.path,
            summary: `Local GLB/GLTF model, ${formatLocalFileSize(selectedModel.file.size)}. Render status: ${renderStatus}.`,
          }}
        />
      ) : null}

      <div className="model-studio-layout">
        <WorkspaceSectionFrame className="model-studio-canvas-frame" eyebrow="viewport" title="local render" meta="Three.js">
          {selectedModel ? (
            <div ref={mountRef} className="model-studio-canvas model-studio-render-target" aria-label="3D model render target" />
          ) : (
            <div className="model-studio-canvas model-studio-canvas-idle">
              <div className="model-studio-grid" />
              <WorkspaceEmptyState
                source="file"
                title="No GLB or GLTF model selected"
                detail="Import a GLB or GLTF file to render it locally."
                action={{
                  label: 'Import model',
                  onClick: () => document.getElementById('model-studio-file-input')?.click(),
                  disabled: !onBrowseFiles,
                }}
              />
            </div>
          )}
        </WorkspaceSectionFrame>

        <WorkspaceSectionFrame className="model-studio-panel" eyebrow="files" title="model intake" meta="local">
          <input
            id="model-studio-file-input"
            className="widget-hidden-file-input"
            type="file"
            accept=".glb,.gltf,model/gltf+json,model/gltf-binary"
            multiple
            onChange={(event) => {
              const nextFiles = event.currentTarget.files;
              if (nextFiles?.length) void onBrowseFiles?.(nextFiles);
              event.currentTarget.value = '';
            }}
          />
          <WorkspaceCompactList items={modelItems} empty="No GLB or GLTF files loaded." ariaLabel="Model files" />
          <small className="widget-feature-note">Unsupported files stay in Preview; Model Studio renders GLB/GLTF only.</small>
        </WorkspaceSectionFrame>
      </div>
    </WorkspaceContentShell>
  );
}
