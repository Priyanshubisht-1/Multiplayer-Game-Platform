const hostModules = import.meta.glob("./games/**/*Host.js");

let activeHostModule = null;

export async function loadHostModule(game, scene) {
  const path = `./games/${game}/${game}Host.js`;
  const loader = hostModules[path];

  if (!loader) {
    throw new Error(`No host module found for game: ${game}`);
  }

  const module = await loader();

  if (!module || typeof module.createHostRenderer !== "function") {
    throw new Error(`Invalid host module for game: ${game}`);
  }

  if (typeof module.preload === "function") {
    module.preload(scene);
    await new Promise((resolve) => {
      scene.load.once("complete", resolve);
      scene.load.start();
    });
  }

  activeHostModule = module.createHostRenderer(scene);
  return activeHostModule;
}

export function getActiveHostModule() {
  return activeHostModule;
}

export function clearActiveHostModule() {
  if (activeHostModule && typeof activeHostModule.destroy === "function") {
    activeHostModule.destroy();
  }

  activeHostModule = null;
}
