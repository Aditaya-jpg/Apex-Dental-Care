import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import {
  RotateCcw,
  Maximize2,
  Minimize2,
  Grid,
  Box,
  Compass,
  Eye,
  RefreshCw,
  Layers,
  Sparkles,
} from 'lucide-react';

export type ShaderMode = 'enamel' | 'heatmap' | 'wireframe' | 'normals' | 'xray';
export type CameraViewPreset = 'front' | 'upper' | 'lower' | 'left' | 'right' | 'iso';

interface Oral3DViewerProps {
  modelUrl?: string | null;
  activeShader?: ShaderMode;
  onShaderChange?: (shader: ShaderMode) => void;
  className?: string;
  onStatsLoaded?: (stats: { vertices: number; faces: number }) => void;
}

export const Oral3DViewer: React.FC<Oral3DViewerProps> = ({
  modelUrl,
  activeShader = 'enamel',
  onShaderChange,
  className = '',
  onStatsLoaded,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadMessage, setLoadMessage] = useState<string>('Initializing 3D Canvas...');
  const [currentShader, setCurrentShader] = useState<ShaderMode>(activeShader);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showBBox, setShowBBox] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [vertCount, setVertCount] = useState<number>(0);
  const [faceCount, setFaceCount] = useState<number>(0);

  // References to mutable Three.js objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const currentMeshRef = useRef<THREE.Object3D | null>(null);
  const bboxHelperRef = useRef<THREE.BoxHelper | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const materialsRef = useRef<Record<ShaderMode, THREE.Material>>({} as any);

  // Synchronize internal shader if prop changes
  useEffect(() => {
    if (activeShader !== currentShader) {
      applyShader(activeShader);
    }
  }, [activeShader]);

  // Initialize Three.js scene once
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 450;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d);
    scene.fog = new THREE.FogExp2(0x0a0f1d, 0.002);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 2000);
    camera.position.set(0, 15, 180);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current || undefined,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    // Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 25;
    controls.maxDistance = 600;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.2);
    keyLight.position.set(120, 180, 150);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x00f2fe, 0.85);
    rimLight.position.set(-150, 80, -120);
    scene.add(rimLight);

    const fillLight = new THREE.DirectionalLight(0x94a3b8, 0.5);
    fillLight.position.set(0, -100, 100);
    scene.add(fillLight);

    // Coordinate Grid Helper
    const grid = new THREE.GridHelper(300, 30, 0x00f2fe, 0x1e293b);
    grid.position.y = -50;
    scene.add(grid);
    gridHelperRef.current = grid;

    // Materials creation
    materialsRef.current = {
      enamel: new THREE.MeshPhysicalMaterial({
        color: 0xf3efe6,
        emissive: 0x111625,
        roughness: 0.28,
        metalness: 0.04,
        clearcoat: 0.55,
        clearcoatRoughness: 0.18,
        reflectivity: 0.8,
        flatShading: false,
      }),
      heatmap: new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        roughness: 0.35,
        metalness: 0.2,
        wireframe: false,
      }),
      wireframe: new THREE.MeshBasicMaterial({
        color: 0x00f2fe,
        wireframe: true,
        transparent: true,
        opacity: 0.85,
      }),
      normals: new THREE.MeshNormalMaterial({
        flatShading: false,
      }),
      xray: new THREE.MeshPhysicalMaterial({
        color: 0xa5f3fc,
        roughness: 0.1,
        transmission: 0.75,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    };

    // Render loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (controlsRef.current) {
        controlsRef.current.update();
      }
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      cameraRef.current.aspect = newWidth / newHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(newWidth, newHeight);
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      scene.clear();
    };
  }, []);

  // Load Model whenever modelUrl changes
  useEffect(() => {
    // If no model provided, fallback to pre-rendered clinical baseline
    const targetUrl =
      modelUrl ||
      '/oral3d/models/test_teeth_std.glb';

    loadModelFile(targetUrl);
  }, [modelUrl]);

  const loadModelFile = (url: string) => {
    if (!sceneRef.current || !cameraRef.current) return;
    setIsLoading(true);
    setLoadMessage('Rendering 3D Dental Surface...');

    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    // Clean previous mesh & helpers
    if (currentMeshRef.current) {
      scene.remove(currentMeshRef.current);
      currentMeshRef.current = null;
    }
    if (bboxHelperRef.current) {
      scene.remove(bboxHelperRef.current);
      bboxHelperRef.current = null;
    }

    const onModelLoaded = (rootObject: THREE.Object3D) => {
      let totalVerts = 0;
      let totalFaces = 0;

      rootObject.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.material = materialsRef.current[currentShader] || materialsRef.current.enamel;
          if (mesh.geometry) {
            mesh.geometry.computeVertexNormals();
            if (mesh.geometry.attributes.position) {
              totalVerts += mesh.geometry.attributes.position.count;
            }
            if (mesh.geometry.index) {
              totalFaces += mesh.geometry.index.count / 3;
            } else if (mesh.geometry.attributes.position) {
              totalFaces += mesh.geometry.attributes.position.count / 3;
            }
          }
        }
      });

      setVertCount(totalVerts);
      setFaceCount(Math.round(totalFaces));
      if (onStatsLoaded) {
        onStatsLoaded({ vertices: totalVerts, faces: Math.round(totalFaces) });
      }

      // Center geometry around origin
      const box = new THREE.Box3().setFromObject(rootObject);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      rootObject.position.x += -center.x;
      rootObject.position.y += -center.y;
      rootObject.position.z += -center.z;

      currentMeshRef.current = rootObject;
      scene.add(rootObject);

      // Create bounding box helper
      const boxHelper = new THREE.BoxHelper(rootObject, 0x00f2fe);
      boxHelper.visible = showBBox;
      bboxHelperRef.current = boxHelper;
      scene.add(boxHelper);

      // Adjust grid position
      if (gridHelperRef.current) {
        gridHelperRef.current.position.y = -size.y / 2 - 10;
      }

      // Smooth camera framing
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = camera.fov * (Math.PI / 180);
      let cameraDistance = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;
      cameraDistance = Math.max(cameraDistance, 80);

      if (controls) {
        controls.target.set(0, 0, 0);
        camera.position.set(0, 15, cameraDistance);
        controls.update();
      }

      setIsLoading(false);
    };

    // Determine loader from file extension
    const cleanUrl = url.split('?')[0].toLowerCase();

    if (cleanUrl.endsWith('.obj')) {
      const loader = new OBJLoader();
      loader.load(
        url,
        (obj) => onModelLoaded(obj),
        undefined,
        (err) => {
          console.error('[Oral3DViewer] OBJ Load Error:', err);
          setIsLoading(false);
        }
      );
    } else if (cleanUrl.endsWith('.stl')) {
      const loader = new STLLoader();
      loader.load(
        url,
        (geom) => {
          const mesh = new THREE.Mesh(geom, materialsRef.current[currentShader] || materialsRef.current.enamel);
          const group = new THREE.Group();
          group.add(mesh);
          onModelLoaded(group);
        },
        undefined,
        (err) => {
          console.error('[Oral3DViewer] STL Load Error:', err);
          setIsLoading(false);
        }
      );
    } else {
      // Default to GLTF / GLB Loader
      const loader = new GLTFLoader();
      loader.load(
        url,
        (gltf) => onModelLoaded(gltf.scene),
        undefined,
        (err) => {
          console.error('[Oral3DViewer] GLTF Load Error:', err);
          // If custom URL failed, try local fallback
          if (url !== '/oral3d/models/test_teeth_std.glb') {
            loader.load('/oral3d/models/test_teeth_std.glb', (fallback) => {
              onModelLoaded(fallback.scene);
            });
          } else {
            setIsLoading(false);
          }
        }
      );
    }
  };

  const applyShader = (shader: ShaderMode) => {
    setCurrentShader(shader);
    if (onShaderChange) onShaderChange(shader);
    if (!currentMeshRef.current) return;

    currentMeshRef.current.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        (child as THREE.Mesh).material = materialsRef.current[shader] || materialsRef.current.enamel;
      }
    });
  };

  const setCameraView = (view: CameraViewPreset) => {
    if (!cameraRef.current || !controlsRef.current) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const dist = 180;
    controls.target.set(0, 0, 0);

    switch (view) {
      case 'front':
        camera.position.set(0, 15, dist);
        break;
      case 'upper':
        camera.position.set(0, dist * 1.25, 0);
        break;
      case 'lower':
        camera.position.set(0, -dist * 1.25, 0);
        break;
      case 'left':
        camera.position.set(-dist, 15, 0);
        break;
      case 'right':
        camera.position.set(dist, 15, 0);
        break;
      case 'iso':
        camera.position.set(dist * 0.7, dist * 0.8, dist * 0.7);
        break;
    }
    controls.update();
  };

  const toggleAutoRotate = () => {
    const next = !autoRotate;
    setAutoRotate(next);
    if (controlsRef.current) {
      controlsRef.current.autoRotate = next;
      controlsRef.current.autoRotateSpeed = 2.0;
    }
  };

  const toggleGrid = () => {
    const next = !showGrid;
    setShowGrid(next);
    if (gridHelperRef.current) {
      gridHelperRef.current.visible = next;
    }
  };

  const toggleBBox = () => {
    const next = !showBBox;
    setShowBBox(next);
    if (bboxHelperRef.current) {
      bboxHelperRef.current.visible = next;
    }
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;

    if (!document.fullscreenElement) {
      el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full min-h-[420px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col select-none ${className}`}
    >
      {/* Three.js Canvas Element */}
      <canvas ref={canvasRef} className="w-full h-full block cursor-grab active:cursor-grabbing" />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center z-30 transition-opacity">
          <div className="w-12 h-12 rounded-full border-3 border-teal-500/20 border-t-teal-400 animate-spin mb-3 shadow-lg shadow-teal-500/20" />
          <p className="text-xs font-semibold text-teal-300 tracking-wide">{loadMessage}</p>
          <span className="text-[10px] text-slate-500 mt-1">Generating 3D Dental Iso-Surface</span>
        </div>
      )}

      {/* Top Floating Viewport Toolbar: Shaders & Anatomy Presets */}
      <div className="absolute top-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none z-20">
        {/* Shaders */}
        <div className="flex items-center gap-1 bg-slate-900/85 backdrop-blur-md border border-slate-700/60 p-1 rounded-xl shadow-lg pointer-events-auto">
          {[
            { id: 'enamel', label: 'Enamel Bone', icon: Sparkles },
            { id: 'heatmap', label: 'CT Heatmap', icon: Layers },
            { id: 'wireframe', label: 'Wireframe', icon: Grid },
            { id: 'normals', label: 'Normals', icon: Compass },
            { id: 'xray', label: 'X-Ray Translucent', icon: Eye },
          ].map((mode) => {
            const Icon = mode.icon;
            const active = currentShader === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => applyShader(mode.id as ShaderMode)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  active
                    ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/30 font-bold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                }`}
                title={`Switch shader to ${mode.label}`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{mode.label}</span>
              </button>
            );
          })}
        </div>

        {/* Anatomical Views Presets */}
        <div className="flex items-center gap-1 bg-slate-900/85 backdrop-blur-md border border-slate-700/60 p-1 rounded-xl shadow-lg pointer-events-auto">
          <span className="text-[10px] font-bold text-slate-400 px-2 uppercase tracking-wider hidden md:inline">
            View:
          </span>
          {[
            { id: 'front', label: 'Anterior' },
            { id: 'upper', label: 'Upper Arch' },
            { id: 'lower', label: 'Lower Arch' },
            { id: 'left', label: 'Left' },
            { id: 'right', label: 'Right' },
            { id: 'iso', label: '3D Iso' },
          ].map((v) => (
            <button
              key={v.id}
              onClick={() => setCameraView(v.id as CameraViewPreset)}
              className="px-2 py-1 text-[11px] font-semibold text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Floating Stats and Quick Controls Bar */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-3 pointer-events-none z-20">
        {/* Real-time Geometry Stats Pill */}
        <div className="flex items-center gap-3 bg-slate-900/85 backdrop-blur-md border border-slate-700/60 px-3 py-1.5 rounded-xl shadow-lg text-[11px] font-mono text-slate-300 pointer-events-auto">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <strong className="text-white font-bold">{vertCount.toLocaleString()}</strong> Vertices
          </span>
          <span className="text-slate-600">•</span>
          <span>
            <strong className="text-white font-bold">{faceCount.toLocaleString()}</strong> Polygons
          </span>
        </div>

        {/* Viewport Toggles */}
        <div className="flex items-center gap-1 bg-slate-900/85 backdrop-blur-md border border-slate-700/60 p-1 rounded-xl shadow-lg pointer-events-auto">
          <button
            onClick={toggleGrid}
            className={`p-1.5 rounded-lg transition-colors ${
              showGrid ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Toggle Ground Grid"
          >
            <Grid className="w-4 h-4" />
          </button>

          <button
            onClick={toggleBBox}
            className={`p-1.5 rounded-lg transition-colors ${
              showBBox ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Toggle Bounding Box"
          >
            <Box className="w-4 h-4" />
          </button>

          <button
            onClick={toggleAutoRotate}
            className={`p-1.5 rounded-lg transition-colors ${
              autoRotate ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Toggle Continuous Turntable Rotation"
          >
            <RefreshCw className={`w-4 h-4 ${autoRotate ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setCameraView('front')}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title="Reset Camera View"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title="Toggle Viewport Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
