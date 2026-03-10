"""
api.py  —  Lung-segmentation inference API
-------------------------------------------
Install:
    pip install fastapi uvicorn onnxruntime pillow opencv-python numpy

Run:
    uvicorn api:app --host 0.0.0.0 --port 8000 --reload

Endpoints:
    POST /predict          → JSON  {mask_b64, overlay_b64, stats}
    POST /predict/image    → PNG overlay image (direct download)
    GET  /health           → {"status": "ok"}
"""

from __future__ import annotations

import base64
import io
import os
import time
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
import onnxruntime as ort
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from PIL import Image
from pydantic import BaseModel

# ─────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────
MODEL_PATH = os.getenv("MODEL_PATH", "model.onnx")
INPUT_H    = int(os.getenv("INPUT_H", 256))
INPUT_W    = int(os.getenv("INPUT_W", 256))
MEAN       = np.array([0.485, 0.456, 0.406], dtype=np.float32)
STD        = np.array([0.229, 0.224, 0.225], dtype=np.float32)

# ─────────────────────────────────────────────
# ONNX Session (singleton)
# ─────────────────────────────────────────────
def load_session(path: str) -> ort.InferenceSession:
    providers = (
        ["CUDAExecutionProvider", "CPUExecutionProvider"]
        if ort.get_device() == "GPU"
        else ["CPUExecutionProvider"]
    )
    sess = ort.InferenceSession(path, providers=providers)
    print(f"[API] Model loaded: {path}  |  Provider: {sess.get_providers()[0]}")
    return sess

_session: Optional[ort.InferenceSession] = None

def get_session() -> ort.InferenceSession:
    global _session
    if _session is None:
        if not Path(MODEL_PATH).exists():
            raise RuntimeError(f"ONNX model not found at '{MODEL_PATH}'")
        _session = load_session(MODEL_PATH)
    return _session


# ─────────────────────────────────────────────
# Pre / Post processing helpers
# ─────────────────────────────────────────────
def preprocess(pil_image: Image.Image) -> tuple[np.ndarray, tuple[int, int]]:
    """Resize → normalise → NCHW float32.  Returns (tensor, original_size)."""
    orig_size = pil_image.size  # (W, H)
    img = pil_image.convert("RGB").resize((INPUT_W, INPUT_H), Image.BILINEAR)
    arr = np.array(img, dtype=np.float32) / 255.0         # (H, W, 3)
    arr = (arr - MEAN) / STD                               # normalise
    arr = arr.transpose(2, 0, 1)[np.newaxis]               # (1, 3, H, W)
    return arr.astype(np.float32), orig_size


def postprocess(logits: np.ndarray) -> np.ndarray:
    """logits (1, n_cls, H, W) → binary mask (H, W) uint8  0/255."""
    pred = np.argmax(logits[0], axis=0).astype(np.uint8)   # (H, W)  0 or 1
    return (pred * 255).astype(np.uint8)


def build_heatmap_overlay(
    original: Image.Image,
    mask_255: np.ndarray,
    colormap: int = cv2.COLORMAP_JET,
    alpha: float = 0.45,
) -> Image.Image:
    """
    Overlay a coloured heatmap of the predicted mask on the original image.

    Args:
        original   : original PIL image (any size)
        mask_255   : binary mask 0/255  (H×W, same size as model output)
        colormap   : OpenCV colormap constant
        alpha      : transparency of the overlay (0 = no overlay, 1 = full)

    Returns:
        PIL RGBA overlay image (resized back to original dimensions)
    """
    orig_w, orig_h = original.size

    # Resize mask back to original dimensions
    mask_resized = cv2.resize(mask_255, (orig_w, orig_h), interpolation=cv2.INTER_NEAREST)

    # Apply colourmap to mask
    heatmap_bgr = cv2.applyColorMap(mask_resized, colormap)          # (H, W, 3) BGR
    heatmap_rgb = cv2.cvtColor(heatmap_bgr, cv2.COLOR_BGR2RGB)       # → RGB

    # Blend with original
    bg = np.array(original.convert("RGB"), dtype=np.float32)
    fg = heatmap_rgb.astype(np.float32)

    # Only blend where mask is non-zero (actual prediction)
    blend_mask = (mask_resized > 0).astype(np.float32)[..., np.newaxis]
    blended = bg * (1 - alpha * blend_mask) + fg * (alpha * blend_mask)
    blended = blended.clip(0, 255).astype(np.uint8)

    # Draw contour around predicted region
    contours, _ = cv2.findContours(mask_resized, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(blended, contours, -1, (0, 255, 0), 2)

    return Image.fromarray(blended)


def pil_to_b64(img: Image.Image, fmt: str = "PNG") -> str:
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return base64.b64encode(buf.getvalue()).decode()


def run_inference(pil_img: Image.Image) -> dict:
    sess    = get_session()
    tensor, orig_size = preprocess(pil_img)

    t0      = time.perf_counter()
    logits  = sess.run(["logits"], {"image": tensor})[0]   # (1, n_cls, H, W)
    latency = (time.perf_counter() - t0) * 1000            # ms

    mask_255  = postprocess(logits)                         # (H, W) 0/255
    overlay   = build_heatmap_overlay(pil_img, mask_255)

    # Stats
    total_px     = mask_255.size
    positive_px  = int((mask_255 > 0).sum())
    ratio        = positive_px / total_px

    # Resize mask back to original size for output
    ow, oh = orig_size
    mask_orig = cv2.resize(mask_255, (ow, oh), interpolation=cv2.INTER_NEAREST)

    return {
        "mask_pil":    Image.fromarray(mask_orig),
        "overlay_pil": overlay,
        "stats": {
            "latency_ms":          round(latency, 2),
            "original_size":       {"width": ow, "height": oh},
            "total_pixels":        total_px,
            "predicted_positive":  positive_px,
            "segmentation_ratio":  round(ratio, 4),
        },
    }


# ─────────────────────────────────────────────
# FastAPI app
# ─────────────────────────────────────────────
app = FastAPI(
    title="Lung Segmentation API",
    description="DeepLabV3+ lung segmentation with heatmap overlay via ONNX Runtime",
    version="1.0.0",
)


@app.on_event("startup")
def print_docs_url():
    host = os.getenv("UVICORN_HOST", "localhost")
    port = os.getenv("UVICORN_PORT", "8000")
    print(f"[API] Swagger UI: http://{host}:{port}/docs")
    print(f"[API] Predict image: http://{host}:{port}/docs#/default/predict_image_predict_image_post")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class PredictResponse(BaseModel):
    mask_b64:    str   # base64-encoded PNG of the binary mask
    overlay_b64: str   # base64-encoded PNG of heatmap overlay
    stats:       dict


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_PATH}


@app.post("/predict", response_model=PredictResponse, summary="Predict + return base64 images")
async def predict(
    file: UploadFile = File(..., description="Chest X-ray PNG/JPEG image"),
):
    try:
        img_bytes = await file.read()
        pil_img   = Image.open(io.BytesIO(img_bytes))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot open image: {e}")

    try:
        result = run_inference(pil_img)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference error: {e}")

    return PredictResponse(
        mask_b64    = pil_to_b64(result["mask_pil"]),
        overlay_b64 = pil_to_b64(result["overlay_pil"]),
        stats       = result["stats"],
    )


@app.post(
    "/predict/image",
    responses={200: {"content": {"image/png": {}}}},
    summary="Predict + return overlay PNG directly",
)
async def predict_image(
    file: UploadFile = File(...),
    output: str = Query("overlay", enum=["overlay", "mask"],
                        description="Return overlay heatmap or raw mask"),
):
    try:
        img_bytes = await file.read()
        pil_img   = Image.open(io.BytesIO(img_bytes))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot open image: {e}")

    try:
        result = run_inference(pil_img)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference error: {e}")

    chosen = result["overlay_pil"] if output == "overlay" else result["mask_pil"]
    buf = io.BytesIO()
    chosen.save(buf, format="PNG")
    buf.seek(0)

    return StreamingResponse(buf, media_type="image/png")


# ─────────────────────────────────────────────
# Entry-point
# ─────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=False)


"""
uvicorn api:app --host 0.0.0.0 --port 8000
"""