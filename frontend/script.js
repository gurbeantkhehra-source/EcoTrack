// ========================================
// ecotrack - WASTE DETECTION & ECO REWARDS
// ========================================

"use strict";

// ========================================
// WASTE CATEGORIES
// ========================================

const wasteCategories = [

    {
        name: "Plastic",
        icon: "🥤",
        bin: "Blue Bin",
        points: 1,
        color: "#2196F3",
        instructions: "Clean plastic items before recycling.",
        examples: "Plastic bottles, containers, packaging"
    },

    {
        name: "Paper",
        icon: "📄",
        bin: "Blue Bin",
        points: 1,
        color: "#2196F3",
        instructions: "Keep paper dry and separate from food waste.",
        examples: "Newspapers, cardboard, notebooks"
    },

    {
        name: "Metal",
        icon: "🥫",
        bin: "Blue Bin",
        points: 10,
        color: "#607D8B",
        instructions: "Clean metal containers before recycling.",
        examples: "Aluminium cans, metal containers"
    },

    {
        name: "Glass",
        icon: "🍾",
        bin: "Glass Bin",
        points: 1,
        color: "#4CAF50",
        instructions: "Handle glass carefully and recycle separately.",
        examples: "Glass bottles, jars"
    },

    {
        name: "Organic",
        icon: "🍎",
        bin: "Green Bin",
        points: 0,
        color: "#4CAF50",
        instructions: "Put organic waste in composting bins.",
        examples: "Fruit peels, vegetable waste, food scraps"
    },

    {
        name: "E-Waste",
        icon: "🔋",
        bin: "E-Waste Collection Center",
        points: 15,
        color: "#9C27B0",
        instructions: "Submit electronic waste to an authorized collection center.",
        examples: "Batteries, chargers, cables, electronic devices"
    }

];

// ========================================
// VARIABLES
// ========================================

let selectedImage = null;
let isDetecting = false;
let cameraStream = null;

let uploadBox;
let wasteImage;
let imagePreview;
let detectButton;
let result;
let quantityInput;

// ========================================
// HISTORY
// ========================================

function getHistory() {

    try {

        const history = JSON.parse(
            localStorage.getItem("ecotrackHistory") || "[]"
        );

        return Array.isArray(history) ? history : [];

    } catch (error) {

        console.error(error);
        return [];

    }
}

// ========================================
// ECO POINTS
// ========================================

function getEcoPoints() {

    return Number(
        localStorage.getItem("ecotrackPoints")
    ) || 0;

}

function addEcoPoints(points) {

    const total = getEcoPoints() + points;

    localStorage.setItem(
        "ecotrackPoints",
        String(total)
    );

    updateEcoPoints();

}

function updateEcoPoints() {

    const element = document.getElementById("ecoPoints");

    if (element) {
        element.textContent = getEcoPoints();
    }

}

// ========================================
// IMAGE UPLOAD
// ========================================

function handleImage(file) {

    if (!file) return;

    if (!file.type.startsWith("image/")) {

        alert("Please upload a valid image!");
        return;

    }

    if (file.size > 20 * 1024 * 1024) {

        alert("Image size must be less than 20 MB!");
        return;

    }

    selectedImage = file;

    const reader = new FileReader();

    reader.onload = function (event) {

        if (imagePreview) {

            imagePreview.src = event.target.result;
            imagePreview.style.display = "block";

        }

        if (result) {
            result.innerHTML = "";
        }

        if (detectButton) {

            detectButton.disabled = false;
            detectButton.textContent = "Detect Waste →";

        }

    };

    reader.onerror = function () {

        alert("Unable to read image.");
        selectedImage = null;

    };

    reader.readAsDataURL(file);

}

// ========================================
// INITIALIZE IMAGE UPLOAD
// ========================================

function initializeUpload() {

    uploadBox = document.getElementById("uploadBox");

    wasteImage = document.getElementById("wasteImage");

    imagePreview = document.getElementById("imagePreview");

    detectButton = document.getElementById("detectButton");

    result = document.getElementById("result");

    quantityInput = document.getElementById("wasteQuantity");

    if (wasteImage) {

        wasteImage.addEventListener("change", function (event) {

            handleImage(event.target.files[0]);

            event.target.value = "";

        });

    }

    // TAKE PHOTO (opens the phone's own camera app, works on plain http)

    const cameraInput = document.getElementById("cameraInput");

    if (cameraInput) {

        cameraInput.addEventListener("change", function (event) {

            handleImage(event.target.files[0]);

            event.target.value = "";

        });

    }

    // DRAG AND DROP

    if (uploadBox) {

        uploadBox.addEventListener("dragover", function (event) {

            event.preventDefault();

            uploadBox.classList.add("drag-active");

        });

        uploadBox.addEventListener("dragleave", function () {

            uploadBox.classList.remove("drag-active");

        });

        uploadBox.addEventListener("drop", function (event) {

            event.preventDefault();

            uploadBox.classList.remove("drag-active");

            const file = event.dataTransfer.files[0];

            if (!file) return;

            handleImage(file);

            try {

                const transfer = new DataTransfer();

                transfer.items.add(file);

                wasteImage.files = transfer.files;

            } catch (error) {

                console.warn("File input could not be updated.");

            }

        });

    }

    if (detectButton) {
        detectButton.disabled = true;
    }

}

// ========================================
// BACKEND CONNECTION
// ========================================

// Every scan is saved in the backend as this demo collector (user id 1).
const ECOTRACK_OWNER_ID = 1;
// Must be the same number as READY_LIMIT in backend/app/routes.py.
const ECOTRACK_READY_POINTS = 100;

// Backend category -> card in wasteCategories
const BACKEND_TO_CARD = {
    plastic: "Plastic",
    cardboard: "Paper",
    paper: "Paper",
    metal: "Metal",
    glass: "Glass",
    ewaste: "E-Waste",
    other: "Organic"
};

// Buttons shown when the AI is not sure
const CATEGORY_CHOICES = [
    { value: "plastic", label: "Plastic" },
    { value: "cardboard", label: "Cardboard" },
    { value: "paper", label: "Paper" },
    { value: "metal", label: "Metal" },
    { value: "glass", label: "Glass" },
    { value: "ewaste", label: "E-Waste" },
    { value: "other", label: "Organic / Other" }
];

// Where the backend is. Order of preference:
// 1) window.ECOTRACK_API_BASE  2) ?api=http://IP:8000 in the page address (remembered)
// 3) the address saved on the Pickup & Delivery page  4) this page's own host, port 8000
const ECOTRACK_API_KEY = "ecotrackApiBase";

function normalizeApiBase(value) {

    let text = String(value || "").trim().replace(/\/+$/, "");

    if (!text) return "";

    if (!/^https?:\/\//i.test(text)) text = "http://" + text;

    return text;

}

function setApiBase(value) {

    try {

        const clean = normalizeApiBase(value);

        if (clean) {
            localStorage.setItem(ECOTRACK_API_KEY, clean);
        } else {
            localStorage.removeItem(ECOTRACK_API_KEY);
        }

    } catch (error) {
        console.warn("Could not save the server address.", error);
    }

}

function clearApiBase() {

    try {
        localStorage.removeItem(ECOTRACK_API_KEY);
    } catch (error) {
        console.warn("Could not clear the server address.", error);
    }

}

function getApiBase() {

    if (window.ECOTRACK_API_BASE) return window.ECOTRACK_API_BASE;

    try {

        const fromUrl = new URLSearchParams(window.location.search).get("api");

        if (fromUrl) setApiBase(fromUrl);

        const saved = localStorage.getItem(ECOTRACK_API_KEY);

        if (saved) return saved;

    } catch (error) {
        console.warn("Could not read the saved server address.", error);
    }

    const host = window.location.hostname || "127.0.0.1";

    return "http://" + host + ":8000";

}

function escapeHtml(value) {

    return String(value).replace(/[&<>"']/g, function (character) {

        return {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        }[character];

    });

}

// Shrinks big phone photos (faster upload on a hotspot) and turns
// webp/png/HEIC into a plain JPEG. If anything fails, the original is sent.
async function prepareImage(file) {

    try {

        if (!window.createImageBitmap) return file;

        const bitmap = await createImageBitmap(file);

        const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));

        if (scale === 1 && file.type === "image/jpeg") {

            if (bitmap.close) bitmap.close();

            return file;

        }

        const canvas = document.createElement("canvas");

        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));

        const context = canvas.getContext("2d");

        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

        if (bitmap.close) bitmap.close();

        const blob = await new Promise(function (resolve) {
            canvas.toBlob(resolve, "image/jpeg", 0.9);
        });

        if (!blob) return file;

        const baseName = (file.name || "photo").replace(/\.[^.]+$/, "");

        return new File([blob], baseName + ".jpg", { type: "image/jpeg" });

    } catch (error) {

        console.warn("Could not resize the image, sending the original.", error);

        return file;

    }

}

// POST /scan. Returns the backend answer or throws an Error with a readable message.
async function sendScan(quantity, category) {

    const base = getApiBase();

    const photo = await prepareImage(selectedImage);

    const form = new FormData();

    form.append("file", photo, photo.name || "photo.jpg");
    form.append("owner_id", String(ECOTRACK_OWNER_ID));
    form.append("quantity", String(quantity));

    if (category) form.append("category", category);

    const controller = new AbortController();

    const timer = setTimeout(function () {
        controller.abort();
    }, 60000);

    let response;

    try {

        response = await fetch(base + "/scan", {
            method: "POST",
            body: form,
            signal: controller.signal
        });

    } catch (error) {

        throw new Error(
            "Cannot reach the server at " + base +
            ". Check that the backend is running and this device is on the same Wi-Fi. " +
            "If the backend is on another laptop, set its address on the Pickup & Delivery page."
        );

    } finally {

        clearTimeout(timer);

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

        } else if (data && Array.isArray(data.detail) && data.detail.length) {

            detail = data.detail.map(function (item) {
                return item.msg;
            }).join("; ");

        }

        throw new Error(detail);

    }

    return data;

}

// ========================================
// DETECT WASTE
// ========================================

async function detectWaste(chosenCategory) {

    const category = typeof chosenCategory === "string" ? chosenCategory : "";

    if (!selectedImage) {

        alert("Please upload or capture a waste image first!");

        return;

    }

    if (isDetecting) return;

    const quantity = Number(
        quantityInput ? quantityInput.value : 1
    );

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) {

        alert("Enter quantity between 1 and 1000.");

        return;

    }

    isDetecting = true;

    if (detectButton) {

        detectButton.disabled = true;
        detectButton.textContent = "Analyzing...";

    }

    if (result) {

        result.innerHTML = `
            <div class="result-card">
                <h3>🔍 Analyzing Image...</h3>
                <p>Please wait while we process your image.</p>
            </div>
        `;

    }

    try {

        const data = await sendScan(quantity, category);

        if (data.needs_category) {

            showCategoryChoice(data);

        } else {

            showScanResult(data, quantity);

        }

    } catch (error) {

        console.error(error);

        showScanError(error.message);

    } finally {

        isDetecting = false;

        if (detectButton) {

            detectButton.disabled = false;
            detectButton.textContent = "Detect Waste →";

        }

    }

}

// ========================================
// SHOW RESULT
// ========================================

function showScanError(message) {

    if (!result) return;

    result.innerHTML = `
        <div class="result-card error-card">
            <h3>⚠️ Could not scan</h3>
            <p>${escapeHtml(message)}</p>
        </div>
    `;

}

// The AI was not sure: ask the user to pick the category, then scan again.
function showCategoryChoice(data) {

    if (!result) return;

    const suggested = CATEGORY_CHOICES.find(function (choice) {
        return choice.value === data.suggested_category;
    });

    const percent = Math.round((Number(data.confidence) || 0) * 100);

    const buttons = CATEGORY_CHOICES.map(function (choice) {

        return `<button type="button" class="choice-button" data-category="${choice.value}">${choice.label}</button>`;

    }).join("");

    result.innerHTML = `
        <div class="result-card">
            <h3>🤔 Not sure about this one</h3>
            <p>
                The AI is only ${percent}% sure it is
                <strong>${suggested ? suggested.label : "unknown"}</strong>.
                Please choose the correct category:
            </p>
            <div class="choice-buttons">${buttons}</div>
        </div>
    `;

    result.querySelectorAll(".choice-button").forEach(function (button) {

        button.addEventListener("click", function () {

            detectWaste(button.dataset.category);

        });

    });

}

function showScanResult(data, quantity) {

    if (!result) return;

    const cardName = BACKEND_TO_CARD[data.category] || "Organic";

    const waste = wasteCategories.find(function (item) {
        return item.name === cardName;
    }) || wasteCategories[0];

    const points = Number(data.points) || 0;

    const percent = Math.round((Number(data.confidence) || 0) * 100);

    const how = data.source === "user"
        ? "Chosen by you"
        : "AI detected (" + percent + "% sure)";

    let batchHtml;

    if (data.batch_id === null || data.batch_id === undefined) {

        batchHtml = `
            <div class="batch-box">
                <strong>Not added to a pickup batch</strong>
                <p>${escapeHtml(data.message || "This item has no recycling value.")}</p>
            </div>
        `;

    } else {

        const total = Number(data.batch_total_points) || 0;

        const fill = Math.min(100, Math.round(total / ECOTRACK_READY_POINTS * 100));

        const ready = data.batch_status === "ready";

        batchHtml = `
            <div class="batch-box">
                <strong>Pickup batch #${escapeHtml(data.batch_id)}</strong>
                <div class="batch-bar"><div class="batch-bar-fill" style="width:${fill}%"></div></div>
                <p>
                    ${total} / ${ECOTRACK_READY_POINTS} points ·
                    ${ready ? "✅ READY for pickup!" : "still collecting"}
                </p>
            </div>
        `;

    }

    const eNote = data.category === "ewaste"
        ? '<p class="demo-note">E-waste is only handed over to a verified recycler.</p>'
        : "";

    result.innerHTML = `

        <div class="result-card">

            <div class="result-top">

                <div class="result-icon">
                    ${waste.icon}
                </div>

                <div>
                    <h3>Detection Successful!</h3>
                    <p>${escapeHtml(how)}</p>
                </div>

            </div>

            <div class="result-details">

                <h2 style="color:${waste.color}">
                    ${waste.name}
                </h2>

                <p>
                    <strong>Recommended Bin:</strong>
                    ${waste.bin}
                </p>

                <p>
                    <strong>Quantity:</strong>
                    ${quantity} items
                </p>

                <p>
                    <strong>Disposal Instructions:</strong>
                    ${waste.instructions}
                </p>

            </div>

            <div class="reward-result">
                🏆 You Earned ${points} Recovery Points!
            </div>

            ${batchHtml}

            ${eNote}

            <div class="demo-note">
                Points are demo values, not money. Saved on the server as demo collector #1 (Asha).
            </div>

        </div>

    `;

    const choice = CATEGORY_CHOICES.find(function (item) {
        return item.value === data.category;
    });

    saveHistory(waste, quantity, points, choice ? choice.label : waste.name);

    addEcoPoints(points);

    updateDashboard();

}

// ========================================
// SAVE HISTORY
// ========================================

function saveHistory(waste, quantity, points, label) {

    const history = getHistory();

    const newRecord = {

        category: waste.name,
        label: label || waste.name,
        icon: waste.icon,
        bin: waste.bin,
        quantity: quantity,
        points: points,
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString()

    };

    history.unshift(newRecord);

    localStorage.setItem(
        "ecotrackHistory",
        JSON.stringify(history.slice(0, 50))
    );

}

// ========================================
// UPDATE DASHBOARD
// ========================================

function updateDashboard() {

    const history = getHistory();

    const totalWaste = document.getElementById("totalWaste");

    const totalItems = history.reduce(function (sum, item) {

        return sum + (Number(item.quantity) || 1);

    }, 0);

    if (totalWaste) {
        totalWaste.textContent = totalItems;
    }

    const categoryCounts = {

        Plastic: 0,
        Paper: 0,
        Metal: 0,
        Glass: 0,
        Organic: 0,
        "E-Waste": 0

    };

    history.forEach(function (item) {

        if (categoryCounts[item.category] !== undefined) {

            categoryCounts[item.category] +=
                Number(item.quantity) || 1;

        }

    });

    const categoryElements = {

        Plastic: "plasticCount",
        Paper: "paperCount",
        Metal: "metalCount",
        Glass: "glassCount",
        Organic: "organicCount",
        "E-Waste": "eWasteCount"

    };

    for (let category in categoryElements) {

        const element = document.getElementById(
            categoryElements[category]
        );

        if (element) {

            element.textContent = categoryCounts[category];

        }

    }

    updateEcoPoints();

    displayHistory();

}

// ========================================
// DISPLAY HISTORY
// ========================================

function displayHistory() {

    const historyList = document.getElementById("historyList");

    if (!historyList) return;

    const history = getHistory();

    if (history.length === 0) {

        historyList.innerHTML = `
            <div class="empty-history">
                <p>📋 No detection history yet.</p>
                <p>Upload an image to get started!</p>
            </div>
        `;

        return;

    }

    historyList.innerHTML = history.slice(0, 10).map(function (item) {

        return `

            <div class="history-item">

                <div>
                    <span>${escapeHtml(item.icon || "♻️")}</span>
                    <strong>${escapeHtml(item.label || item.category)}</strong>
                    <small>Quantity: ${Number(item.quantity) || 1}</small>
                </div>

                <div>
                    <strong>+${Number(item.points) || 0} Points</strong>
                    <small>${escapeHtml(item.date || "")}</small>
                    <small>${escapeHtml(item.time || "")}</small>
                </div>

            </div>

        `;

    }).join("");

}

// ========================================
// CLEAR HISTORY
// ========================================

function clearHistory() {

    const confirmed = confirm(
        "Are you sure you want to clear all history and Recovery Points?"
    );

    if (!confirmed) return;

    localStorage.removeItem("ecotrackHistory");

    localStorage.removeItem("ecotrackPoints");

    updateDashboard();

    if (result) {
        result.innerHTML = "";
    }

    alert("History and Recovery Points cleared!");

}

// ========================================
// FIND RECYCLING HUB
// ========================================

function findHub() {

    window.open(
        "https://www.google.com/maps/search/recycling+centres+near+me/",
        "_blank",
        "noopener,noreferrer"
    );

}

// ========================================
// LIVE CAMERA SCANNER
// ========================================

function initializeCamera() {

    const video = document.getElementById("cameraPreview");

    const canvas = document.getElementById("cameraCanvas");

    const cameraPhoto = document.getElementById("cameraImagePreview");

    const startBtn = document.getElementById("startCamera");

    const captureBtn = document.getElementById("captureImage");

    const stopBtn = document.getElementById("stopCamera");

    const deleteBtn = document.getElementById("deleteCapturedImage");

    const status = document.getElementById("cameraStatus");

    if (!video || !canvas || !startBtn || !captureBtn || !stopBtn || !status) {
        return;
    }

    function stopCameraStream() {

        if (cameraStream) {

            cameraStream.getTracks().forEach(function (track) {
                track.stop();
            });

            cameraStream = null;

        }

        video.srcObject = null;

        video.style.display = "none";

        startBtn.disabled = false;

        captureBtn.disabled = true;

        stopBtn.disabled = true;

    }

    // OPEN CAMERA

    startBtn.addEventListener("click", async function () {

        try {

            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {

                throw new Error("The live camera needs HTTPS or localhost. Please use the Take Photo button instead.");

            }

            status.textContent = "Opening camera...";

            cameraStream = await navigator.mediaDevices.getUserMedia({

                video: {
                    facingMode: { ideal: "environment" }
                },

                audio: false

            });

            video.srcObject = cameraStream;

            video.style.display = "block";

            await video.play();

            startBtn.disabled = true;

            captureBtn.disabled = false;

            stopBtn.disabled = false;

            status.textContent = "Camera started successfully!";

        } catch (error) {

            console.error(error);

            status.textContent = "Camera Error: " + error.message;

            stopCameraStream();

        }

    });

    // CAPTURE IMAGE

    captureBtn.addEventListener("click", function () {

        if (!cameraStream || !video.videoWidth) {

            status.textContent = "Camera is not ready!";

            return;

        }

        canvas.width = video.videoWidth;

        canvas.height = video.videoHeight;

        const context = canvas.getContext("2d");

        context.drawImage(video, 0, 0);

        canvas.toBlob(function (blob) {

            if (!blob) {

                status.textContent = "Image capture failed!";

                return;

            }

            const file = new File(
                [blob],
                "camera-image.jpg",
                { type: "image/jpeg" }
            );

            handleImage(file);

            if (cameraPhoto) {

                cameraPhoto.src = URL.createObjectURL(blob);

                cameraPhoto.style.display = "block";

            }

            if (deleteBtn) {
                deleteBtn.style.display = "inline-block";
            }

            status.textContent = "Photo captured! Now click Detect Waste.";

        }, "image/jpeg");

    });

    // DELETE CAPTURED IMAGE

    if (deleteBtn) {

        deleteBtn.addEventListener("click", function () {

            selectedImage = null;

            if (cameraPhoto) {

                cameraPhoto.removeAttribute("src");

                cameraPhoto.style.display = "none";

            }

            if (imagePreview) {

                imagePreview.removeAttribute("src");

                imagePreview.style.display = "none";

            }

            if (wasteImage) {
                wasteImage.value = "";
            }

            if (result) {
                result.innerHTML = "";
            }

            if (detectButton) {

                detectButton.disabled = true;

                detectButton.textContent = "Detect Waste →";

            }

            deleteBtn.style.display = "none";

            status.textContent = "Photo deleted. You can capture a new photo.";

        });

    }

    // STOP CAMERA

    stopBtn.addEventListener("click", function () {

        stopCameraStream();

        status.textContent = "Camera stopped.";

    });

    captureBtn.disabled = true;

    stopBtn.disabled = true;

    if (deleteBtn) {
        deleteBtn.style.display = "none";
    }

    window.addEventListener("beforeunload", stopCameraStream);

}

// ========================================
// SERVER TOTALS (dashboard)
// ========================================

async function updateServerSummary() {

    const box = document.getElementById("serverSummaryText");

    if (!box) return;

    try {

        const response = await fetch(
            getApiBase() + "/batches?owner_id=" + ECOTRACK_OWNER_ID
        );

        if (!response.ok) throw new Error("Server error (" + response.status + ")");

        const batches = await response.json();

        const counts = {};

        let points = 0;

        batches.forEach(function (batch) {

            counts[batch.status] = (counts[batch.status] || 0) + 1;

            points += Number(batch.total_points) || 0;

        });

        const parts = [
            "collecting", "ready", "assigned", "picked_up", "delivered", "completed"
        ].map(function (status) {
            return status.replace("_", " ") + ": " + (counts[status] || 0);
        });

        box.innerHTML =
            "<strong>" + batches.length + "</strong> " + (batches.length === 1 ? "batch" : "batches") + " · <strong>" +
            points + "</strong> Recovery Points in batches<br>" +
            escapeHtml(parts.join(" · "));

    } catch (error) {

        box.textContent =
            "Server not reachable (" + getApiBase() + "). The totals below still work on this device.";

    }

}

// ========================================
// MAKE FUNCTIONS AVAILABLE TO HTML
// ========================================

window.detectWaste = detectWaste;

window.clearHistory = clearHistory;

window.findHub = findHub;

// ========================================
// INITIALIZE WEBSITE
// ========================================

document.addEventListener("DOMContentLoaded", function () {

    initializeUpload();

    initializeCamera();

    updateDashboard();

    updateServerSummary();

    console.log("ecotrack Loaded Successfully!");

});