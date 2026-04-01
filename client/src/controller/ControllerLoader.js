const controllerModules = import.meta.glob("./games/**/*Controller.js")

export async function mountControllerByGame(game) {
   const path = `./games/${game}/${game}Controller.js`;
    const loader = controllerModules[path]

    if (!loader) {
        console.error("[ControllerLoader] No controller module for:", game)
        console.log("[ControllerLoader] Available modules:", Object.keys(controllerModules))
        renderUnsupportedController(game)
        return
    }

    const module = await loader()

    if (!module || typeof module.mountController !== "function") {
        console.error("[ControllerLoader] Invalid controller module:", path)
        renderUnsupportedController(game)
        return
    }

    module.mountController()
}

function renderUnsupportedController(game) {
    const app = document.getElementById("app")
    if (!app) return

    app.innerHTML = `
        <div style="padding:20px">
            <h2>Unsupported controller</h2>
            <p>No controller found for: ${game}</p>
        </div>
    `
}