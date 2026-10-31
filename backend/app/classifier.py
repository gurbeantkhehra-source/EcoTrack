def classify_image(image_bytes: bytes) -> dict:
    return {"category": "ewaste", "confidence": 0.9}
import io

import torch
from PIL import Image
from transformers import CLIPModel, CLIPProcessor

MODEL_NAME = "openai/clip-vit-base-patch32"
model = CLIPModel.from_pretrained(MODEL_NAME)
processor = CLIPProcessor.from_pretrained(MODEL_NAME)
model.eval()

LABELS = {
    "plastic": "a photo of a plastic bottle or plastic waste",
    "cardboard": "a photo of cardboard",
    "paper": "a photo of paper",
    "metal": "a photo of a metal can or metal waste",
    "glass": "a photo of a glass bottle or glass jar",
        "ewaste": "a photo of electronic waste such as a circuit board, charger, cable, phone, battery, keyboard or mouse",
    "other": "a photo of food waste or organic waste",
}
CATEGORIES = list(LABELS.keys())
TEXTS = list(LABELS.values())


def classify_image(image_bytes: bytes) -> dict:
    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception:
        raise ValueError("Not a valid image")

    inputs = processor(text=TEXTS, images=image, return_tensors="pt", padding=True)
    with torch.no_grad():
        outputs = model(**inputs)
    probs = outputs.logits_per_image.softmax(dim=1)[0]
    best = int(probs.argmax())
    return {"category": CATEGORIES[best], "confidence": round(float(probs[best]), 3)}