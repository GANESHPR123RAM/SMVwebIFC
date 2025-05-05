import * as THREE from "three";
import * as BUI from "@thatopen/ui";
import Stats from "stats.js/src/Stats";
import * as OBC from "@thatopen/components";
import * as WEBIFC from "web-ifc";
import * as FRAGS from "@thatopen/fragments";

async function main() {
  const container = document.getElementById("container")!;
  const components = new OBC.Components();

  const worlds = components.get(OBC.Worlds);
  const world = worlds.create<
    OBC.SimpleScene,
    OBC.SimpleCamera,
    OBC.SimpleRenderer
  >();
  world.scene = new OBC.SimpleScene(components);
  world.renderer = new OBC.SimpleRenderer(components, container);
  world.camera = new OBC.SimpleCamera(components);

  await components.init();
  world.scene.setup();
  world.scene.three.background = null;

  const material = new THREE.MeshLambertMaterial({
    color: "#6528D7",
    transparent: true,
    opacity: 0.2,
  });
  const cube = new THREE.Mesh(new THREE.BoxGeometry(), material);
  cube.rotation.set(Math.PI / 4.2, Math.PI / 4.2, Math.PI / 4.2);
  cube.updateMatrixWorld();
  world.scene.three.add(cube);

  world.camera.controls.setLookAt(3, 3, 3, 0, 0, 0);

  const stats = new Stats();
  stats.showPanel(2);
  document.body.append(stats.dom);
  stats.dom.style.left = "0px";
  stats.dom.style.zIndex = "unset";
  world.renderer.onBeforeUpdate.add(() => stats.begin());
  world.renderer.onAfterUpdate.add(() => stats.end());

  const fragments = components.get(OBC.FragmentsManager);
  const fragmentIfcLoader = components.get(OBC.IfcLoader);

  async function setupIFCLoader() {
    await fragmentIfcLoader.setup();
    const excludedCats = [
      WEBIFC.IFCTENDONANCHOR,
      WEBIFC.IFCREINFORCINGBAR,
      WEBIFC.IFCREINFORCINGELEMENT,
    ];
    excludedCats.forEach(cat => fragmentIfcLoader.settings.excludedCategories.add(cat));
    fragmentIfcLoader.settings.webIfc.COORDINATE_TO_ORIGIN = true;
  }

  await setupIFCLoader();

  const fileInput = document.getElementById("ifcInput") as HTMLInputElement;
  let currentModel: THREE.Object3D | null = null;
  let group: FRAGS.FragmentsGroup | null = null;
  let exploder: OBC.Exploder | null = null;

  const modelNameDiv = document.getElementById("modelName")!;
  const objectCountDiv = document.getElementById("objectCount")!;
  const categoryListDiv = document.getElementById("categoryList")!;

  fileInput.addEventListener("change", async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const buffer = new Uint8Array(await file.arrayBuffer());

    try {
      if (currentModel) {
        world.scene.three.remove(currentModel);
        fragments.dispose();
      }

      currentModel = await fragmentIfcLoader.load(buffer);
      currentModel.name = file.name;
      world.scene.three.children.pop();
      world.scene.three.add(currentModel);

      group = fragments.groups.values().next().value as FRAGS.FragmentsGroup;
      if (!group) throw new Error("❌ No fragments group found.");

      const classifier = components.get(OBC.Classifier);
      await classifier.bySpatialStructure(group, {
        isolate: new Set([WEBIFC.IFCBUILDINGSTOREY]),
      });

      exploder = components.get(OBC.Exploder);

      modelNameDiv.textContent = `Name: ${file.name}`;
      objectCountDiv.textContent = `Objects: ${currentModel.children.length}`;

      const categories = new Set<string>();
      currentModel.traverse((child) => {
        if ((child as any).ifcCategory) categories.add((child as any).ifcCategory);
      });

      categoryListDiv.innerHTML = "";
      if (categories.size > 0) {
        categories.forEach((cat) => {
          const div = document.createElement("div");
          div.textContent = `- ${cat}`;
          categoryListDiv.appendChild(div);
        });
      } else {
        categoryListDiv.innerHTML = "<div>- No categories found</div>";
      }

      console.log("✅ IFC model loaded:", currentModel);
    } catch (error) {
      console.error("❌ Failed to load IFC model:", error);
    }
  });

  document.addEventListener("keydown", (event) => {
    const { key, shiftKey } = event;
    const dist = shiftKey ? -10 : 10;

    switch (key.toLowerCase()) {
      case "x": world.camera.controls.setLookAt(dist, 0, 0, 0, 0, 0); break;
      case "y": world.camera.controls.setLookAt(0, dist, 0, 0, 0, 0); break;
      case "z": world.camera.controls.setLookAt(0, 0, dist, 0, 0, 0); break;
    }
  });

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  const tooltip = document.createElement("div");
  Object.assign(tooltip.style, {
    position: "absolute", padding: "6px 10px", pointerEvents: "none",
    background: "#111", color: "white", borderRadius: "4px",
    fontSize: "12px", display: "none", zIndex: "10",
  });
  document.body.appendChild(tooltip);

  let previousMesh: THREE.Mesh | null = null;
  let previousMaterial: THREE.Material | THREE.Material[] | null = null;

  container.addEventListener("mousemove", (event) => {
    const rect = container.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, world.camera.three);
    const intersects = raycaster.intersectObjects(world.scene.three.children, true);

    if (intersects.length > 0) {
      const intersect = intersects[0].object as THREE.Mesh;
      const expressID = intersect.id ?? "N/A";
      const category = (intersect as any).ifcCategory ?? "Unknown";

      tooltip.innerText = `ID: ${expressID}\nCategory: ${category}`;
      tooltip.style.left = `${event.clientX + 10}px`;
      tooltip.style.top = `${event.clientY + 10}px`;
      tooltip.style.display = "block";

      if (previousMesh && previousMaterial) {
        previousMesh.material = previousMaterial;
      }

      previousMesh = intersect;
      previousMaterial = intersect.material;

      if (!Array.isArray(intersect.material)) {
        intersect.material = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
      }
    } else {
      tooltip.style.display = "none";
      if (previousMesh && previousMaterial) {
        previousMesh.material = previousMaterial;
        previousMesh = null;
        previousMaterial = null;
      }
    }
  });

  // UI Setup
  BUI.Manager.init();

  // Exploder Panel
  const exploderPanel = BUI.Component.create<BUI.Panel>(() => {
    return BUI.html`
      <bim-panel active label="Exploder Controls" class="exploder-panel">
        <bim-panel-section collapsed label="Options">
          <bim-checkbox 
            label="Enable Exploder"
            @change="${({ target }: { target: BUI.Checkbox }) => {
        if (!exploder) return;
        exploder.set(target.checked);
      }}">
          </bim-checkbox>
        </bim-panel-section>
      </bim-panel>
    `;
  });
  document.body.append(exploderPanel);

  // Optional toggle button for the panel (for responsive/mobile views)
  const exploderToggleButton = BUI.Component.create<BUI.PanelSection>(() => {
    return BUI.html`
      <bim-button class="exploder-toggler" icon="solar:settings-bold"
        @click="${() => {
        exploderPanel.classList.toggle("options-menu-visible");
      }}">
      </bim-button>
    `;
  });
  document.body.append(exploderToggleButton);

}

main();
