const CLASS_DETAILS = {
  "$1": {
    name: "One Dollar Bill",
    image: "assets/dollar-denominations/one-dollar.svg",
    description: "The one dollar bill is the smallest common U.S. paper denomination and is usually recognized by the large number 1 and green note design.",
    features: [
      "Look for the large $1 denomination.",
      "Often has a mostly green and gray appearance.",
      "Smaller printed numeral compared with higher bills.",
      "Use the denomination markings, not just color, for the best match."
    ]
  },
  "$2": {
    name: "Two Dollar Bill",
    image: "assets/dollar-denominations/two-dollar.svg",
    description: "The two dollar bill is less common than many other notes, so the model should focus on the printed $2 denomination.",
    features: [
      "Look for the large $2 denomination.",
      "May be confused with $1 in quick photos because both are lower denominations.",
      "Frame the corners and center markings clearly.",
      "Avoid glare across the printed number."
    ]
  },
  "$5": {
    name: "Five Dollar Bill",
    image: "assets/dollar-denominations/five-dollar.svg",
    description: "The five dollar bill can be identified by the $5 denomination and its cooler gray-purple look compared with other notes.",
    features: [
      "Look for the large $5 denomination.",
      "Often appears cooler gray or purple in tone.",
      "Capture at least one corner number clearly.",
      "Flatten the bill so folded edges do not hide the denomination."
    ]
  },
  "$10": {
    name: "Ten Dollar Bill",
    image: "assets/dollar-denominations/ten-dollar.svg",
    description: "The ten dollar bill is commonly recognized by the $10 denomination and its warmer orange-yellow color family.",
    features: [
      "Look for the large $10 denomination.",
      "Often has a warmer orange or yellow tone.",
      "Make sure both digits in 10 are visible.",
      "Avoid motion blur when photographing the bill."
    ]
  },
  "$20": {
    name: "Twenty Dollar Bill",
    image: "assets/dollar-denominations/twenty-dollar.svg",
    description: "The twenty dollar bill is a common U.S. note usually identified by the $20 denomination and green-toned design.",
    features: [
      "Look for the large $20 denomination.",
      "Usually has green tones with modern note details.",
      "Capture the corner numbers and center area clearly.",
      "Check that the model is reading 20, not just a green bill."
    ]
  },
  "$100": {
    name: "One Hundred Dollar Bill",
    image: "assets/dollar-denominations/hundred-dollar.svg",
    description: "The one hundred dollar bill is the highest denomination in this model and is commonly recognized by the large $100 markings.",
    features: [
      "Look for the large $100 denomination.",
      "Often has blue security-strip coloring in real examples.",
      "Make sure all three digits are visible.",
      "Use a clear, flat photo so the model can separate it from $10 and $20."
    ]
  }
};

const DEFAULT_MODEL_URL = "assets/dollar-model/";
const UNKNOWN_CONFIDENCE_THRESHOLD = 0.7;
const MODEL_STORAGE_KEY = "tm-dollar-identify-model-url";

const state = {
  activeSource: "webcam",
  model: null,
  webcamStream: null,
  isPredicting: false,
  lastObjectUrl: null
};

const els = {
  webcamTab: document.querySelector("#webcam-tab"),
  uploadTab: document.querySelector("#upload-tab"),
  webcamPanel: document.querySelector("#webcam-panel"),
  uploadPanel: document.querySelector("#upload-panel"),
  webcamVideo: document.querySelector("#webcam-video"),
  webcamPlaceholder: document.querySelector("#webcam-placeholder"),
  uploadPreview: document.querySelector("#upload-preview"),
  imageUpload: document.querySelector("#image-upload"),
  startCamera: document.querySelector("#start-camera"),
  classifyButton: document.querySelector("#classify-button"),
  modelUrl: document.querySelector("#model-url"),
  loadModel: document.querySelector("#load-model"),
  modelStatus: document.querySelector("#model-status"),
  confidenceFill: document.querySelector("#confidence-fill"),
  confidenceWord: document.querySelector("#confidence-word"),
  confidenceValue: document.querySelector("#confidence-value"),
  resultConfidence: document.querySelector("#result-confidence"),
  className: document.querySelector("#class-name"),
  classDescription: document.querySelector("#class-description"),
  classImage: document.querySelector("#class-image"),
  featureList: document.querySelector("#feature-list"),
  modelToggle: document.querySelector("#model-toggle"),
  modelContent: document.querySelector("#model-content"),
  resetButton: document.querySelector("#reset-button"),
  helpButton: document.querySelector("#help-button"),
  helpDialog: document.querySelector("#help-dialog")
};

function normalizeModelUrls(input) {
  const raw = input.trim();
  if (!raw) {
    throw new Error("Paste a Teachable Machine model URL first.");
  }

  const modelUrl = new URL(raw, window.location.href);
  if (modelUrl.pathname.endsWith("/model.json")) {
    return {
      modelURL: modelUrl.toString(),
      metadataURL: modelUrl.toString().replace(/model\.json$/, "metadata.json")
    };
  }

  const base = modelUrl.toString().endsWith("/") ? modelUrl.toString() : `${modelUrl.toString()}/`;
  return {
    modelURL: `${base}model.json`,
    metadataURL: `${base}metadata.json`
  };
}

function setStatus(message, tone = "neutral") {
  els.modelStatus.textContent = message;
  els.modelStatus.dataset.tone = tone;
}

function setActiveSource(source) {
  state.activeSource = source;
  const webcamActive = source === "webcam";

  els.webcamTab.classList.toggle("is-active", webcamActive);
  els.webcamTab.setAttribute("aria-selected", String(webcamActive));
  els.uploadTab.classList.toggle("is-active", !webcamActive);
  els.uploadTab.setAttribute("aria-selected", String(!webcamActive));

  els.webcamPanel.classList.toggle("is-active", webcamActive);
  els.webcamPanel.hidden = !webcamActive;
  els.uploadPanel.classList.toggle("is-active", !webcamActive);
  els.uploadPanel.hidden = webcamActive;
  refreshClassifyState();
}

function hasReadyInput() {
  if (state.activeSource === "webcam") {
    return Boolean(state.webcamStream && els.webcamVideo.readyState >= 2);
  }

  return els.uploadPreview.classList.contains("has-media");
}

function refreshClassifyState() {
  els.classifyButton.disabled = !state.model || !hasReadyInput() || state.isPredicting;
}

function getConfidenceWord(probability) {
  if (probability >= 0.9) return "Very strong match";
  if (probability >= UNKNOWN_CONFIDENCE_THRESHOLD) return "Strong match";
  if (probability >= 0.5) return "Possible match";
  return "Low confidence";
}

function fallbackImage(label) {
  const safeLabel = label || "Prediction";
  const initials = safeLabel
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("") || "?";

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 620">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#e8f5f2"/>
          <stop offset="1" stop-color="#fff2d9"/>
        </linearGradient>
      </defs>
      <rect width="900" height="620" fill="url(#bg)"/>
      <circle cx="210" cy="172" r="88" fill="#0f8b7f" opacity=".16"/>
      <circle cx="690" cy="460" r="130" fill="#d8942e" opacity=".16"/>
      <rect x="230" y="150" width="440" height="320" rx="28" fill="#fffaf0" stroke="#d9d6cb" stroke-width="4"/>
      <text x="450" y="300" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="118" font-weight="800" fill="#0f8b7f">${initials}</text>
      <text x="450" y="375" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="700" fill="#1f2726">${escapeXml(safeLabel)}</text>
    </svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function getClassDetails(label) {
  return CLASS_DETAILS[label] || {
    image: "",
    description: "No custom class details are defined yet. Add this label to CLASS_DETAILS in dollar-identify.js.",
    features: [
      `Detected model label: ${label}`,
      "Add a representative image URL for this class.",
      "Add the defining features students should compare."
    ]
  };
}

function renderFeatures(features) {
  els.featureList.replaceChildren();
  features.forEach((feature) => {
    const item = document.createElement("li");
    item.textContent = feature;
    els.featureList.append(item);
  });
}

function renderPrediction(prediction) {
  const confidence = Math.round(prediction.probability * 100);
  const isUnknown = prediction.probability < UNKNOWN_CONFIDENCE_THRESHOLD;
  const details = isUnknown
    ? {
        image: "",
        description: `The top model match was ${prediction.className}, but its confidence is below 70%. Try a clearer image or better lighting.`,
        features: [
          `Top model label: ${prediction.className}`,
          `Confidence level: ${confidence}%`,
          "Prediction is below the 70% confidence threshold."
        ]
      }
    : getClassDetails(prediction.className);
  const displayName = isUnknown ? "Unknown" : details.name || prediction.className;
  const imageSrc = details.image || fallbackImage(displayName);

  els.className.textContent = displayName;
  els.classDescription.textContent = details.description || "Add a description for this class in the class details config.";
  els.classImage.src = imageSrc;
  els.classImage.alt = `${displayName} representative image`;
  renderFeatures(details.features?.length ? details.features : ["Add features for this class in CLASS_DETAILS."]);

  els.confidenceFill.style.width = `${confidence}%`;
  els.confidenceWord.textContent = getConfidenceWord(prediction.probability);
  els.confidenceValue.textContent = `${confidence}%`;
  els.resultConfidence.textContent = `${confidence}%`;

  if (window.matchMedia("(max-width: 940px)").matches) {
    document.querySelector(".result-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function resetPrediction() {
  els.className.textContent = "Loading Dollar Identify model";
  els.classDescription.textContent = "The app will show the strongest dollar denomination prediction and recognition tips to compare.";
  els.classImage.src = fallbackImage("Prediction");
  els.classImage.alt = "Representative prediction placeholder";
  renderFeatures(["Load the Dollar Identify model.", "Start the camera or choose a bill photo.", "Classify to see the top result only."]);
  els.confidenceFill.style.width = "0%";
  els.confidenceWord.textContent = "Waiting for a prediction";
  els.confidenceValue.textContent = "0%";
  els.resultConfidence.textContent = "0%";
}

async function loadModel() {
  try {
    if (!window.tmImage) {
      throw new Error("Teachable Machine scripts are still loading. Try again in a moment.");
    }

    const { modelURL, metadataURL } = normalizeModelUrls(els.modelUrl.value);
    els.loadModel.disabled = true;
    setStatus("Loading model...", "neutral");
    state.model = await window.tmImage.load(modelURL, metadataURL);
    localStorage.setItem(MODEL_STORAGE_KEY, els.modelUrl.value.trim());
    setStatus(`Model loaded with ${state.model.getTotalClasses()} classes.`, "success");
    refreshClassifyState();
  } catch (error) {
    state.model = null;
    setStatus(error.message, "error");
    refreshClassifyState();
  } finally {
    els.loadModel.disabled = false;
  }
}

async function startCamera() {
  try {
    if (state.webcamStream) {
      state.webcamStream.getTracks().forEach((track) => track.stop());
    }

    state.webcamStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false
    });
    els.webcamVideo.srcObject = state.webcamStream;
    els.webcamVideo.classList.add("has-media");
    els.webcamPlaceholder.hidden = true;
    await els.webcamVideo.play();
    setActiveSource("webcam");
    refreshClassifyState();
  } catch (error) {
    setStatus(`Camera unavailable: ${error.message}`, "error");
  }
}

function handleUpload(event) {
  const [file] = event.target.files;
  if (!file) return;

  if (state.lastObjectUrl) {
    URL.revokeObjectURL(state.lastObjectUrl);
  }

  state.lastObjectUrl = URL.createObjectURL(file);
  els.uploadPreview.src = state.lastObjectUrl;
  els.uploadPreview.onload = () => {
    els.uploadPreview.classList.add("has-media");
    setActiveSource("upload");
    refreshClassifyState();
  };
}

function currentInputElement() {
  return state.activeSource === "webcam" ? els.webcamVideo : els.uploadPreview;
}

async function classify() {
  if (!state.model || !hasReadyInput()) return;

  try {
    state.isPredicting = true;
    refreshClassifyState();
    const predictions = await state.model.predict(currentInputElement(), false);
    const [topPrediction] = predictions.sort((a, b) => b.probability - a.probability);
    renderPrediction(topPrediction);
  } catch (error) {
    setStatus(`Prediction failed: ${error.message}`, "error");
  } finally {
    state.isPredicting = false;
    refreshClassifyState();
  }
}

function toggleModelPanel() {
  const expanded = els.modelToggle.getAttribute("aria-expanded") === "true";
  els.modelToggle.setAttribute("aria-expanded", String(!expanded));
  els.modelContent.hidden = expanded;
}

function resetApp() {
  resetPrediction();
  els.imageUpload.value = "";
  els.uploadPreview.removeAttribute("src");
  els.uploadPreview.classList.remove("has-media");
  if (state.lastObjectUrl) {
    URL.revokeObjectURL(state.lastObjectUrl);
    state.lastObjectUrl = null;
  }
  refreshClassifyState();
}

function init() {
  els.modelUrl.value = localStorage.getItem(MODEL_STORAGE_KEY) || DEFAULT_MODEL_URL;

  resetPrediction();

  els.webcamTab.addEventListener("click", () => setActiveSource("webcam"));
  els.uploadTab.addEventListener("click", () => setActiveSource("upload"));
  els.startCamera.addEventListener("click", startCamera);
  els.imageUpload.addEventListener("change", handleUpload);
  els.loadModel.addEventListener("click", loadModel);
  els.classifyButton.addEventListener("click", classify);
  els.modelToggle.addEventListener("click", toggleModelPanel);
  els.resetButton.addEventListener("click", resetApp);
  els.helpButton.addEventListener("click", () => els.helpDialog.showModal());
  els.webcamVideo.addEventListener("loadeddata", refreshClassifyState);

  loadModel();
}

init();
