import socket from "../../core/socket.js"
import EVENTS from "../../shared/events.js"

export function mountController() {
    const app = document.getElementById("app")
    if (!app) return

    app.innerHTML = `
        <div style="padding:20px; touch-action: none;">
            <h2>Tag Controller</h2>

            <div style="display:flex; flex-direction:column; gap:10px; width:220px;">
                <button id="btn-up">Up</button>

                <div style="display:flex; gap:10px;">
                    <button id="btn-left">Left</button>
                    <button id="btn-right">Right</button>
                </div>

                <button id="btn-down">Down</button>
            </div>
        </div>
    `

    bindDirectionalButton("btn-up", "up")
    bindDirectionalButton("btn-left", "left")
    bindDirectionalButton("btn-right", "right")
    bindDirectionalButton("btn-down", "down")
}

function emitMove(direction, pressed) {
    socket.emit(EVENTS.INPUT.MOVE, {
        direction,
        pressed
    })
}
function bindDirectionalButton(elementId, direction) {
    const btn = document.getElementById(elementId)
    if (!btn) return

    let activePointerId = null

    const onPress = (e) => {
        // Ignore if another pointer is already driving this button
        if (activePointerId !== null) return

        e.preventDefault()

        activePointerId = e.pointerId
        btn.setPointerCapture(e.pointerId)

        emitMove(direction, true)
    }

    const onRelease = (e) => {
        if (activePointerId !== e.pointerId) return

        e.preventDefault()

        emitMove(direction, false)

        btn.releasePointerCapture(e.pointerId)
        activePointerId = null
    }

    btn.addEventListener("pointerdown", onPress)
    btn.addEventListener("pointerup", onRelease)
    btn.addEventListener("pointercancel", onRelease)
    // lostpointercapture fires when capture is lost for any reason — reliable safety net
    btn.addEventListener("lostpointercapture", onRelease)
}

// Stop movement only when the window fully loses focus (tab switch, phone lock, etc.)
window.addEventListener("blur", stopAllMovement)

function stopAllMovement() {
    ["left", "right", "up", "down"].forEach(dir => {
        emitMove(dir, false)
    })
}