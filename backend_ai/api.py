"""
api.py  —  Lung-segmentation + TB Classification inference API
-------------------------------------------
Install:
    pip install fastapi uvicorn onnxruntime pillow opencv-python numpy torch torchvision timm

Run:
    uvicorn api:app --host 0.0.0.0 --port 8000 --reload

Endpoints:
    POST /predict          → JSON  {mask_b64, overlay_b64, stats, classification}
    POST /predict/image    → PNG overlay image (direct download)
    GET  /health           → {"status": "ok"}

Note: Pipeline aligned with Colab inference:
    - Segmentation mask inverted (1-mask) to keep lung region
    - Cropped with 15% expansion
    - Resized to 224x224 for DenseNet-121 classification
    - Binary classification (num_classes=1) with sigmoid output
"""

from __future__ import annotations

import base64
import io
import os
import time
from pathlib import Path
from typing import Optional, Tuple

import cv2
import numpy as np
import onnxruntime as ort
import torch
import timm
from torchvision import transforms
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from PIL import Image
from pydantic import BaseModel
from pytorch_grad_cam import GradCAM
from pytorch_grad_cam.utils.image import show_cam_on_image

# ─────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────
MODEL_PATH = os.getenv("MODEL_PATH", "model.onnx")
TB_MODEL_PATH = os.getenv("TB_MODEL_PATH", "tb_densenet_ultimate.pth")
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
_tb_model: Optional[torch.nn.Module] = None
_device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

def get_session() -> ort.InferenceSession:
    global _session
    if _session is None:
        if not Path(MODEL_PATH).exists():
            raise RuntimeError(f"ONNX model not found at '{MODEL_PATH}'")
        _session = load_session(MODEL_PATH)
    return _session


def load_tb_model(path: str) -> torch.nn.Module:
    """Load DenseNet-121 TB classification model using timm (aligned with training)."""
    if not Path(path).exists():
        print(f"[WARNING] TB model not found at '{path}', classification will be skipped.")
        return None
    
    try:
        # Create model with same architecture as training (binary classification, num_classes=1)
        model = timm.create_model("densenet121", pretrained=False, num_classes=1)
        # Load state dict (not full model)
        state_dict = torch.load(path, map_location=_device, weights_only=False)
        if isinstance(state_dict, dict) and 'state_dict' in state_dict:
            state_dict = state_dict['state_dict']
        model.load_state_dict(state_dict)
        model.eval()
        model.to(_device)
        print(f"[API] TB Classification model loaded: {path}  |  Device: {_device}")
        return model
    except Exception as e:
        print(f"[WARNING] Failed to load TB model: {e}, trying alternative loading method...")
        try:
            # Fallback: try loading full model
            model = torch.load(path, map_location=_device, weights_only=False)
            model.eval()
            model.to(_device)
            print(f"[API] TB Classification model loaded (full model): {path}  |  Device: {_device}")
            return model
        except Exception as e2:
            print(f"[WARNING] Failed to load TB model with both methods: {e2}, classification will be skipped.")
            return None


def get_tb_model() -> Optional[torch.nn.Module]:
    global _tb_model
    if _tb_model is None:
        _tb_model = load_tb_model(TB_MODEL_PATH)
    return _tb_model


# ─────────────────────────────────────────────
# Pre / Post processing helpers
# ─────────────────────────────────────────────
def preprocess(pil_image: Image.Image) -> Tuple[np.ndarray, Tuple[int, int]]:
    """Chuẩn bị dữ liệu cho mô hình Segmentation"""
    orig_size = pil_image.size  # (W, H)
    img = pil_image.convert("RGB").resize((INPUT_W, INPUT_H), Image.BILINEAR)
    arr = np.array(img, dtype=np.float32) / 255.0         # Chuyển về [0, 1]
    # PHẢI CÓ DÒNG NÀY: Chuẩn hóa theo ImageNet để AI nhìn rõ cấu trúc
    arr = (arr - MEAN) / STD                               
    arr = arr.transpose(2, 0, 1)[np.newaxis]               # Chuyển về NCHW
    return arr.astype(np.float32), orig_size


def postprocess(logits: np.ndarray) -> np.ndarray:
    """Chuyển kết quả AI thành ảnh Mask trắng đen"""
    # Nếu mô hình trả về nhiều hơn 1 kênh (Multi-class)
    if logits.shape[1] > 1:
        pred = np.argmax(logits[0], axis=0).astype(np.uint8)
    else:
        # Nếu là mô hình Binary (1 kênh), dùng ngưỡng 0.5
        # Lưu ý: Nếu mô hình chưa có Sigmoid ở cuối, cần bọc thêm torch.sigmoid
        mask = logits[0, 0]
        pred = (mask > 0.5).astype(np.uint8)
    return (pred * 255).astype(np.uint8)

def apply_clahe_to_pil(pil_img: Image.Image) -> Image.Image:
    img_np = np.array(pil_img.convert("RGB"))
    lab = cv2.cvtColor(img_np, cv2.COLOR_RGB2LAB)
    l, a, b = cv2.split(lab)
    # Đảm bảo đúng thông số này
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l = clahe.apply(l)
    limg = cv2.merge((l, a, b))
    final_img = cv2.cvtColor(limg, cv2.COLOR_LAB2RGB)
    return Image.fromarray(final_img)

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


def apply_mask_and_crop(image_pil: Image.Image, mask: np.ndarray, expand: float = 0.15) -> Tuple[Image.Image, np.ndarray]:
    """
    Apply mask to image and crop to lung region with expansion.
    Aligned with Colab pipeline: keep lungs only, then crop with 15% expansion.

    Args:
        image_pil: Original PIL image
        mask: Binary mask (0/1 or 0/255)
        expand: Expansion ratio for cropping (default 0.15 = 15%)

    Returns:
        (cropped_image, cropped_mask)
    """
    # Normalize mask to 0/1
    mask_bin = (mask > 127).astype(np.uint8) if mask.max() > 1 else mask.astype(np.uint8)

    # Heuristic: nếu vùng trắng chiếm đa số, khả năng trắng là nền -> đảo lại để phổi = 1
    if mask_bin.mean() > 0.5:
        mask_bin = 1 - mask_bin

    img_np = np.array(image_pil.convert("RGB"))
    mask_3c = np.stack([mask_bin] * 3, axis=-1)
    masked_img_np = img_np * mask_3c  # Chỉ giữ lại pixel bên trong phổi
    masked_image_pil = Image.fromarray(masked_img_np)

    # Find bounding box of lung region
    coords = np.column_stack(np.where(mask_bin > 0))
    if len(coords) == 0:
        return masked_image_pil, mask_bin

    y_min, x_min = coords.min(axis=0)
    y_max, x_max = coords.max(axis=0)
    h, w = mask_bin.shape

    # Expand bounding box by expand ratio
    dx, dy = int((x_max - x_min) * expand), int((y_max - y_min) * expand)
    x_min, x_max = max(0, x_min - dx), min(w, x_max + dx)
    y_min, y_max = max(0, y_min - dy), min(h, y_max + dy)

    # Crop image and mask
    cropped_img = masked_image_pil.crop((x_min, y_min, x_max, y_max))
    cropped_mask = mask_bin[y_min:y_max, x_min:x_max]

    return cropped_img, cropped_mask


def _build_gradcam(tb_model: torch.nn.Module, input_tensor: torch.Tensor) -> Optional[np.ndarray]:
    """Return a Grad-CAM heatmap (H x W, float in [0,1]) or None on failure."""
    try:
        target_layer = tb_model.features.denseblock4
        cam = GradCAM(model=tb_model, target_layers=[target_layer])
        grayscale_cam = cam(input_tensor=input_tensor, aug_smooth=True, eigen_smooth=True)[0]
        return grayscale_cam
    except Exception as e:
        print(f"[WARNING] Grad-CAM failed: {e}")
        return None


def run_tb_classification(pil_img: Image.Image, mask_255: np.ndarray) -> dict:
    """
    Run TB classification on masked, cropped and CLAHE-enhanced lung region.
    HOÀN TOÀN ĐỒNG BỘ VỚI PIPELINE ULTIMATE TRÊN KAGGLE.
    """
    tb_model = get_tb_model()
    if tb_model is None:
        return None

    try:
        # Resize mask về kích thước ảnh gốc để crop chính xác
        mask_resized = cv2.resize(mask_255, (pil_img.width, pil_img.height), interpolation=cv2.INTER_NEAREST)

        # 1. Áp dụng Mask và Crop (15% expansion)
        cropped_img, _ = apply_mask_and_crop(pil_img, mask_resized, expand=0.15)

        # 2. Áp dụng CLAHE (Bắt buộc để giống lúc train Ultimate)
        enhanced_img = apply_clahe_to_pil(cropped_img)

        # 3. Transform pipeline (Resize 224x224 và Chuẩn hóa ImageNet)
        transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])

        # Preprocess input cho mô hình
        t0 = time.perf_counter()
        # AI sẽ nhìn thấy ảnh đã qua CLAHE
        input_tensor = transform(enhanced_img).unsqueeze(0).to(_device)

        with torch.no_grad():
            output = tb_model(input_tensor)

            # Xử lý format đầu ra của timm
            if isinstance(output, (list, tuple)):
                logits = output[0]
            else:
                logits = output

            # Tính xác suất bằng Sigmoid (Binary Classification)
            prob = torch.sigmoid(logits).item()
            tb_prob = float(prob)
            normal_prob = 1.0 - tb_prob
            predicted_class = "TB" if tb_prob > 0.5 else "Normal"

            latency = (time.perf_counter() - t0) * 1000  # ms

        # 4. CHUẨN BỊ ẢNH HIỂN THỊ CHO FRONTEND (XAI)
        gradcam_b64 = None
        lung_only_b64 = None
        
        try:
            # Tạo ảnh 224x224 sạch để làm nền cho Grad-CAM
            enhanced_resized = enhanced_img.resize((224, 224))
            img_np_float = np.array(enhanced_resized).astype(np.float32) / 255.0

            # Tạo heatmap Grad-CAM
            grayscale_cam = _build_gradcam(tb_model, input_tensor)
            if grayscale_cam is not None:
                # Chồng heatmap lên ảnh đã CLAHE
                cam_image = show_cam_on_image(img_np_float, grayscale_cam, use_rgb=True, image_weight=0.6)
                gradcam_b64 = pil_to_b64(Image.fromarray(cam_image))

            # ẢNH THỨ 3 (Only Lungs) gửi về Web là ảnh đã CLAHE và Resize
            lung_only_b64 = pil_to_b64(enhanced_resized)
            
        except Exception as e:
            print(f"[WARNING] XAI Generation Error: {e}")

        # Trả về kết quả khớp với Frontend đang chờ
        return {
            "predicted_class": predicted_class,
            "tb_probability": round(tb_prob, 4),
            "normal_probability": round(normal_prob, 4),
            "confidence": round(max(tb_prob, normal_prob), 4),
            "latency_ms": round(latency, 2),
            "lung_only_b64": lung_only_b64,
            "gradcam_b64": gradcam_b64,
        }
        
    except Exception as e:
        import traceback
        print(f"[ERROR] TB classification failed: {e}")
        print(traceback.format_exc())
        return None


def run_inference(pil_img: Image.Image) -> dict:
    sess    = get_session()
    tensor, orig_size = preprocess(pil_img)

    t0      = time.perf_counter()
    logits  = sess.run(["logits"], {"image": tensor})[0]   # (1, n_cls, H, W)
    seg_latency = (time.perf_counter() - t0) * 1000            # ms

    mask_255  = postprocess(logits)                         # (H, W) 0/255
    overlay   = build_heatmap_overlay(pil_img, mask_255)

    # Stats
    total_px     = mask_255.size
    positive_px  = int((mask_255 > 0).sum())
    ratio        = positive_px / total_px

    # Resize mask back to original size for output
    ow, oh = orig_size
    mask_orig = cv2.resize(mask_255, (ow, oh), interpolation=cv2.INTER_NEAREST)

    # Run TB classification on masked lung region
    classification_result = run_tb_classification(pil_img, mask_255)

    return {
        "mask_pil":    Image.fromarray(mask_orig),
        "overlay_pil": overlay,
        "stats": {
            "latency_ms":          round(seg_latency, 2),
            "original_size":       {"width": ow, "height": oh},
            "total_pixels":        total_px,
            "predicted_positive":  positive_px,
            "segmentation_ratio":  round(ratio, 4),
        },
        "classification": classification_result,
    }


# ─────────────────────────────────────────────
# FastAPI app
# ─────────────────────────────────────────────
app = FastAPI(
    title="Lung Segmentation + TB Classification API",
    description="DeepLabV3+ lung segmentation with TB classification (DenseNet-121) via ONNX Runtime & PyTorch",
    version="2.0.0",
)

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
    classification: Optional[dict] = None  # TB classification results


@app.get("/health")
def health():
    tb_model_status = "loaded" if get_tb_model() is not None else "not found"
    return {
        "status": "ok",
        "segmentation_model": MODEL_PATH,
        "classification_model": TB_MODEL_PATH,
        "classification_status": tb_model_status,
    }


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
        classification = result.get("classification"),
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