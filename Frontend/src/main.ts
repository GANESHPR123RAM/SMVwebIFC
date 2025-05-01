import * as THREE from "three";
import * as BUI from "@thatopen/ui";
import Stats from "stats.js/src/Stats";
import * as OBC from "@thatopen/components";
import * as WEBIFC from "web-ifc"; // ➡️ For IFC categories

async function main() {
  const container = document.getElementById("container")!;
  const components = new OBC.Components();

  // 🌎 Setting up the world
  const worlds = components.get(OBC.Worlds);
  const world = worlds.create<
    OBC.SimpleScene,
    OBC.SimpleCamera,
    OBC.SimpleRenderer
  >();

  // 🎬 Starting the Scene
  world.scene = new OBC.SimpleScene(components);
  world.renderer = new OBC.SimpleRenderer(components, container);
  world.camera = new OBC.SimpleCamera(components);

  await components.init(); // ✅ now inside async main()

  // 🏗️ Setup scene
  world.scene.setup();
  world.scene.three.background = null;

  // 📦 Adding cube
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

  // 🎥 Add camera
  world.camera.controls.setLookAt(3, 3, 3, 0, 0, 0);

  // 📊 Add Statistics
  const stats = new Stats();
  stats.showPanel(2);
  document.body.append(stats.dom);
  stats.dom.style.left = "0px";
  stats.dom.style.zIndex = "unset";
  world.renderer.onBeforeUpdate.add(() => stats.begin());
  world.renderer.onAfterUpdate.add(() => stats.end());

  // 🏗️ IFC Loader Setup
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

  // 🆕 Get UI elements for showing info
  const modelNameDiv = document.getElementById("modelName")!;
  const objectCountDiv = document.getElementById("objectCount")!;
  const categoryListDiv = document.getElementById("categoryList")!;

  fileInput.addEventListener("change", async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    try {
      // Remove previous model if exists
      if (currentModel) {
        world.scene.three.remove(currentModel);
        fragments.dispose();
      }

      // Load new model
      currentModel = await fragmentIfcLoader.load(buffer);
      currentModel.name = file.name;
      world.scene.three.add(currentModel);

      console.log("✅ IFC model loaded:", currentModel);

      // 🆕 Update Information Panel
      modelNameDiv.textContent = `Name: ${file.name}`;
      const objectCount = currentModel.children.length;
      objectCountDiv.textContent = `Objects: ${objectCount}`;

      // 🆕 Get unique IFC Categories in model
      const categories = new Set<string>();
      currentModel.traverse((child) => {
        if ((child as any).ifcCategory) {
          categories.add((child as any).ifcCategory);
        }
      });

      // Clear and Add to category list
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

  // 🎹 Keyboard Controls for Camera Movement
  document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    const isShift = event.shiftKey;

    switch (key) {
      case "x":
        if (isShift) {
          world.camera.controls.setLookAt(-10, 0, 0, 0, 0, 0);
        } else {
          world.camera.controls.setLookAt(10, 0, 0, 0, 0, 0);
        }
        break;
      case "y":
        if (isShift) {
          world.camera.controls.setLookAt(0, -10, 0, 0, 0, 0);
        } else {
          world.camera.controls.setLookAt(0, 10, 0, 0, 0, 0);
        }
        break;
      case "z":
        if (isShift) {
          world.camera.controls.setLookAt(0, 0, -10, 0, 0, 0);
        } else {
          world.camera.controls.setLookAt(0, 0, 10, 0, 0, 0);
        }
        break;
    }
  });
}

// 🚀 Start the app
main();
