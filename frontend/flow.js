// ========================================
// PICKUP & DELIVERY BOARD (demo roles)
// Uses getApiBase(), escapeHtml(), ECOTRACK_OWNER_ID and
// ECOTRACK_READY_POINTS from script.js, which is loaded first.
// ========================================

"use strict";

// Demo pickup person (Ravi), created by the backend on its first start.
const BOARD_PICKUP_ID = 4;

const BOARD_STATUS_LABELS = {
    collecting: "Collecting",
    ready: "Ready for pickup",
    assigned: "Pickup accepted",
    picked_up: "Picked up",
    delivered: "Delivered",
    completed: "Completed"
};

let boardBusy = false;

function showBoardMessage(text, isError) {

    const element = document.getElementById("boardMessage");

    if (!element) return;

    element.textContent = text || "";

    element.style.color = isError ? "#b91c1c" : "#15803d";

}

async function boardRequest(method, path) {

    const base = getApiBase();

    let response;

    try {

        response = await fetch(base + path, { method: method });

    } catch (error) {

        throw new Error(
            "Cannot reach the server at " + base +
            ". Check the server address above and that the backend is running."
        );

    }

    let data = null;

    try {
        data = await response.json();
    } catch (error) {
        data = null;
    }

    if (!response.ok) {

        let detail = "Server error (" + response.status + ")";

        if (data && typeof data.detail === "string") {
            detail = data.detail;
        }

        throw new Error(detail);

    }

    return data;

}

function boardActionHtml(batch, recyclers) {

    const id = Number(batch.id);

    if (batch.status === "collecting") {

        return `<p class="batch-note">${Number(batch.total_points) || 0} / ${ECOTRACK_READY_POINTS} points. Keep scanning.</p>`;

    }

    if (batch.status === "ready") {

        return `<button type="button" class="detect-button" data-action="accept" data-id="${id}">Pickup person (Ravi): accept pickup</button>`;

    }

    if (batch.status === "assigned") {

        return `<button type="button" class="detect-button" data-action="picked-up" data-id="${id}">Pickup person: mark as picked up</button>`;

    }

    if (batch.status === "picked_up") {

        const options = recyclers.map(function (recycler) {

            const label = recycler.verified ? "verified" : "NOT verified";

            return `<option value="${Number(recycler.id)}">${escapeHtml(recycler.name)} (${label})</option>`;

        }).join("");

        return `
            <label class="batch-note" for="recycler-${id}">Deliver to recycler:</label>
            <select id="recycler-${id}" class="board-select">${options}</select>
            <button type="button" class="detect-button" data-action="deliver" data-id="${id}">Deliver</button>
            <p class="batch-note">E-waste can only go to a verified recycler.</p>
        `;

    }

    if (batch.status === "delivered") {

        return `<button type="button" class="detect-button" data-action="confirm" data-id="${id}">Recycler: confirm received</button>`;

    }

    if (batch.status === "completed") {

        return '<p class="batch-note">✅ Completed. The recycler has the material.</p>';

    }

    return "";

}

function boardCardHtml(batch, recyclers) {

    const label = BOARD_STATUS_LABELS[batch.status] || batch.status;

    const pickup = batch.pickup_id ? "pickup #" + Number(batch.pickup_id) : "no pickup yet";

    const recycler = batch.recycler_id ? "recycler #" + Number(batch.recycler_id) : "no recycler yet";

    return `
        <div class="batch-card">
            <div class="batch-head">
                <strong>Batch #${Number(batch.id)}</strong>
                <span class="status-pill status-${escapeHtml(batch.status)}">${escapeHtml(label)}</span>
            </div>
            <p class="batch-note">${Number(batch.total_points) || 0} Recovery Points · ${pickup} · ${recycler}</p>
            ${boardActionHtml(batch, recyclers)}
        </div>
    `;

}

async function loadBoard(keepMessage) {

    const list = document.getElementById("boardList");

    if (!list) return;

    if (!keepMessage) showBoardMessage("");

    try {

        const results = await Promise.all([
            boardRequest("GET", "/batches?owner_id=" + ECOTRACK_OWNER_ID),
            boardRequest("GET", "/recyclers?include_unverified=true")
        ]);

        const batches = results[0];

        const recyclers = results[1];

        if (!batches.length) {

            list.innerHTML = '<p class="batch-note">No batches yet. Scan something on the AI Detection page first.</p>';

            return;

        }

        list.innerHTML = batches.map(function (batch) {
            return boardCardHtml(batch, recyclers);
        }).join("");

    } catch (error) {

        list.innerHTML = "";

        showBoardMessage(error.message, true);

    }

}

async function handleBoardAction(button) {

    if (boardBusy) return;

    boardBusy = true;

    button.disabled = true;

    const id = Number(button.dataset.id);

    const action = button.dataset.action;

    try {

        if (action === "accept") {

            await boardRequest("POST", "/batches/" + id + "/accept?pickup_id=" + BOARD_PICKUP_ID);

        } else if (action === "picked-up") {

            await boardRequest("POST", "/batches/" + id + "/picked-up");

        } else if (action === "deliver") {

            const select = document.getElementById("recycler-" + id);

            if (!select || !select.value) throw new Error("Please choose a recycler.");

            await boardRequest("POST", "/batches/" + id + "/deliver?recycler_id=" + encodeURIComponent(select.value));

        } else if (action === "confirm") {

            await boardRequest("POST", "/batches/" + id + "/confirm");

        }

        showBoardMessage("Batch #" + id + " updated.", false);

    } catch (error) {

        showBoardMessage(error.message, true);

    } finally {

        boardBusy = false;

        await loadBoard(true);

    }

}

function initBoard() {

    const list = document.getElementById("boardList");

    if (!list) return;

    const address = document.getElementById("serverAddress");

    if (address) address.value = getApiBase();

    list.addEventListener("click", function (event) {

        const button = event.target.closest("button[data-action]");

        if (button) handleBoardAction(button);

    });

    const save = document.getElementById("saveServer");

    if (save) {

        save.addEventListener("click", function () {

            setApiBase(address.value);

            address.value = getApiBase();

            loadBoard(false);

        });

    }

    const reset = document.getElementById("resetServer");

    if (reset) {

        reset.addEventListener("click", function () {

            clearApiBase();

            address.value = getApiBase();

            loadBoard(false);

        });

    }

    const refresh = document.getElementById("refreshBoard");

    if (refresh) {

        refresh.addEventListener("click", function () {
            loadBoard(false);
        });

    }

    loadBoard(false);

}

document.addEventListener("DOMContentLoaded", initBoard);
