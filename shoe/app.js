/* ============================================================
   Shoe Customizer – Babylon.js Application
   Integrated preview, drop transition, context floors,
   outline highlight, UV grid, hat/accessories
   ============================================================ */

(function () {
    "use strict";

    // ── Constants ──────────────────────────────────────────────
    // Zone names & friendly names are now dynamic — loaded from models/index.json
    let ZONE_NAMES = [];
    let FRIENDLY_NAMES = {};
    let ZONE_COLORS = {};  // will be assigned per-model for UV export

    const DEFAULT_ZONE_PALETTE = [
        "#FF4444", "#44FF44", "#4444FF", "#FFFF44",
        "#FF44FF", "#44FFFF", "#FF8800", "#88FF00",
        "#FF0088", "#00FF88", "#8800FF", "#0088FF"
    ];

    const FLOAT_AMPLITUDE = 0.03;
    const FLOAT_SPEED = 1.5;

    // ── Model system ───────────────────────────────────────────
    let modelManifest = [];       // array from models/index.json
    let currentModelConfig = null; // active entry from manifest
    let currentModelPath = "";     // e.g. "models/shoe/"
    let currentModelMeshes = [];   // meshes returned by SceneLoader

    const CHARACTER_URL = "https://assets.babylonjs.com/meshes/";
    const CHARACTER_FILE = "dummy3.babylon";

    const PREVIEW_CAMERA = {
        alpha: 2.5,
        beta: 1.2,
        radius: 1.5,
        target: new BABYLON.Vector3(0, 0, 0)
    };

    // Camera when hat is on — zoomed out to show full body (shoes + hat)
    const FULLBODY_CAMERA = {
        alpha: 2.5,
        beta: 1.3,
        radius: 3.5,
        target: new BABYLON.Vector3(0, 0.8, 0)
    };

    // Camera for custom shoe animations (basketball, golf, etc.) — targets feet area
    const CUSTOM_ANIM_CAMERA = {
        alpha: 2.5,
        beta: 1.4,
        radius: 1.2,
        target: new BABYLON.Vector3(0, 0.5, 0)
    };

    // Camera for head & shoulders close-up of the hat
    const HAT_CLOSEUP_CAMERA = {
        alpha: 2.5,
        beta: 1.4,
        radius: 1.0,
        target: new BABYLON.Vector3(0, 1.55, 0)
    };

    const FLOOR_COLORS = {
        none: null,
        basketball: "#C4843C",
        tennis: "#3D7A3F",
        street: "#555555",
        grass: "#2E7D32",
        track: "#B74033"
    };

    // ── State ──────────────────────────────────────────────────
    let currentMode = "orbit";
    let selectedZone = null;
    let hoveredZone = null;
    let shoeRoot = null;
    let shoeZones = {};
    let scene, engine, camera;
    let shadowDisc = null;
    let isDragging = false;
    let lastPointerX = 0, lastPointerY = 0;
    let baseShoeY = 0;
    let startTime = 0;
    let presets = [];

    // Preview state
    let previewMode = false;
    let skeleton = null;
    let animRanges = {};
    let currentAnim = "idle";
    let characterMeshes = [];
    let characterLoaded = false;
    let characterVisible = false;
    let leftAttachNode = null;
    let rightAttachNode = null;
    let previewShoeMeshes = [];    // separate shoe loaded for preview
    let previewShoeLoaded = false;
    let shadowGenPreview = null;

    // Floor
    let floorMesh = null;

    // Highlight layer
    let highlightLayer = null;

    // UV grid state
    let uvGridActive = false;
    let uvGridTexture = null;
    let savedZoneTextures = {};

    // Hat
    let hatMesh = null;
    let hatVisible = false;

    // ── DOM refs ───────────────────────────────────────────────
    const canvas = document.getElementById("renderCanvas");
    const modelSelect = document.getElementById("model-select");
    const modeIcon = document.getElementById("mode-icon");
    const modeLabel = document.getElementById("mode-label");
    const pickerPopup = document.getElementById("color-picker-popup");
    const pickerZoneName = document.getElementById("picker-zone-name");
    const pickerColor = document.getElementById("picker-color");
    const pickerTextureFile = document.getElementById("picker-texture-file");
    const pickerTextureName = document.getElementById("picker-texture-name");
    const pickerWrapFile = document.getElementById("picker-wrap-file");
    const pickerReset = document.getElementById("picker-reset");
    const pickerClose = document.getElementById("picker-close");
    const btnSave = document.getElementById("btn-save-design");
    const btnRefresh = document.getElementById("btn-refresh");
    const btnPreview = document.getElementById("btn-preview");
    const btnUvGrid = document.getElementById("btn-uv-grid");
    const presetGrid = document.getElementById("preset-grid");
    const loadingOverlay = document.getElementById("loading-overlay");
    const animBar = document.getElementById("anim-bar");
    const keyboardHints = document.getElementById("keyboard-hints");
    const floorSelector = document.getElementById("floor-selector");
    const floorType = document.getElementById("floor-type");
    const btnCharToggle = document.getElementById("btn-char-toggle");
    const btnHatToggle = document.getElementById("btn-hat-toggle");
    const btnHatCloseup = document.getElementById("btn-hat-closeup");

    // ================================================================
    //  1. INIT BABYLON ENGINE & SCENE
    // ================================================================

    engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
    scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.08, 0.08, 0.14, 1);
    scene.ambientColor = new BABYLON.Color3(0.15, 0.15, 0.2);

    BABYLON.Animation.AllowMatricesInterpolation = true;

    // Camera
    const DEFAULT_CAMERA = {
        alpha: -Math.PI / 2,
        beta: Math.PI / 2.5,
        radius: 3,
        target: new BABYLON.Vector3(0, 0, 0)
    };
    camera = new BABYLON.ArcRotateCamera("cam", DEFAULT_CAMERA.alpha, DEFAULT_CAMERA.beta, DEFAULT_CAMERA.radius, DEFAULT_CAMERA.target.clone(), scene);
    camera.lowerRadiusLimit = 1.2;
    camera.upperRadiusLimit = 8;
    camera.wheelDeltaPercentage = 0.02;
    camera.attachControl(canvas, true);
    camera.minZ = 0.01;

    // Lights
    const hemiLight = new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0, 1, 0), scene);
    hemiLight.intensity = 0.7;
    hemiLight.groundColor = new BABYLON.Color3(0.1, 0.1, 0.15);

    const dirLight = new BABYLON.DirectionalLight("dir", new BABYLON.Vector3(-0.5, -1, 0.5), scene);
    dirLight.intensity = 0.9;
    dirLight.position = new BABYLON.Vector3(3, 6, -3);

    const backLight = new BABYLON.DirectionalLight("back", new BABYLON.Vector3(0.5, -0.5, -0.5), scene);
    backLight.intensity = 0.3;

    // Shadow generator for preview mode
    shadowGenPreview = new BABYLON.ShadowGenerator(1024, dirLight);
    shadowGenPreview.useBlurExponentialShadowMap = true;
    shadowGenPreview.blurKernel = 32;

    // Highlight layer for zone selection (outline glow, not emissive fill)
    highlightLayer = new BABYLON.HighlightLayer("hl", scene, {
        blurHorizontalSize: 0.5,
        blurVerticalSize: 0.5
    });
    highlightLayer.innerGlow = false;
    highlightLayer.outerGlow = true;

    // ================================================================
    //  2. MODEL MANIFEST & DYNAMIC MODEL LOADING
    // ================================================================

    async function loadModelManifest() {
        try {
            var resp = await fetch("models/index.json?_=" + Date.now());
            modelManifest = await resp.json();
        } catch (e) {
            console.warn("Could not load models/index.json", e);
            modelManifest = [];
        }

        // Populate dropdown
        modelSelect.innerHTML = "";
        modelManifest.forEach(function (entry) {
            var opt = document.createElement("option");
            opt.value = entry.id;
            opt.textContent = entry.name || entry.id;
            modelSelect.appendChild(opt);
        });

        // Load first model
        if (modelManifest.length > 0) {
            loadModel(modelManifest[0]);
        } else {
            document.getElementById("loading-text").textContent =
                "No models found in models/index.json.";
        }
    }

    function clearCurrentModel() {
        deselectZone();

        // Dispose current model meshes
        if (currentModelMeshes.length > 0) {
            currentModelMeshes.forEach(function (m) {
                if (m && !m.isDisposed()) m.dispose(false, false);
            });
            currentModelMeshes = [];
        }

        // Dispose shoeRoot
        if (shoeRoot) {
            shoeRoot.dispose();
            shoeRoot = null;
        }

        // Clear zone references
        shoeZones = {};

        // Clear preview shoe if loaded
        clearPreviewShoe();

        // Remove UV grid state
        if (uvGridActive) {
            uvGridActive = false;
            btnUvGrid.classList.remove("active");
        }
        savedZoneTextures = {};
    }

    function clearPreviewShoe() {
        previewShoeMeshes.forEach(function (m) {
            if (m && !m.isDisposed()) m.dispose(false, false);
        });
        previewShoeMeshes = [];
        previewShoeLoaded = false;
        if (leftAttachNode) { leftAttachNode.dispose(); leftAttachNode = null; }
        if (rightAttachNode) { rightAttachNode.dispose(); rightAttachNode = null; }
    }

    function loadModel(modelConfig) {
        // Clear previous model if switching
        if (currentModelConfig) {
            clearCurrentModel();
        }

        currentModelConfig = modelConfig;
        currentModelPath = "models/" + modelConfig.folder + "/";

        // Update dynamic zone constants from manifest
        ZONE_NAMES = modelConfig.zones || [];
        FRIENDLY_NAMES = modelConfig.friendlyNames || {};
        ZONE_COLORS = {};
        ZONE_NAMES.forEach(function (name, i) {
            ZONE_COLORS[name] = DEFAULT_ZONE_PALETTE[i % DEFAULT_ZONE_PALETTE.length];
        });

        // Show loading
        document.getElementById("loading-text").textContent = "Loading " + (modelConfig.name || "model") + "...";
        loadingOverlay.classList.remove("hidden");
        loadingOverlay.style.display = "";

        BABYLON.SceneLoader.ImportMesh("", currentModelPath, modelConfig.file, scene,
            function onSuccess(meshes) {
                currentModelMeshes = meshes;

                // Create a parent transform node
                shoeRoot = new BABYLON.TransformNode("shoeRoot", scene);
                baseShoeY = 0;

                meshes.forEach(m => {
                    if (m.name === "__root__") {
                        m.parent = shoeRoot;
                    }
                });

                // Debug: log all meshes and their materials
                console.log("=== GLTF Loaded Meshes ===");
                meshes.forEach((m, i) => {
                    const matInfo = m.material ? m.material.name : "no material";
                    const subCount = m.subMeshes ? m.subMeshes.length : 0;
                    console.log(`  [${i}] "${m.name}" | mat: "${matInfo}" | subMeshes: ${subCount} | type: ${m.getClassName()}`);
                    if (m.subMeshes && m.subMeshes.length > 1) {
                        m.subMeshes.forEach((sm, si) => {
                            const smMat = sm.getMaterial();
                            console.log(`    sub[${si}] mat: "${smMat ? smMat.name : '?'}" | type: ${smMat ? smMat.getClassName() : '?'}`);
                        });
                    }
                });

                // Strategy: find ALL materials that match zone names, regardless of mesh structure
                // Build a map of material name → material object
                const allMaterials = {};
                scene.materials.forEach(mat => {
                    allMaterials[mat.name.toLowerCase()] = mat;
                });
                console.log("=== Scene Materials ===", Object.keys(allMaterials).join(", "));

                // For each zone name, find the matching material and the mesh/submesh it belongs to
                ZONE_NAMES.forEach(zoneName => {
                    const mat = allMaterials[zoneName];
                    if (!mat) {
                        console.warn("No material found for zone:", zoneName);
                        return;
                    }

                    // Find which mesh uses this material
                    let targetMesh = null;
                    let subMeshIndex = -1;

                    for (const m of meshes) {
                        if (!m.subMeshes) continue;
                        for (let si = 0; si < m.subMeshes.length; si++) {
                            const smMat = m.subMeshes[si].getMaterial();
                            if (smMat && smMat.name.toLowerCase() === zoneName) {
                                targetMesh = m;
                                subMeshIndex = si;
                                break;
                            }
                        }
                        if (targetMesh) break;

                        // Also check direct material match
                        if (m.material && m.material.name.toLowerCase() === zoneName) {
                            targetMesh = m;
                            subMeshIndex = 0;
                            break;
                        }
                    }

                    if (!targetMesh) {
                        console.warn("No mesh found for zone:", zoneName);
                        return;
                    }

                    targetMesh.isPickable = true;

                    shoeZones[zoneName] = {
                        material: mat,
                        mesh: targetMesh,
                        subMeshIndex: subMeshIndex,
                        origColor: mat.albedoColor ? mat.albedoColor.clone() : new BABYLON.Color3(0.8, 0.8, 0.8),
                        origTexture: mat.albedoTexture || null,
                        origEmissive: mat.emissiveColor ? mat.emissiveColor.clone() : BABYLON.Color3.Black()
                    };
                });

                console.log("=== Zones Mapped ===", Object.keys(shoeZones).join(", "));
                console.log("Zone count:", Object.keys(shoeZones).length);

                // Center and normalize model size to fit the viewport
                const bounds = getCompoundBounds(meshes);
                if (bounds) {
                    const size = bounds.max.subtract(bounds.min);
                    const maxDim = Math.max(size.x, size.y, size.z);
                    const TARGET_SIZE = 2.0; // all models scaled so largest dimension ≈ this
                    if (maxDim > 0) {
                        const scaleFactor = TARGET_SIZE / maxDim;
                        shoeRoot.scaling.setAll(scaleFactor);
                    }

                    // Re-compute bounds after scaling to center correctly
                    const center = bounds.center;
                    const sf = shoeRoot.scaling.x;
                    shoeRoot.position.x = -center.x * sf;
                    shoeRoot.position.z = -center.z * sf;
                    baseShoeY = -center.y * sf;
                    shoeRoot.position.y = baseShoeY;
                    camera.target = BABYLON.Vector3.Zero();
                }

                createShadowDisc();
                hideLoading();
                startTime = performance.now() / 1000;

                // Re-render presets (swatch colors depend on ZONE_NAMES)
                renderPresets();
            },
            null,
            function onError(scene, msg, ex) {
                document.getElementById("loading-text").textContent =
                    "Failed to load " + modelConfig.file + ". Check that all referenced files are in models/" + modelConfig.folder + "/.";
                console.error("GLTF load error:", msg, ex);
            }
        );
    }

    // Model selector dropdown change
    modelSelect.addEventListener("change", function () {
        var selected = modelManifest.find(function (m) { return m.id === modelSelect.value; });
        if (selected && selected !== currentModelConfig) {
            loadModel(selected);
        }
    });

    function getCompoundBounds(meshes) {
        let min = null, max = null;
        meshes.forEach(m => {
            if (!m.getBoundingInfo) return;
            const bi = m.getBoundingInfo();
            const bmin = bi.boundingBox.minimumWorld;
            const bmax = bi.boundingBox.maximumWorld;
            if (!min) { min = bmin.clone(); max = bmax.clone(); }
            else {
                min = BABYLON.Vector3.Minimize(min, bmin);
                max = BABYLON.Vector3.Maximize(max, bmax);
            }
        });
        if (!min) return null;
        return { min, max, center: BABYLON.Vector3.Center(min, max) };
    }

    // ================================================================
    //  3. SHADOW & FLOATING ANIMATION
    // ================================================================

    function createShadowDisc() {
        shadowDisc = BABYLON.MeshBuilder.CreateDisc("shadow", { radius: 0.6, tessellation: 64 }, scene);
        shadowDisc.rotation.x = Math.PI / 2;
        shadowDisc.position.y = -0.5;
        shadowDisc.isPickable = false;

        const shadowMat = new BABYLON.StandardMaterial("shadowMat", scene);
        shadowMat.diffuseColor = BABYLON.Color3.Black();
        shadowMat.specularColor = BABYLON.Color3.Black();
        shadowMat.alpha = 0.25;
        shadowMat.backFaceCulling = false;

        // Create a dynamic texture for a soft radial gradient shadow
        const dynTex = new BABYLON.DynamicTexture("shadowTex", 256, scene, true);
        const ctx = dynTex.getContext();
        const cx = 128, cy = 128, r = 120;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, "rgba(0,0,0,0.7)");
        grad.addColorStop(0.5, "rgba(0,0,0,0.3)");
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 256, 256);
        dynTex.update();

        shadowMat.diffuseTexture = dynTex;
        shadowMat.opacityTexture = dynTex;
        shadowMat.useAlphaFromDiffuseTexture = true;
        shadowDisc.material = shadowMat;
    }

    // Render loop with floating animation
    scene.registerBeforeRender(function () {
        if (!shoeRoot || previewMode) return;
        const t = performance.now() / 1000 - startTime;
        const floatOffset = Math.sin(t * FLOAT_SPEED) * FLOAT_AMPLITUDE;

        if (currentMode !== "translate") {
            shoeRoot.position.y = baseShoeY + floatOffset;
        }

        // Animate shadow opacity/scale inversely
        if (shadowDisc) {
            const shadowScale = 1 - floatOffset * 3;
            shadowDisc.scaling.x = shadowScale;
            shadowDisc.scaling.z = shadowScale;
            shadowDisc.material.alpha = 0.25 - floatOffset * 2;
        }
    });

    // ================================================================
    //  4. TRANSFORM MODE SYSTEM
    // ================================================================

    const MODE_CONFIG = {
        orbit:     { icon: "👁️", label: "View" },
        rotate:    { icon: "🔄", label: "Rotate" },
        scale:     { icon: "📏", label: "Scale" },
        translate: { icon: "✋", label: "Move" }
    };

    function setMode(mode) {
        currentMode = mode;
        const cfg = MODE_CONFIG[mode];
        modeIcon.textContent = cfg.icon;
        modeLabel.textContent = cfg.label;

        // Enable/disable camera based on mode
        if (mode === "orbit") {
            camera.attachControl(canvas, true);
        } else {
            camera.detachControl();
        }

        // Visual feedback on mode indicator
        const indicator = document.getElementById("mode-indicator");
        indicator.style.background = mode === "orbit"
            ? "rgba(15, 52, 96, 0.9)"
            : "rgba(233, 69, 96, 0.9)";
    }

    // Keyboard shortcuts
    window.addEventListener("keydown", function (e) {
        if (previewMode) return;
        const key = e.key.toLowerCase();
        if (key === "r") {
            setMode(currentMode === "rotate" ? "orbit" : "rotate");
        } else if (key === "s") {
            setMode(currentMode === "scale" ? "orbit" : "scale");
        } else if (key === "t") {
            setMode(currentMode === "translate" ? "orbit" : "translate");
        } else if (key === "escape") {
            setMode("orbit");
            deselectZone();
        }
    });

    // ── Pointer drag for transform modes ───────────────────────
    canvas.addEventListener("pointerdown", function (e) {
        if (currentMode !== "orbit") {
            isDragging = true;
            lastPointerX = e.clientX;
            lastPointerY = e.clientY;
        }
    });

    window.addEventListener("pointermove", function (e) {
        if (!isDragging || !shoeRoot || previewMode) return;
        const dx = e.clientX - lastPointerX;
        const dy = e.clientY - lastPointerY;
        lastPointerX = e.clientX;
        lastPointerY = e.clientY;

        switch (currentMode) {
            case "rotate":
                shoeRoot.rotation.y += dx * 0.01;
                shoeRoot.rotation.x += dy * 0.01;
                break;
            case "scale": {
                const scaleDelta = 1 - dy * 0.005;
                const newScale = Math.max(0.3, Math.min(5, shoeRoot.scaling.x * scaleDelta));
                shoeRoot.scaling.setAll(newScale);
                break;
            }
            case "translate":
                shoeRoot.position.x += dx * 0.005;
                shoeRoot.position.z -= dy * 0.005;
                break;
        }
    });

    window.addEventListener("pointerup", function () {
        isDragging = false;
    });

    // ================================================================
    //  5. ZONE PICKING, HOVER GLOW & SELECTION
    // ================================================================

    // Helper: find zone name from a pick result
    function getZoneFromPick(pickResult) {
        if (!pickResult || !pickResult.hit) return null;
        const hitMesh = pickResult.pickedMesh;
        const hitSubMeshId = pickResult.subMeshId;

        // Method A: Get the sub-mesh material directly (most reliable for multi-material meshes)
        if (hitMesh && hitMesh.subMeshes && hitSubMeshId !== undefined) {
            const sm = hitMesh.subMeshes[hitSubMeshId];
            if (sm) {
                const smMat = sm.getMaterial();
                if (smMat) {
                    const n = smMat.name.toLowerCase();
                    if (shoeZones[n]) return n;
                }
            }
        }

        // Method B: Check by mesh's own material name
        if (hitMesh && hitMesh.material) {
            const matName = hitMesh.material.name.toLowerCase();
            if (shoeZones[matName]) return matName;
        }

        // Method C: Brute force — check if any zone's mesh matches the hit mesh
        for (const [name, zone] of Object.entries(shoeZones)) {
            if (zone.mesh === hitMesh) {
                // For single-submesh meshes, this is the zone
                if (!hitMesh.subMeshes || hitMesh.subMeshes.length <= 1) return name;
                // For multi-submesh, check index
                if (zone.subMeshIndex === hitSubMeshId) return name;
            }
        }

        return null;
    }

    // ── Hover glow effect (outline, not emissive fill) ───────
    canvas.addEventListener("pointermove", function (e) {
        if (isDragging || previewMode) return;

        const rect = canvas.getBoundingClientRect();
        const pickResult = scene.pick(e.clientX - rect.left, e.clientY - rect.top);
        const zoneName = getZoneFromPick(pickResult);

        // Remove previous hover highlight
        if (hoveredZone && hoveredZone !== zoneName) {
            const prevZone = shoeZones[hoveredZone];
            if (prevZone && prevZone.mesh) {
                if (!selectedZone || selectedZone.name !== hoveredZone) {
                    highlightLayer.removeMesh(prevZone.mesh);
                }
            }
            hoveredZone = null;
            canvas.style.cursor = "default";
        }

        // Add hover outline to new zone
        if (zoneName && zoneName !== hoveredZone) {
            if (!selectedZone || selectedZone.name !== zoneName) {
                const zone = shoeZones[zoneName];
                if (zone && zone.mesh) {
                    highlightLayer.addMesh(zone.mesh, new BABYLON.Color3(0.9, 0.4, 0.5));
                }
            }
            hoveredZone = zoneName;
            canvas.style.cursor = "pointer";
        }

        if (!zoneName) {
            canvas.style.cursor = currentMode !== "orbit" ? "grab" : "default";
        }
    });

    // ── Click to select zone ───────────────────────────────────
    canvas.addEventListener("pointerdown", function (e) {
        if (e.button !== 0 || previewMode) return;

        const rect = canvas.getBoundingClientRect();
        const pickResult = scene.pick(e.clientX - rect.left, e.clientY - rect.top);
        const zoneName = getZoneFromPick(pickResult);

        if (zoneName) {
            selectZone(zoneName, e.clientX, e.clientY);
            return;
        }

        // Clicked empty space — deselect only if in orbit mode
        if (currentMode === "orbit") {
            deselectZone();
        }
    });

    function selectZone(name, screenX, screenY) {
        deselectZone();
        const zone = shoeZones[name];
        if (!zone) return;

        selectedZone = { name, material: zone.material, mesh: zone.mesh };

        // Outline highlight (not emissive fill)
        if (zone.mesh) {
            highlightLayer.addMesh(zone.mesh, new BABYLON.Color3(0.9, 0.2, 0.3));
        }

        showPicker(name, screenX, screenY);
    }

    function deselectZone() {
        if (selectedZone) {
            const zone = shoeZones[selectedZone.name];
            if (zone && zone.mesh) {
                highlightLayer.removeMesh(zone.mesh);
            }
            selectedZone = null;
        }
        hidePicker();
    }

    // ================================================================
    //  6. FLOATING COLOR PICKER
    // ================================================================

    function showPicker(zoneName, screenX, screenY) {
        pickerZoneName.textContent = FRIENDLY_NAMES[zoneName] || zoneName;
        pickerTextureName.textContent = "";

        // Set current color
        const zone = shoeZones[zoneName];
        if (zone && zone.material.albedoColor) {
            pickerColor.value = colorToHex(zone.material.albedoColor);
        }

        // Position the popup further from click so zone is visible
        const rect = canvas.getBoundingClientRect();
        let left = screenX + 120;
        let top = screenY - 60;

        // Keep within window bounds
        if (left + 260 > window.innerWidth) left = screenX - 380;
        if (top + 300 > window.innerHeight) top = window.innerHeight - 310;
        if (top < 10) top = 10;
        if (left < 270) left = 270;

        pickerPopup.style.left = left + "px";
        pickerPopup.style.top = top + "px";
        pickerPopup.classList.remove("hidden");
    }

    function hidePicker() {
        pickerPopup.classList.add("hidden");
    }

    // Color change
    pickerColor.addEventListener("input", function () {
        if (!selectedZone) return;
        const zone = shoeZones[selectedZone.name];
        if (!zone) return;
        const c = hexToColor3(pickerColor.value);
        zone.material.albedoColor = c;
        if (zone.material.albedoTexture && zone.material._customTexture) {
            zone.material.albedoTexture = null;
            zone.material._customTexture = false;
        }
    });

    // Texture upload
    pickerTextureFile.addEventListener("change", function () {
        if (!selectedZone || !pickerTextureFile.files.length) return;
        const file = pickerTextureFile.files[0];
        pickerTextureName.textContent = file.name;
        applyTextureToZone(selectedZone.name, file);
        pickerTextureFile.value = "";
    });

    // Wrap image to all zones
    pickerWrapFile.addEventListener("change", function () {
        if (!pickerWrapFile.files.length) return;
        const file = pickerWrapFile.files[0];
        ZONE_NAMES.forEach(name => {
            if (shoeZones[name]) {
                applyTextureToZone(name, file);
            }
        });
        pickerWrapFile.value = "";
    });

    // Reset zone
    pickerReset.addEventListener("click", function () {
        if (!selectedZone) return;
        const zone = shoeZones[selectedZone.name];
        if (!zone) return;
        zone.material.albedoColor = zone.origColor.clone();
        zone.material.albedoTexture = zone.origTexture;
        zone.material._customTexture = false;
        pickerColor.value = colorToHex(zone.origColor);
        pickerTextureName.textContent = "";
    });

    // Close picker
    pickerClose.addEventListener("click", deselectZone);

    function applyTextureToZone(zoneName, file) {
        const zone = shoeZones[zoneName];
        if (!zone) return;
        const url = URL.createObjectURL(file);
        const tex = new BABYLON.Texture(url, scene, false, true, BABYLON.Texture.BILINEAR_SAMPLINGMODE, function () {
            // Texture loaded
        });
        zone.material.albedoTexture = tex;
        zone.material.albedoColor = BABYLON.Color3.White();
        zone.material._customTexture = true;
    }

    // ================================================================
    //  7. DESIGN PRESETS
    // ================================================================

    async function loadPresets() {
        try {
            const resp = await fetch("designs/index.json?_=" + Date.now());
            const manifest = await resp.json();
            presets = [];

            for (const entry of manifest) {
                try {
                    const pr = await fetch("designs/" + entry.file + "?_=" + Date.now());
                    const data = await pr.json();
                    data._file = entry.file;
                    data._thumb = entry.thumb || null;
                    presets.push(data);
                } catch (e) {
                    console.warn("Could not load preset:", entry.file, e);
                }
            }

            renderPresets();
        } catch (e) {
            console.warn("No designs/index.json found or fetch failed.", e);
            renderPresets();
        }
    }

    function renderPresets() {
        presetGrid.innerHTML = "";

        presets.forEach((preset, idx) => {
            const card = document.createElement("div");
            card.className = "preset-card";
            card.title = preset.name || "Preset " + (idx + 1);

            // Thumbnail: either image or color swatch grid
            const thumb = document.createElement("div");
            thumb.className = "preset-card-thumb";

            if (preset._thumb) {
                const img = document.createElement("img");
                img.src = "designs/" + preset._thumb;
                img.alt = preset.name;
                img.loading = "lazy";
                thumb.appendChild(img);
            } else {
                // Generate a swatch grid from zone colors
                const swatchGrid = document.createElement("div");
                swatchGrid.className = "preset-swatches";
                ZONE_NAMES.forEach(z => {
                    const swatch = document.createElement("div");
                    swatch.className = "preset-swatch";
                    const zoneData = preset.zones && preset.zones[z];
                    swatch.style.background = (zoneData && zoneData.color) || "#555";
                    swatchGrid.appendChild(swatch);
                });
                thumb.appendChild(swatchGrid);
            }
            card.appendChild(thumb);

            const nameEl = document.createElement("div");
            nameEl.className = "preset-card-name";
            nameEl.textContent = preset.name || "Preset " + (idx + 1);
            card.appendChild(nameEl);

            card.addEventListener("click", () => applyPreset(preset));
            presetGrid.appendChild(card);
        });
    }

    function applyPreset(preset) {
        if (!preset.zones) return;
        deselectZone();

        Object.keys(preset.zones).forEach(zoneName => {
            const zone = shoeZones[zoneName];
            if (!zone) return;
            const cfg = preset.zones[zoneName];

            if (cfg.color) {
                zone.material.albedoColor = hexToColor3(cfg.color);
                if (!cfg.texture) {
                    zone.material.albedoTexture = null;
                    zone.material._customTexture = false;
                }
            }

            if (cfg.texture) {
                const tex = new BABYLON.Texture(cfg.texture, scene);
                zone.material.albedoTexture = tex;
                zone.material.albedoColor = BABYLON.Color3.White();
                zone.material._customTexture = true;
            }
        });
    }

    // ── Save current design ────────────────────────────────────
    btnSave.addEventListener("click", function () {
        const design = {
            name: "Custom " + new Date().toLocaleTimeString(),
            zones: {}
        };

        ZONE_NAMES.forEach(name => {
            const zone = shoeZones[name];
            if (!zone) return;
            design.zones[name] = {
                color: colorToHex(zone.material.albedoColor || zone.origColor)
            };
        });

        const blob = new Blob([JSON.stringify(design, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "design-" + Date.now() + ".json";
        a.click();
        URL.revokeObjectURL(url);

        BABYLON.Tools.CreateScreenshot(engine, camera, { width: 400, height: 400 }, function (dataUrl) {
            const a2 = document.createElement("a");
            a2.href = dataUrl;
            a2.download = "design-" + Date.now() + "-thumb.png";
            a2.click();
        });
    });

    // Refresh presets
    btnRefresh.addEventListener("click", loadPresets);

    // ================================================================
    //  PREVIEW MODE (INTEGRATED CHARACTER)
    // ================================================================

    btnPreview.addEventListener("click", function () {
        if (previewMode) {
            exitPreviewMode();
        } else {
            enterPreviewMode();
        }
    });

    function enterPreviewMode() {
        previewMode = true;
        deselectZone();
        setMode("orbit");

        // UI toggles
        btnPreview.textContent = "👟 Back to Editor";
        btnPreview.style.background = "#0f3460";
        animBar.classList.remove("hidden");
        keyboardHints.classList.add("hidden");
        floorSelector.classList.remove("hidden");

        if (shadowDisc) shadowDisc.setEnabled(false);

        if (!characterLoaded) {
            loadCharacter();
        } else {
            showCharacterAndAttach();
        }

        animateCamera(PREVIEW_CAMERA, 30);
    }

    function exitPreviewMode() {
        previewMode = false;

        btnPreview.textContent = "🚶 Preview";
        btnPreview.style.background = "";
        animBar.classList.add("hidden");
        keyboardHints.classList.remove("hidden");
        floorSelector.classList.add("hidden");

        if (shadowDisc) shadowDisc.setEnabled(true);
        shoeRoot.setEnabled(true);

        characterMeshes.forEach(m => { m.setEnabled(false); });
        if (leftAttachNode) leftAttachNode.setEnabled(false);
        if (rightAttachNode) rightAttachNode.setEnabled(false);
        // Hide preview shoes
        previewShoeMeshes.forEach(m => { m.setEnabled(false); });
        if (floorMesh) floorMesh.setEnabled(false);
        if (hatMesh) hatMesh.setEnabled(false);

        scene.stopAllAnimations();
        scene.animationGroups.forEach(ag => ag.stop());

        animateCamera(DEFAULT_CAMERA, 30);
    }

    function loadCharacter() {
        document.getElementById("loading-text").textContent = "Loading character...";
        loadingOverlay.classList.remove("hidden");
        loadingOverlay.style.display = "";

        BABYLON.SceneLoader.ImportMesh("", CHARACTER_URL, CHARACTER_FILE, scene,
            function (newMeshes, particleSystems, skeletons) {
                skeleton = skeletons[0];
                characterMeshes = newMeshes.filter(m => m.material);

                newMeshes.forEach(m => {
                    shadowGenPreview.addShadowCaster(m, true);
                    m.receiveShadows = false;
                });

                skeleton.animationPropertiesOverride = new BABYLON.AnimationPropertiesOverride();
                skeleton.animationPropertiesOverride.enableBlending = true;
                skeleton.animationPropertiesOverride.blendingSpeed = 0.05;
                skeleton.animationPropertiesOverride.loopMode = 1;

                animRanges = {
                    idle: skeleton.getAnimationRange("YBot_Idle"),
                    walk: skeleton.getAnimationRange("YBot_Walk"),
                    run: skeleton.getAnimationRange("YBot_Run"),
                    left: skeleton.getAnimationRange("YBot_LeftStrafeWalk"),
                    right: skeleton.getAnimationRange("YBot_RightStrafeWalk")
                };

                characterLoaded = true;

                characterMeshes.forEach(m => {
                    if (!m.material) return;
                    const cloned = m.material.clone(m.material.name + "_edit");
                    if (cloned) {
                        if (cloned.isFrozen) cloned.unfreeze();
                        m.material = cloned;
                    }
                });

                showCharacterAndAttach();
                loadExtraAnimations();
                hideLoading();
            },
            null,
            function (scene, msg, ex) {
                document.getElementById("loading-text").textContent = "Failed to load character.";
            }
        );
    }

    function showCharacterAndAttach() {
        // Character hidden by default — only show if user toggled visible
        characterMeshes.forEach(m => {
            m.setEnabled(true);
            m.visibility = characterVisible ? 1 : 0;
        });
        // Sync toggle button state
        if (characterVisible) {
            btnCharToggle.classList.remove("char-hidden");
            btnCharToggle.textContent = "👤 Character";
        } else {
            btnCharToggle.classList.add("char-hidden");
            btnCharToggle.textContent = "👤 Hidden";
        }

        if (animRanges.idle) {
            scene.beginAnimation(skeleton, animRanges.idle.from, animRanges.idle.to, true);
        }

        if (!previewShoeLoaded) {
            loadPreviewShoe();
        } else {
            // Re-show existing preview shoes and sync colors
            previewShoeMeshes.forEach(m => { m.setEnabled(true); });
            if (leftAttachNode) leftAttachNode.setEnabled(true);
            if (rightAttachNode) rightAttachNode.setEnabled(true);
            syncPreviewShoeColors();
        }

        createFloor();
        shoeRoot.setEnabled(false);

        document.querySelectorAll(".anim-btn").forEach(b => b.classList.remove("active"));
        var idleBtn = document.querySelector('[data-anim="idle"]');
        if (idleBtn) idleBtn.classList.add("active");
    }

    // Load a separate copy of the model GLTF for the preview character
    function loadPreviewShoe() {
        if (!currentModelConfig) return;
        BABYLON.SceneLoader.ImportMesh("", currentModelPath, currentModelConfig.file, scene,
            function (shoeMeshes) {
                previewShoeMeshes = shoeMeshes;
                previewShoeLoaded = true;

                // Build zone material map for preview shoe and sync colors from editor
                var previewZoneMats = {};
                scene.materials.forEach(function (mat) {
                    // Preview shoe materials get duplicated names — find the newest ones
                    var n = mat.name.toLowerCase();
                    if (ZONE_NAMES.indexOf(n) !== -1) {
                        previewZoneMats[n] = mat;
                    }
                });

                // Sync colors from editor shoe zones to preview shoe materials
                ZONE_NAMES.forEach(function (name) {
                    var editorZone = shoeZones[name];
                    // Find material on the newly loaded shoe meshes
                    for (var i = 0; i < shoeMeshes.length; i++) {
                        var m = shoeMeshes[i];
                        if (!m.subMeshes) continue;
                        for (var si = 0; si < m.subMeshes.length; si++) {
                            var smMat = m.subMeshes[si].getMaterial();
                            if (smMat && smMat.name.toLowerCase() === name && smMat !== (editorZone && editorZone.material)) {
                                // This is the preview shoe's material — copy editor values
                                if (editorZone) {
                                    smMat.albedoColor = editorZone.material.albedoColor.clone();
                                    if (editorZone.material.albedoTexture && editorZone.material._customTexture) {
                                        smMat.albedoTexture = editorZone.material.albedoTexture;
                                    }
                                }
                            }
                        }
                    }
                });

                attachPreviewShoeToFeet(shoeMeshes);
            },
            null,
            function (scene, msg, ex) {
                console.error("Preview shoe load error:", msg, ex);
            }
        );
    }

    function syncPreviewShoeColors() {
        // Sync editor shoe colors onto preview shoe materials
        ZONE_NAMES.forEach(function (name) {
            var editorZone = shoeZones[name];
            if (!editorZone) return;
            for (var i = 0; i < previewShoeMeshes.length; i++) {
                var m = previewShoeMeshes[i];
                if (!m.subMeshes) continue;
                for (var si = 0; si < m.subMeshes.length; si++) {
                    var smMat = m.subMeshes[si].getMaterial();
                    if (smMat && smMat.name.toLowerCase() === name && smMat !== editorZone.material) {
                        smMat.albedoColor = editorZone.material.albedoColor.clone();
                        if (editorZone.material.albedoTexture && editorZone.material._customTexture) {
                            smMat.albedoTexture = editorZone.material.albedoTexture;
                        } else {
                            smMat.albedoTexture = null;
                        }
                    }
                }
            }
        });
    }

    function attachPreviewShoeToFeet(shoeMeshes) {
        var leftFootBone = skeleton.bones.find(function (b) {
            var n = b.name.toLowerCase();
            return n.includes("leftfoot") || n.includes("left_foot") || n.includes("l_foot");
        });
        var rightFootBone = skeleton.bones.find(function (b) {
            var n = b.name.toLowerCase();
            return n.includes("rightfoot") || n.includes("right_foot") || n.includes("r_foot");
        });

        var shoeScale = 0.19;
        var shoeRootMesh = shoeMeshes.find(function (m) { return m.name === "__root__"; }) || shoeMeshes[0];

        if (leftFootBone) {
            leftAttachNode = new BABYLON.TransformNode("shoe_left_attach", scene);
            leftAttachNode.attachToBone(leftFootBone,
                leftFootBone.getTransformNode() || scene.meshes[0]);
            leftAttachNode.scaling = new BABYLON.Vector3(shoeScale, shoeScale, shoeScale);
            leftAttachNode.position = new BABYLON.Vector3(0, -0.01, 0.08);
            leftAttachNode.rotation = new BABYLON.Vector3(
                2 * Math.PI / 180, 87 * Math.PI / 180, 1 * Math.PI / 180);

            shoeMeshes.forEach(function (m) {
                if (m.name === "__root__" || m === shoeRootMesh) {
                    m.parent = leftAttachNode;
                }
            });
        }

        if (rightFootBone) {
            rightAttachNode = new BABYLON.TransformNode("shoe_right_attach", scene);
            rightAttachNode.attachToBone(rightFootBone,
                rightFootBone.getTransformNode() || scene.meshes[0]);
            rightAttachNode.scaling = new BABYLON.Vector3(-shoeScale, shoeScale, shoeScale);
            rightAttachNode.position = new BABYLON.Vector3(0, -0.01, 0.08);
            rightAttachNode.rotation = new BABYLON.Vector3(
                2 * Math.PI / 180, 87 * Math.PI / 180, 1 * Math.PI / 180);

            // Clone shoe meshes for right foot
            shoeMeshes.forEach(function (m) {
                if (m.getClassName() === "Mesh" && m.geometry) {
                    var clone = m.clone("right_" + m.name, null);
                    if (clone) {
                        clone.parent = rightAttachNode;
                        clone.isPickable = false;
                        clone.material = m.material;
                        if (m.subMeshes) {
                            clone.subMeshes = [];
                            m.subMeshes.forEach(function (sm) {
                                new BABYLON.SubMesh(
                                    sm.materialIndex, sm.verticesStart, sm.verticesCount,
                                    sm.indexStart, sm.indexCount, clone
                                );
                            });
                        }
                        previewShoeMeshes.push(clone);
                    }
                }
            });
        }
    }

    // ── Camera Animation (fixes reset two-press bug) ──────────
    function animateCamera(target, frames) {
        var alphaAnim = new BABYLON.Animation("camAlpha", "alpha", 60,
            BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
        alphaAnim.setKeys([
            { frame: 0, value: camera.alpha },
            { frame: frames, value: target.alpha }
        ]);

        var betaAnim = new BABYLON.Animation("camBeta", "beta", 60,
            BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
        betaAnim.setKeys([
            { frame: 0, value: camera.beta },
            { frame: frames, value: target.beta }
        ]);

        var radiusAnim = new BABYLON.Animation("camRadius", "radius", 60,
            BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
        radiusAnim.setKeys([
            { frame: 0, value: camera.radius },
            { frame: frames, value: target.radius }
        ]);

        var targetAnim = new BABYLON.Animation("camTarget", "target", 60,
            BABYLON.Animation.ANIMATIONTYPE_VECTOR3, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
        targetAnim.setKeys([
            { frame: 0, value: camera.target.clone() },
            { frame: frames, value: target.target.clone() }
        ]);

        var ease = new BABYLON.CubicEase();
        ease.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEINOUT);
        [alphaAnim, betaAnim, radiusAnim, targetAnim].forEach(function (a) { a.setEasingFunction(ease); });

        camera.animations = [alphaAnim, betaAnim, radiusAnim, targetAnim];
        scene.beginAnimation(camera, 0, frames, false);
    }

    // ── Floor System ───────────────────────────────────────────
    function createFloor() {
        if (floorMesh) {
            // Respect floor type selection — don't show if "none"
            floorMesh.setEnabled(previewMode && floorType.value !== "none");
            return;
        }

        floorMesh = BABYLON.MeshBuilder.CreateGround("contextFloor", {
            width: 6, height: 6
        }, scene);
        floorMesh.position.y = 0;
        floorMesh.receiveShadows = true;
        floorMesh.isPickable = false;

        var floorMat = new BABYLON.StandardMaterial("floorMat", scene);
        floorMat.specularColor = BABYLON.Color3.Black();
        floorMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.2);
        floorMesh.material = floorMat;

        updateFloor(floorType.value);
    }

    function updateFloor(type) {
        if (!floorMesh) return;
        var mat = floorMesh.material;

        if (type === "none") {
            floorMesh.setEnabled(false);
            return;
        }

        floorMesh.setEnabled(previewMode);
        var colorHex = FLOOR_COLORS[type] || "#333333";
        var hex = colorHex.replace("#", "");
        mat.diffuseColor = new BABYLON.Color3(
            parseInt(hex.substring(0, 2), 16) / 255,
            parseInt(hex.substring(2, 4), 16) / 255,
            parseInt(hex.substring(4, 6), 16) / 255
        );

        // Try loading floor texture if available
        try {
            var texPath = "textures/floor-" + type + ".jpg";
            var tex = new BABYLON.Texture(texPath, scene, false, true,
                BABYLON.Texture.BILINEAR_SAMPLINGMODE,
                function () { mat.diffuseTexture = tex; },
                function () { mat.diffuseTexture = null; }
            );
        } catch (e) {
            mat.diffuseTexture = null;
        }
    }

    floorType.addEventListener("change", function () {
        updateFloor(this.value);
    });

    // ── Animation Controls ─────────────────────────────────────
    document.querySelectorAll(".anim-btn[data-anim]").forEach(function (btn) {
        btn.addEventListener("click", function () {
            var animName = this.dataset.anim;
            if (!animName) return;
            playAnimation(animName);
            document.querySelectorAll(".anim-btn").forEach(function (b) { b.classList.remove("active"); });
            this.classList.add("active");
        });
    });

    function playAnimation(name) {
        if (!skeleton) return;
        currentAnim = name;
        stopBoneSync();
        scene.stopAnimation(skeleton);
        scene.animationGroups.forEach(function (ag) { ag.stop(); });

        if (name === "jump") {
            animateCamera(PREVIEW_CAMERA, 25);
            playJumpAnimation();
            return;
        }

        // Custom GLB animation — direct shoe positioning from GLB foot bones
        var data = animRanges[name];
        if (data && data.isCustomGLB && data.animationGroup) {
            animateCamera(CUSTOM_ANIM_CAMERA, 25);
            data.animationGroup.start(true);

            // Find GLB foot TransformNodes
            var glbLeftFoot = data.glbNodeMap ? data.glbNodeMap["leftfoot"] : null;
            var glbRightFoot = data.glbNodeMap ? data.glbNodeMap["rightfoot"] : null;

            if (!glbLeftFoot || !glbRightFoot) {
                console.warn("[DirectShoe] Could not find GLB foot nodes");
                return;
            }

            console.log("[DirectShoe] Found foot nodes:",
                "L:", glbLeftFoot.name, "R:", glbRightFoot.name);

            // Detach shoes from character skeleton
            if (leftAttachNode) leftAttachNode.detachFromBone();
            if (rightAttachNode) rightAttachNode.detachFromBone();

            // Temp variables for decompose
            var _s = new BABYLON.Vector3();
            var _r = new BABYLON.Quaternion();
            var _t = new BABYLON.Vector3();

            var shoeScale = 0.19;
            // World positions from GLB are already in meters (Armature 90° converts to Y-up)
            var _posScale = 1.0;
            var _debugFrames = 5;

            _boneSyncObserver = scene.onBeforeRenderObservable.add(function () {
                // Force world matrix recomputation on foot nodes + parent chain
                glbLeftFoot.computeWorldMatrix(true);
                glbRightFoot.computeWorldMatrix(true);

                // Get GLB foot world transforms
                var lMat = glbLeftFoot.getWorldMatrix();
                var rMat = glbRightFoot.getWorldMatrix();
                lMat.decompose(_s, _r, _t);
                var lPos = _t.clone();
                var lRot = _r.clone();
                rMat.decompose(_s, _r, _t);
                var rPos = _t.clone();
                var rRot = _r.clone();

                // Debug: log first few frames to see raw positions
                if (_debugFrames > 0) {
                    console.log("[DirectShoe] Raw LFoot:",
                        "X:", lPos.x.toFixed(2), "Y:", lPos.y.toFixed(2), "Z:", lPos.z.toFixed(2),
                        "| RFoot:",
                        "X:", rPos.x.toFixed(2), "Y:", rPos.y.toFixed(2), "Z:", rPos.z.toFixed(2));
                    _debugFrames--;
                }

                // Positions already in meters — use directly
                var leftWorldPos = new BABYLON.Vector3(
                    lPos.x * _posScale,
                    lPos.y * _posScale,
                    lPos.z * _posScale
                );
                var rightWorldPos = new BABYLON.Vector3(
                    rPos.x * _posScale,
                    rPos.y * _posScale,
                    rPos.z * _posScale
                );

                // Shoe rotation offset (same as in attachPreviewShoeToFeet: 2°, 87°, 1°)
                var shoeRotQuat = BABYLON.Quaternion.FromEulerAngles(
                    2 * Math.PI / 180, 87 * Math.PI / 180, 1 * Math.PI / 180);

                // Apply to shoe attach nodes: worldRot * shoeOffset
                if (leftAttachNode) {
                    leftAttachNode.position.copyFrom(leftWorldPos);
                    leftAttachNode.rotationQuaternion = lRot.multiply(shoeRotQuat);
                    leftAttachNode.scaling = new BABYLON.Vector3(shoeScale, shoeScale, shoeScale);
                }
                if (rightAttachNode) {
                    rightAttachNode.position.copyFrom(rightWorldPos);
                    rightAttachNode.rotationQuaternion = rRot.multiply(shoeRotQuat);
                    rightAttachNode.scaling = new BABYLON.Vector3(-shoeScale, shoeScale, shoeScale);
                }

                // Camera tracks midpoint of feet
                if (camera) {
                    var midX = (leftWorldPos.x + rightWorldPos.x) * 0.5;
                    var midY = (leftWorldPos.y + rightWorldPos.y) * 0.5;
                    var midZ = (leftWorldPos.z + rightWorldPos.z) * 0.5;
                    camera.target.x += (midX - camera.target.x) * 0.1;
                    camera.target.y += (midY - camera.target.y) * 0.1;
                    camera.target.z += (midZ - camera.target.z) * 0.1;
                }
            });
            return;
        }

        if (data && data.animationGroup) {
            data.animationGroup.start(true);
            animateCamera(PREVIEW_CAMERA, 25);
            return;
        }

        var range = animRanges[name];
        if (range) {
            scene.beginAnimation(skeleton, range.from, range.to, true);
            animateCamera(PREVIEW_CAMERA, 25);
        }
    }

    function playJumpAnimation() {
        if (animRanges.idle) {
            scene.beginAnimation(skeleton, animRanges.idle.from, animRanges.idle.to, true);
        }

        var rootMesh = scene.meshes.find(function (m) { return m.skeleton === skeleton; }) || scene.meshes[0];
        if (!rootMesh) return;

        var jumpAnim = new BABYLON.Animation(
            "jumpAnim", "position.y", 60,
            BABYLON.Animation.ANIMATIONTYPE_FLOAT,
            BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
        );

        var baseY = rootMesh.position.y;
        jumpAnim.setKeys([
            { frame: 0, value: baseY },
            { frame: 10, value: baseY - 0.05 },
            { frame: 25, value: baseY + 0.6 },
            { frame: 40, value: baseY },
            { frame: 50, value: baseY - 0.03 },
            { frame: 60, value: baseY }
        ]);

        var ease = new BABYLON.SineEase();
        ease.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEINOUT);
        jumpAnim.setEasingFunction(ease);

        rootMesh.animations = rootMesh.animations || [];
        rootMesh.animations.push(jumpAnim);
        scene.beginAnimation(rootMesh, 0, 60, true);
    }

    // ── Debug Sliders Panel for Bone Sync ──
    var BONE_GROUPS = [
        { key: "hips",     label: "Hips",       bones: ["hips"] },
        { key: "spine",    label: "Spine",       bones: ["spine", "spine1", "spine2"] },
        { key: "lUpLeg",   label: "L UpLeg",     bones: ["leftupleg"] },
        { key: "lLeg",     label: "L Leg",       bones: ["leftleg"] },
        { key: "lFoot",    label: "L Foot",      bones: ["leftfoot", "lefttoebase"] },
        { key: "rUpLeg",   label: "R UpLeg",     bones: ["rightupleg"] },
        { key: "rLeg",     label: "R Leg",       bones: ["rightleg"] },
        { key: "rFoot",    label: "R Foot",      bones: ["rightfoot", "righttoebase"] },
        { key: "lArm",     label: "L UpArm",     bones: ["leftshoulder", "leftarm"] },
        { key: "lForeArm", label: "L ForeArm",   bones: ["leftforearm"] },
        { key: "lHand",    label: "L Hand",      bones: ["lefthand", "lefthandthumb1", "lefthandthumb2", "lefthandthumb3", "lefthandindex1", "lefthandindex2", "lefthandindex3", "lefthandmiddle1", "lefthandmiddle2", "lefthandmiddle3", "lefthandring1", "lefthandring2", "lefthandring3", "lefthandpinky1", "lefthandpinky2", "lefthandpinky3"] },
        { key: "rArm",     label: "R UpArm",     bones: ["rightshoulder", "rightarm"] },
        { key: "rForeArm", label: "R ForeArm",   bones: ["rightforearm"] },
        { key: "rHand",    label: "R Hand",      bones: ["righthand", "righthandthumb1", "righthandthumb2", "righthandthumb3", "righthandindex1", "righthandindex2", "righthandindex3", "righthandmiddle1", "righthandmiddle2", "righthandmiddle3", "righthandring1", "righthandring2", "righthandring3", "righthandpinky1", "righthandpinky2", "righthandpinky3"] },
        { key: "head",     label: "Head",        bones: ["neck", "head"] }
    ];

    function showBoneSyncDebugPanel(autoDefaults) {
        if (document.getElementById("bone-sync-debug")) return;

        autoDefaults = autoDefaults || {};

        // Init debug state using auto-computed defaults
        var dbg = { scale: 0.01, posY: 0, groups: {} };
        BONE_GROUPS.forEach(function (g) {
            var ad = autoDefaults[g.key] || {};
            dbg.groups[g.key] = {
                rx: ad.rx !== undefined ? ad.rx : (g.key === "hips" ? -90 : 0),
                ry: ad.ry !== undefined ? ad.ry : 0,
                rz: ad.rz !== undefined ? ad.rz : 0
            };
        });
        window._boneSyncDebug = dbg;

        var panel = document.createElement("div");
        panel.id = "bone-sync-debug";
        panel.style.cssText = "position:fixed;top:10px;right:10px;background:rgba(0,0,0,0.9);color:#fff;padding:12px;border-radius:8px;z-index:10000;font:11px monospace;width:320px;max-height:90vh;overflow-y:auto;";

        var title = document.createElement("div");
        title.textContent = "🔧 Bone Sync Debug";
        title.style.cssText = "font-weight:bold;margin-bottom:8px;font-size:13px;";
        panel.appendChild(title);

        function makeSlider(container, label, min, max, step, defaultVal, onChange) {
            var row = document.createElement("div");
            row.style.cssText = "margin:2px 0;display:flex;align-items:center;gap:4px;";
            var lbl = document.createElement("span");
            lbl.style.cssText = "width:28px;text-align:right;font-size:10px;";
            lbl.textContent = label;
            var inp = document.createElement("input");
            inp.type = "range";
            inp.min = min; inp.max = max; inp.step = step; inp.value = defaultVal;
            inp.style.cssText = "flex:1;height:14px;";
            var val = document.createElement("span");
            val.style.cssText = "width:46px;text-align:left;font-size:10px;";
            val.textContent = step < 1 ? Number(defaultVal).toFixed(4) : Number(defaultVal).toFixed(0);
            inp.addEventListener("input", function () {
                var v = parseFloat(inp.value);
                val.textContent = step < 1 ? v.toFixed(4) : v.toFixed(0);
                onChange(v, inp, val);
            });
            row.appendChild(lbl); row.appendChild(inp); row.appendChild(val);
            container.appendChild(row);
            return { inp: inp, val: val };
        }

        // Per-group sections
        BONE_GROUPS.forEach(function (g) {
            var section = document.createElement("div");
            section.style.cssText = "margin:6px 0 2px;border-top:1px solid #444;padding-top:4px;";
            var hdr = document.createElement("div");
            hdr.style.cssText = "font-weight:bold;font-size:11px;color:#4a9eff;cursor:pointer;";
            hdr.textContent = "▸ " + g.label;
            var content = document.createElement("div");
            content.style.display = g.key === "hips" ? "block" : "none";
            if (g.key === "hips") hdr.textContent = "▾ " + g.label;
            hdr.addEventListener("click", function () {
                var show = content.style.display === "none";
                content.style.display = show ? "block" : "none";
                hdr.textContent = (show ? "▾ " : "▸ ") + g.label;
            });
            var defaults = dbg.groups[g.key];
            makeSlider(content, "X°", -180, 180, 1, defaults.rx, function (v) { dbg.groups[g.key].rx = v; });
            makeSlider(content, "Y°", -180, 180, 1, defaults.ry, function (v) { dbg.groups[g.key].ry = v; });
            makeSlider(content, "Z°", -180, 180, 1, defaults.rz, function (v) { dbg.groups[g.key].rz = v; });
            section.appendChild(hdr);
            section.appendChild(content);
            panel.appendChild(section);
        });

        // Global sliders
        var globalSection = document.createElement("div");
        globalSection.style.cssText = "margin:8px 0 2px;border-top:1px solid #666;padding-top:6px;";
        var globalHdr = document.createElement("div");
        globalHdr.style.cssText = "font-weight:bold;font-size:11px;color:#ffaa4a;";
        globalHdr.textContent = "Global";
        globalSection.appendChild(globalHdr);
        makeSlider(globalSection, "Scale", 0.001, 0.1, 0.0001, 0.01, function (v, inp, val) { dbg.scale = v; });
        makeSlider(globalSection, "PosY", -2, 2, 0.01, 0, function (v) { dbg.posY = v; });
        panel.appendChild(globalSection);

        // Copy button
        var copyBtn = document.createElement("button");
        copyBtn.textContent = "📋 Copy Values";
        copyBtn.style.cssText = "margin-top:8px;padding:5px 12px;cursor:pointer;background:#4a9eff;color:#fff;border:none;border-radius:4px;font:11px monospace;width:100%;";
        copyBtn.addEventListener("click", function () {
            var lines = ["Bone Sync Values:"];
            lines.push("  Scale: " + dbg.scale.toFixed(6));
            lines.push("  Pos Y: " + dbg.posY.toFixed(4));
            BONE_GROUPS.forEach(function (g) {
                var gr = dbg.groups[g.key];
                if (gr.rx !== 0 || gr.ry !== 0 || gr.rz !== 0) {
                    lines.push("  " + g.label + ": X=" + gr.rx + "° Y=" + gr.ry + "° Z=" + gr.rz + "°");
                }
            });
            var text = lines.join("\n");
            navigator.clipboard.writeText(text).then(function () {
                copyBtn.textContent = "✅ Copied!";
                setTimeout(function () { copyBtn.textContent = "📋 Copy Values"; }, 1500);
            });
        });
        panel.appendChild(copyBtn);

        document.body.appendChild(panel);
    }

    function hideBoneSyncDebugPanel() {
        var panel = document.getElementById("bone-sync-debug");
        if (panel) panel.remove();
    }

    // Character visibility toggle
    btnCharToggle.addEventListener("click", function () {
        characterVisible = !characterVisible;
        characterMeshes.forEach(function (m) { m.visibility = characterVisible ? 1 : 0; });
        if (characterVisible) {
            btnCharToggle.classList.remove("char-hidden");
            btnCharToggle.textContent = "👤 Character";
        } else {
            btnCharToggle.classList.add("char-hidden");
            btnCharToggle.textContent = "👤 Hidden";
        }
    });

    // Load extra animations from animations/ folder
    // Active bone-sync observer for custom GLB animations
    var _boneSyncObserver = null;

    function normalizeBoneName(name) {
        if (!name) return "";
        var n = name.replace(/^(Armature\|)/, "")
                     .replace(/^mixamorig[_:]/, "")
                     .replace(/^mixamorig\./, "");
        return n.toLowerCase().replace(/[\s_\-\.]/g, "");
    }

    // Stop any active bone-sync (call when switching back to built-in anims)
    function stopBoneSync() {
        if (_boneSyncObserver) {
            scene.onBeforeRenderObservable.remove(_boneSyncObserver);
            _boneSyncObserver = null;
        }
        hideBoneSyncDebugPanel();

        // Re-attach shoes to character skeleton bones
        if (skeleton && leftAttachNode && rightAttachNode) {
            var leftFootBone = skeleton.bones.find(function (b) {
                var n = b.name.toLowerCase();
                return n.includes("leftfoot") && !n.includes("toe");
            });
            var rightFootBone = skeleton.bones.find(function (b) {
                var n = b.name.toLowerCase();
                return n.includes("rightfoot") && !n.includes("toe");
            });
            var shoeScale = 0.19;
            if (leftFootBone) {
                leftAttachNode.rotationQuaternion = null;
                leftAttachNode.attachToBone(leftFootBone,
                    leftFootBone.getTransformNode() || scene.meshes[0]);
                leftAttachNode.scaling = new BABYLON.Vector3(shoeScale, shoeScale, shoeScale);
                leftAttachNode.position = new BABYLON.Vector3(0, -0.01, 0.08);
                leftAttachNode.rotation = new BABYLON.Vector3(
                    2 * Math.PI / 180, 87 * Math.PI / 180, 1 * Math.PI / 180);
            }
            if (rightFootBone) {
                rightAttachNode.rotationQuaternion = null;
                rightAttachNode.attachToBone(rightFootBone,
                    rightFootBone.getTransformNode() || scene.meshes[0]);
                rightAttachNode.scaling = new BABYLON.Vector3(-shoeScale, shoeScale, shoeScale);
                rightAttachNode.position = new BABYLON.Vector3(0, -0.01, 0.08);
                rightAttachNode.rotation = new BABYLON.Vector3(
                    2 * Math.PI / 180, 87 * Math.PI / 180, 1 * Math.PI / 180);
            }
        }
    }

    async function loadExtraAnimations() {
        try {
            var resp = await fetch("animations/index.json?_=" + Date.now());
            if (!resp.ok) return;
            var manifest = await resp.json();

            for (var i = 0; i < manifest.length; i++) {
                var entry = manifest[i];
                try {
                    // Load GLB into an asset container (keeps it isolated)
                    var container = await BABYLON.SceneLoader.LoadAssetContainerAsync(
                        "animations/", entry.file, scene
                    );

                    // ── Capture GLB rest rotations BEFORE addAllToScene ──
                    // (animations haven't auto-played yet, so these are true rest poses)
                    var glbRestRotations = {};
                    container.transformNodes.forEach(function (tn) {
                        var key = normalizeBoneName(tn.name);
                        if (key && tn.rotationQuaternion) {
                            glbRestRotations[key] = tn.rotationQuaternion.clone();
                        }
                    });

                    // Detect Armature rotation before addAllToScene
                    var armatureRotation = BABYLON.Quaternion.Identity();
                    var hipsNodePre = container.transformNodes.find(function (tn) {
                        return normalizeBoneName(tn.name) === "hips";
                    });
                    if (hipsNodePre && hipsNodePre.parent) {
                        var armNode = hipsNodePre.parent;
                        if (armNode.rotationQuaternion) {
                            armatureRotation = armNode.rotationQuaternion.clone();
                        } else if (armNode.rotation) {
                            armatureRotation = BABYLON.Quaternion.FromEulerVector(armNode.rotation);
                        }
                        console.log("[AnimLoader]", entry.file, "— Armature rotation:",
                            "X:", armatureRotation.x.toFixed(3),
                            "Y:", armatureRotation.y.toFixed(3),
                            "Z:", armatureRotation.z.toFixed(3),
                            "W:", armatureRotation.w.toFixed(3));
                    }

                    // Add everything to the scene so animation groups can play
                    container.addAllToScene();

                    // Immediately stop auto-playing animation groups
                    container.animationGroups.forEach(function (ag) { ag.stop(); });

                    // Hide all imported meshes visually but keep them ENABLED
                    container.meshes.forEach(function (m) { m.isVisible = false; });

                    // Check GLB root scale
                    var glbRootScale = 1;
                    var rootNode = container.meshes.find(function (m) { return m.name === "__root__"; });
                    if (rootNode && rootNode.scaling) {
                        glbRootScale = rootNode.scaling.y;
                        console.log("[AnimLoader]", entry.file, "— GLB root scale:", glbRootScale);
                    }

                    // Build bone name map: normalized name → GLB TransformNode
                    var glbNodeMap = {};
                    container.transformNodes.forEach(function (tn) {
                        var key = normalizeBoneName(tn.name);
                        if (key) glbNodeMap[key] = tn;
                    });

                    // Build character bone map
                    var charBoneMap = {};
                    if (skeleton) {
                        skeleton.bones.forEach(function (b) {
                            var key = normalizeBoneName(b.name);
                            if (key) charBoneMap[key] = b;
                        });
                    }

                    // ── Build bone links with auto-computed correction quaternions ──
                    // correction = charBoneRest * inverse(glbBoneRest)
                    // For Hips: correction = charHipsRest * inverse(armRot * glbHipsRest)
                    var boneLinks = [];
                    var hipsLink = null;
                    var correctionLog = [];
                    Object.keys(glbNodeMap).forEach(function (key) {
                        if (charBoneMap[key]) {
                            var tn = glbNodeMap[key];
                            var bone = charBoneMap[key];

                            // GLB rest rotation (captured before addAllToScene)
                            var glbRest = glbRestRotations[key] || BABYLON.Quaternion.Identity();

                            // Character bone rest rotation from rest matrix
                            var charRest = BABYLON.Quaternion.Identity();
                            try {
                                var restMat = bone.getRestMatrix();
                                if (restMat) {
                                    var _s = new BABYLON.Vector3();
                                    var _r = new BABYLON.Quaternion();
                                    var _t = new BABYLON.Vector3();
                                    restMat.decompose(_s, _r, _t);
                                    charRest = _r;
                                }
                            } catch (e) {}

                            var isHips = key === "hips";
                            var correction;
                            if (isHips) {
                                // Hips parent space differs: GLB has Armature, .babylon has skeleton root
                                var glbWorldRest = armatureRotation.multiply(glbRest);
                                correction = charRest.multiply(BABYLON.Quaternion.Inverse(glbWorldRest));
                            } else {
                                correction = charRest.multiply(BABYLON.Quaternion.Inverse(glbRest));
                            }

                            // Log correction as euler angles for debugging
                            var euler = correction.toEulerAngles();
                            correctionLog.push(key + ": X=" +
                                (euler.x * 180 / Math.PI).toFixed(1) + "° Y=" +
                                (euler.y * 180 / Math.PI).toFixed(1) + "° Z=" +
                                (euler.z * 180 / Math.PI).toFixed(1) + "°");

                            var link = {
                                glbNode: tn,
                                charBone: bone,
                                isHips: isHips,
                                correction: correction
                            };
                            boneLinks.push(link);
                            if (isHips) hipsLink = link;
                        }
                    });

                    console.log("[AnimLoader]", entry.file, "— computed corrections:\n  " + correctionLog.join("\n  "));

                    // Log rest poses for key bones to help diagnose
                    var debugBones = ["hips", "leftupleg", "leftleg", "leftfoot", "spine"];
                    debugBones.forEach(function (bname) {
                        var glbR = glbRestRotations[bname];
                        var charR = null;
                        if (charBoneMap[bname]) {
                            try {
                                var rm = charBoneMap[bname].getRestMatrix();
                                var _ss = new BABYLON.Vector3(), _rr = new BABYLON.Quaternion(), _tt = new BABYLON.Vector3();
                                rm.decompose(_ss, _rr, _tt);
                                charR = _rr;
                            } catch(e) {}
                        }
                        if (glbR && charR) {
                            var ge = glbR.toEulerAngles();
                            var ce = charR.toEulerAngles();
                            console.log("[RestPose]", bname,
                                "GLB:", (ge.x*180/Math.PI).toFixed(1) + "," + (ge.y*180/Math.PI).toFixed(1) + "," + (ge.z*180/Math.PI).toFixed(1),
                                "CHAR:", (ce.x*180/Math.PI).toFixed(1) + "," + (ce.y*180/Math.PI).toFixed(1) + "," + (ce.z*180/Math.PI).toFixed(1));
                        }
                    });

                    console.log("[AnimLoader]", entry.file, "— matched", boneLinks.length, "bones");

                    // Compute scale factor
                    var posScale = 1;
                    if (hipsLink) {
                        var glbHipsYRaw = Math.abs(hipsLink.glbNode.position ? hipsLink.glbNode.position.y : 0);
                        var glbHipsY = glbHipsYRaw * glbRootScale;
                        var charHipsY = 0;
                        try {
                            var charHipsMat = hipsLink.charBone.getAbsoluteTransform();
                            charHipsY = charHipsMat.m[13];
                        } catch (e) {
                            charHipsY = hipsLink.charBone.position ? hipsLink.charBone.position.y : 0;
                        }
                        charHipsY = Math.abs(charHipsY);
                        if (glbHipsY > 1 && charHipsY > 0.01) {
                            posScale = charHipsY / glbHipsY;
                        } else if (glbHipsY > 10) {
                            posScale = 0.01;
                        }
                        console.log("[AnimLoader]", entry.file, "— hips scale: GLB Y=" + glbHipsY.toFixed(2) + " Char Y=" + charHipsY.toFixed(2) + " → factor=" + posScale.toFixed(6));
                    }

                    var animKey = entry.name.toLowerCase().replace(/\s+/g, "_");
                    animRanges[animKey] = {
                        animationGroup: container.animationGroups[0] || null,
                        boneLinks: boneLinks,
                        posScale: posScale,
                        glbRootScale: glbRootScale,
                        armatureRotation: armatureRotation,
                        glbNodeMap: glbNodeMap,
                        isCustomGLB: true
                    };

                    var btn = document.createElement("button");
                    btn.className = "anim-btn";
                    btn.dataset.anim = animKey;
                    btn.textContent = (entry.icon || "▶") + " " + entry.name;
                    animBar.insertBefore(btn, btnCharToggle);

                    (function (key) {
                        btn.addEventListener("click", function () {
                            playAnimation(key);
                            document.querySelectorAll(".anim-btn").forEach(function (b) { b.classList.remove("active"); });
                            this.classList.add("active");
                        });
                    })(animKey);
                } catch (e) {
                    console.warn("Could not load animation:", entry.file, e);
                }
            }
        } catch (e) { /* No animations — skip */ }
    }

    // Hat state
    let hatCloseupActive = false;

    // ── Hat / Accessories ──────────────────────────────────────
    btnHatToggle.addEventListener("click", function () {
        hatVisible = !hatVisible;
        if (hatVisible) {
            btnHatToggle.classList.remove("char-hidden");
            btnHatToggle.textContent = "🧢 Hat On";
            btnHatCloseup.classList.remove("hidden");
            loadOrShowHat();
            // Zoom out to show full body (hat + shoes)
            animateCamera(FULLBODY_CAMERA, 25);
        } else {
            btnHatToggle.classList.add("char-hidden");
            btnHatToggle.textContent = "🧢 Hat";
            btnHatCloseup.classList.add("hidden");
            hatCloseupActive = false;
            btnHatCloseup.classList.remove("active");
            if (hatMesh) hatMesh.setEnabled(false);
            // Zoom back to normal preview
            animateCamera(PREVIEW_CAMERA, 25);
        }
    });

    // Close-up toggle for head & shoulders view of hat
    btnHatCloseup.addEventListener("click", function () {
        hatCloseupActive = !hatCloseupActive;
        if (hatCloseupActive) {
            btnHatCloseup.classList.add("active");
            animateCamera(HAT_CLOSEUP_CAMERA, 25);
        } else {
            btnHatCloseup.classList.remove("active");
            animateCamera(FULLBODY_CAMERA, 25);
        }
    });

    function loadOrShowHat() {
        if (hatMesh) {
            hatMesh.setEnabled(true);
            return;
        }
        if (!skeleton) return;

        var headBone = skeleton.bones.find(function (b) {
            return b.name.toLowerCase().includes("head") &&
                   !b.name.toLowerCase().includes("headtop");
        });
        if (!headBone) return;

        hatMesh = new BABYLON.TransformNode("hatRoot", scene);
        hatMesh.attachToBone(headBone, headBone.getTransformNode() || scene.meshes[0]);
        hatMesh.position = new BABYLON.Vector3(0, 0.15, 0.02);
        hatMesh.scaling = new BABYLON.Vector3(0.12, 0.12, 0.12);

        var crown = BABYLON.MeshBuilder.CreateSphere("capCrown", {
            diameterX: 1.6, diameterY: 0.7, diameterZ: 1.6, segments: 16
        }, scene);
        crown.parent = hatMesh;
        crown.position.y = 0.1;

        var brim = BABYLON.MeshBuilder.CreateDisc("capBrim", {
            radius: 1.1, tessellation: 24
        }, scene);
        brim.parent = hatMesh;
        brim.rotation.x = Math.PI / 2;
        brim.position.y = -0.1;
        brim.position.z = 0.3;

        var capMat = new BABYLON.StandardMaterial("capMat", scene);
        capMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.6);
        capMat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        crown.material = capMat;
        brim.material = capMat;
    }

    // ── UV Grid Texture ────────────────────────────────────────
    btnUvGrid.addEventListener("click", function () {
        uvGridActive = !uvGridActive;
        if (uvGridActive) {
            btnUvGrid.classList.add("active");
            applyUvGrid();
        } else {
            btnUvGrid.classList.remove("active");
            removeUvGrid();
        }
    });

    function generateUvGridTexture() {
        // Always load fresh from the JPG file so edits are visible on refresh
        if (uvGridTexture) {
            uvGridTexture.dispose();
        }
        uvGridTexture = new BABYLON.Texture(
            "textures/uv-grid.jpg?_=" + Date.now(),
            scene, false, true,
            BABYLON.Texture.BILINEAR_SAMPLINGMODE
        );
        // Flip U so text reads correctly on the 3D model
        // uScale = -1 mirrors, uOffset = 1 corrects the shift
        uvGridTexture.uScale = -1;
        uvGridTexture.uOffset = 1;
        return uvGridTexture;
    }

    function applyUvGrid() {
        var tex = generateUvGridTexture();
        savedZoneTextures = {};

        ZONE_NAMES.forEach(function (name) {
            var zone = shoeZones[name];
            if (!zone) return;
            savedZoneTextures[name] = {
                texture: zone.material.albedoTexture,
                color: zone.material.albedoColor ? zone.material.albedoColor.clone() : null,
                customFlag: zone.material._customTexture
            };
            zone.material.albedoTexture = tex;
            zone.material.albedoColor = BABYLON.Color3.White();
        });
    }

    function removeUvGrid() {
        ZONE_NAMES.forEach(function (name) {
            var zone = shoeZones[name];
            if (!zone) return;
            var saved = savedZoneTextures[name];
            if (saved) {
                zone.material.albedoTexture = saved.texture;
                if (saved.color) zone.material.albedoColor = saved.color;
                zone.material._customTexture = saved.customFlag;
            }
        });
        savedZoneTextures = {};
    }

    // ── Export UV Map with zone wireframes ──────────────────────
    var btnExportUv = document.getElementById("btn-export-uv");

    btnExportUv.addEventListener("click", function () {
        exportUvLayout();
    });

    function exportUvLayout() {
        var mapSize = 2048;
        var cvs = document.createElement("canvas");
        cvs.width = mapSize;
        cvs.height = mapSize;
        var ctx = cvs.getContext("2d");

        // Draw numbered grid as background
        var gridCount = 16;
        var cellSize = mapSize / gridCount;

        ctx.fillStyle = "#1a1a2e";
        ctx.fillRect(0, 0, mapSize, mapSize);

        for (var row = 0; row < gridCount; row++) {
            for (var col = 0; col < gridCount; col++) {
                var x = col * cellSize;
                var y = row * cellSize;
                var num = row * gridCount + col + 1;
                var isEven = (row + col) % 2 === 0;

                ctx.fillStyle = isEven ? "#222" : "#2a2a2a";
                ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);

                ctx.strokeStyle = "#333";
                ctx.lineWidth = 0.5;
                ctx.strokeRect(x, y, cellSize, cellSize);

                ctx.fillStyle = "#555";
                ctx.font = "bold " + Math.floor(cellSize * 0.25) + "px monospace";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                // Counter-flip text so it reads correctly after global mirror
                ctx.save();
                ctx.translate(x + cellSize / 2, y + cellSize / 2);
                ctx.scale(-1, 1);
                ctx.fillText(String(num), 0, 0);
                ctx.restore();
            }
        }

        // Pass 1: Draw filled zone triangles with low opacity
        ZONE_NAMES.forEach(function (zoneName) {
            var zone = shoeZones[zoneName];
            if (!zone || !zone.mesh) return;

            var mesh = zone.mesh;
            var uvs = mesh.getVerticesData(BABYLON.VertexBuffer.UVKind);
            var indices = mesh.getIndices();
            if (!uvs || !indices) return;

            var color = ZONE_COLORS[zoneName] || "#FFFFFF";

            var startIndex = 0;
            var indexCount = indices.length;
            if (zone.subMeshIndex >= 0 && mesh.subMeshes && mesh.subMeshes[zone.subMeshIndex]) {
                var sm = mesh.subMeshes[zone.subMeshIndex];
                startIndex = sm.indexStart;
                indexCount = sm.indexCount;
            }

            // Parse hex color to rgba with low alpha for fill
            var r = parseInt(color.substring(1, 3), 16);
            var g = parseInt(color.substring(3, 5), 16);
            var b = parseInt(color.substring(5, 7), 16);
            ctx.fillStyle = "rgba(" + r + "," + g + "," + b + ",0.2)";

            for (var i = startIndex; i < startIndex + indexCount; i += 3) {
                var i0 = indices[i], i1 = indices[i + 1], i2 = indices[i + 2];

                // Standard UV space: U = left-to-right, V flipped for canvas Y
                var x0 = uvs[i0 * 2] * mapSize, y0 = (1 - uvs[i0 * 2 + 1]) * mapSize;
                var x1 = uvs[i1 * 2] * mapSize, y1 = (1 - uvs[i1 * 2 + 1]) * mapSize;
                var x2 = uvs[i2 * 2] * mapSize, y2 = (1 - uvs[i2 * 2 + 1]) * mapSize;

                ctx.beginPath();
                ctx.moveTo(x0, y0);
                ctx.lineTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.closePath();
                ctx.fill();
            }
        });

        // Pass 2: Draw zone wireframe outlines
        ZONE_NAMES.forEach(function (zoneName) {
            var zone = shoeZones[zoneName];
            if (!zone || !zone.mesh) return;

            var mesh = zone.mesh;
            var uvs = mesh.getVerticesData(BABYLON.VertexBuffer.UVKind);
            var indices = mesh.getIndices();
            if (!uvs || !indices) return;

            var color = ZONE_COLORS[zoneName] || "#FFFFFF";
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;

            var startIndex = 0;
            var indexCount = indices.length;
            if (zone.subMeshIndex >= 0 && mesh.subMeshes && mesh.subMeshes[zone.subMeshIndex]) {
                var sm = mesh.subMeshes[zone.subMeshIndex];
                startIndex = sm.indexStart;
                indexCount = sm.indexCount;
            }

            var centroidSumX = 0, centroidSumY = 0, triCount = 0;

            for (var i = startIndex; i < startIndex + indexCount; i += 3) {
                var i0 = indices[i], i1 = indices[i + 1], i2 = indices[i + 2];

                var x0 = uvs[i0 * 2] * mapSize, y0 = (1 - uvs[i0 * 2 + 1]) * mapSize;
                var x1 = uvs[i1 * 2] * mapSize, y1 = (1 - uvs[i1 * 2 + 1]) * mapSize;
                var x2 = uvs[i2 * 2] * mapSize, y2 = (1 - uvs[i2 * 2 + 1]) * mapSize;

                ctx.beginPath();
                ctx.moveTo(x0, y0);
                ctx.lineTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.closePath();
                ctx.stroke();

                centroidSumX += (x0 + x1 + x2) / 3;
                centroidSumY += (y0 + y1 + y2) / 3;
                triCount++;
            }

            // Zone label at centroid
            if (triCount > 0) {
                var cx = centroidSumX / triCount;
                var cy = centroidSumY / triCount;
                var label = FRIENDLY_NAMES[zoneName] || zoneName;

                ctx.font = "bold 32px sans-serif";
                var tw = ctx.measureText(label).width + 16;

                ctx.fillStyle = "rgba(0,0,0,0.8)";
                ctx.fillRect(cx - tw / 2, cy - 20, tw, 40);

                // Counter-flip label text so it reads correctly after global mirror
                ctx.save();
                ctx.translate(cx, cy);
                ctx.scale(-1, 1);
                ctx.fillStyle = color;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(label, 0, 0);
                ctx.restore();
            }
        });

        // Draw legend in bottom-left
        var legendY = mapSize - 30;
        ctx.font = "bold 22px sans-serif";
        ctx.textAlign = "left";
        ZONE_NAMES.slice().reverse().forEach(function (name) {
            var color = ZONE_COLORS[name] || "#FFF";
            var label = FRIENDLY_NAMES[name] || name;

            ctx.fillStyle = "rgba(0,0,0,0.8)";
            ctx.fillRect(10, legendY - 14, 200, 26);
            ctx.fillStyle = color;
            ctx.fillRect(14, legendY - 10, 18, 18);
            // Counter-flip legend text
            ctx.save();
            ctx.translate(38 + 60, legendY + 2);
            ctx.scale(-1, 1);
            ctx.fillStyle = "#fff";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(label, 0, 0);
            ctx.restore();
            legendY -= 30;
        });

        // Flip entire canvas horizontally so it matches what appears on shoe
        var flipped = document.createElement("canvas");
        flipped.width = mapSize;
        flipped.height = mapSize;
        var fCtx = flipped.getContext("2d");
        fCtx.translate(mapSize, 0);
        fCtx.scale(-1, 1);
        fCtx.drawImage(cvs, 0, 0);

        // Export as JPG download
        flipped.toBlob(function (blob) {
            var url = URL.createObjectURL(blob);
            var a = document.createElement("a");
            a.href = url;
            a.download = "uv-layout-" + Date.now() + ".jpg";
            a.click();
            URL.revokeObjectURL(url);
        }, "image/jpeg", 0.92);
    }

    // ================================================================
    //  8. UTILITIES
    // ================================================================

    function colorToHex(color3) {
        if (!color3) return "#808080";
        const r = Math.round(Math.min(1, Math.max(0, color3.r)) * 255);
        const g = Math.round(Math.min(1, Math.max(0, color3.g)) * 255);
        const b = Math.round(Math.min(1, Math.max(0, color3.b)) * 255);
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    function hexToColor3(hex) {
        hex = hex.replace("#", "");
        const r = parseInt(hex.substring(0, 2), 16) / 255;
        const g = parseInt(hex.substring(2, 4), 16) / 255;
        const b = parseInt(hex.substring(4, 6), 16) / 255;
        return new BABYLON.Color3(r, g, b);
    }

    function hideLoading() {
        loadingOverlay.classList.add("hidden");
        setTimeout(() => { loadingOverlay.style.display = "none"; }, 600);
    }

    // ================================================================
    //  9. ENGINE RENDER LOOP & RESIZE
    // ================================================================

    engine.runRenderLoop(function () {
        scene.render();
    });

    window.addEventListener("resize", function () {
        engine.resize();
    });

    // ================================================================
    //  10. CAMERA POSITION PANEL
    // ================================================================

    const cameraPanel = document.getElementById("camera-panel");
    const btnToggleCamera = document.getElementById("btn-toggle-camera");
    const btnCloseCamera = document.getElementById("btn-close-camera");
    const btnCopyCamera = document.getElementById("btn-copy-camera");
    const btnResetCamera = document.getElementById("btn-reset-camera");
    const cameraCopyFeedback = document.getElementById("camera-copy-feedback");

    const camLabels = {
        alpha:  document.getElementById("cam-alpha"),
        beta:   document.getElementById("cam-beta"),
        radius: document.getElementById("cam-radius"),
        tx:     document.getElementById("cam-tx"),
        ty:     document.getElementById("cam-ty"),
        tz:     document.getElementById("cam-tz")
    };

    if (btnToggleCamera) {
        btnToggleCamera.addEventListener("click", function () {
            cameraPanel.classList.remove("hidden");
            btnToggleCamera.style.display = "none";
        });
    }

    if (btnCloseCamera) {
        btnCloseCamera.addEventListener("click", function () {
            cameraPanel.classList.add("hidden");
            btnToggleCamera.style.display = "";
        });
    }

    if (btnResetCamera) {
        btnResetCamera.addEventListener("click", function () {
            // Animate to reset (fixes two-press bug caused by alpha wrapping)
            var target = previewMode ? PREVIEW_CAMERA : DEFAULT_CAMERA;
            animateCamera(target, 15);
        });
    }

    if (btnCopyCamera) {
        btnCopyCamera.addEventListener("click", function () {
            var vals = {
                alpha: parseFloat(camera.alpha.toFixed(4)),
                beta: parseFloat(camera.beta.toFixed(4)),
                radius: parseFloat(camera.radius.toFixed(4)),
                target: {
                    x: parseFloat(camera.target.x.toFixed(4)),
                    y: parseFloat(camera.target.y.toFixed(4)),
                    z: parseFloat(camera.target.z.toFixed(4))
                }
            };
            navigator.clipboard.writeText(JSON.stringify(vals, null, 2)).then(function () {
                cameraCopyFeedback.style.display = "block";
                setTimeout(function () { cameraCopyFeedback.style.display = "none"; }, 2000);
            });
        });
    }

    // Update camera value display every frame
    scene.registerAfterRender(function () {
        if (!camLabels.alpha) return;
        camLabels.alpha.textContent = camera.alpha.toFixed(2);
        camLabels.beta.textContent = camera.beta.toFixed(2);
        camLabels.radius.textContent = camera.radius.toFixed(2);
        camLabels.tx.textContent = camera.target.x.toFixed(2);
        camLabels.ty.textContent = camera.target.y.toFixed(2);
        camLabels.tz.textContent = camera.target.z.toFixed(2);
    });

    // Load model manifest (which loads the first model), then load presets
    loadModelManifest().then(function () {
        loadPresets();
    });

})();
