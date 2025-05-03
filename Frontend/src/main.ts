import * as THREE from "three";
import * as BUI from "@thatopen/ui";
import Stats from "stats.js/src/Stats";
import * as OBC from "@thatopen/components";
import * as WEBIFC from "web-ifc";
import * as FRAGS from "@thatopen/fragments";

async function main() {
  const container = document.getElementById("container")!;
  const components = new OBC.Components();

  // 🌎 Setup world (scene, camera, renderer)
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

  // 🔧 Scene configuration
  world.scene.setup();
  world.scene.three.background = null;

  // 🟪 Add a test cube
  const material = new THREE.MeshLambertMaterial({
    color: "#6528D7",
    transparent: true,
    opacity: 0.2,
  });
  const geometry = new THREE.BoxGeometry();
  const cube = new THREE.Mesh(geometry, material);
  world.scene.three.add(cube);

  cube.rotation.x += Math.PI / 4.2;
  cube.rotation.y += Math.PI / 4.2;
  cube.rotation.z += Math.PI / 4.2;
  cube.updateMatrixWorld();

  // 🎥 Set camera position
  world.camera.controls.setLookAt(3, 3, 3, 0, 0, 0);

  // 📊 Add FPS statistics
  const stats = new Stats();
  stats.showPanel(2);
  document.body.append(stats.dom);
  stats.dom.style.left = "0px";
  stats.dom.style.zIndex = "unset";
  world.renderer.onBeforeUpdate.add(() => stats.begin());
  world.renderer.onAfterUpdate.add(() => stats.end());

  // 🏗️ IFC Loader setup
  const fragments = components.get(OBC.FragmentsManager);
  const fragmentIfcLoader = components.get(OBC.IfcLoader);

  async function setupIFCLoader() {
    await fragmentIfcLoader.setup();

    const excludedCats = [
      WEBIFC.IFCTENDONANCHOR,
      WEBIFC.IFCREINFORCINGBAR,
      WEBIFC.IFCREINFORCINGELEMENT,
    ];
    for (const cat of excludedCats) {
      fragmentIfcLoader.settings.excludedCategories.add(cat);
    }

    fragmentIfcLoader.settings.webIfc.COORDINATE_TO_ORIGIN = true;
  }

  await setupIFCLoader();

  // 📂 IFC File Input Handling
  const fileInput = document.getElementById("ifcInput") as HTMLInputElement;
  let currentModel: THREE.Object3D | null = null;

  const modelNameDiv = document.getElementById("modelName")!;
  const objectCountDiv = document.getElementById("objectCount")!;
  const categoryListDiv = document.getElementById("categoryList")!;

  fileInput.addEventListener("change", async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    try {
      if (currentModel) {
        world.scene.three.remove(currentModel);
        fragments.dispose();
      }

      currentModel = await fragmentIfcLoader.load(buffer);
      currentModel.name = file.name;
      world.scene.three.children.pop();
      world.scene.three.add(currentModel);

      console.log("✅ IFC model loaded:", currentModel);

      modelNameDiv.textContent = `Name: ${file.name}`;
      const objectCount = currentModel.children.length;
      objectCountDiv.textContent = `Objects: ${objectCount}`;

      const categories = new Set<string>();
      currentModel.traverse((child) => {
        if ((child as any).ifcCategory) {
          categories.add((child as any).ifcCategory);
        }
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

    } catch (error) {
      console.error("❌ Failed to load IFC model:", error);
    }
  });

  // 🎹 Camera control shortcuts
  document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    const isShift = event.shiftKey;

    switch (key) {
      case "x":
        world.camera.controls.setLookAt(isShift ? -10 : 10, 0, 0, 0, 0, 0);
        break;
      case "y":
        world.camera.controls.setLookAt(0, isShift ? -10 : 10, 0, 0, 0, 0);
        break;
      case "z":
        world.camera.controls.setLookAt(0, 0, isShift ? -10 : 10, 0, 0, 0);
        break;
    }
  });

  // ✨ Custom Hover Tooltip + Color Highlight
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  const tooltip = document.createElement("div");
  tooltip.style.position = "absolute";
  tooltip.style.padding = "6px 10px";
  tooltip.style.pointerEvents = "none";
  tooltip.style.background = "#111";
  tooltip.style.color = "white";
  tooltip.style.borderRadius = "4px";
  tooltip.style.fontSize = "12px";
  tooltip.style.display = "none";
  tooltip.style.zIndex = "10";
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
  
      // Only highlight if it's a single material
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
  
}

// 🚀 Launch the app
main();
