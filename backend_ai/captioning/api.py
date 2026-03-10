"""
api.py  —  Medical image captioning API (BLIP)
--------------------------------------------
Install:
    pip install fastapi uvicorn transformers torch pillow

Run:
    uvicorn api:app --host 0.0.0.0 --port 8001 --reload

Endpoints:
    POST /caption   → JSON { caption }
    GET  /health    → {"status": "ok"}
"""

from __future__ import annotations

import io
import os
from typing import Optional

import torch
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from transformers import BlipForConditionalGeneration, BlipProcessor

MODEL_ID = os.getenv("MODEL_ID", "thaiphonghuan/BLIP-finetuned-chest-xray-v1")
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

_processor: Optional[BlipProcessor] = None
_model: Optional[BlipForConditionalGeneration] = None


def get_model():
    global _processor, _model
    if _processor is None or _model is None:
        _processor = BlipProcessor.from_pretrained(MODEL_ID)
        _model = BlipForConditionalGeneration.from_pretrained(MODEL_ID)
        _model.to(DEVICE)
        _model.eval()
        print(f"[API] BLIP model loaded: {MODEL_ID} | device={DEVICE}")
    return _processor, _model


app = FastAPI(
    title="Medical Image Captioning API",
    description="Generate captions for chest X-ray images with BLIP fine-tuned model",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def print_docs_url():
    host = os.getenv("UVICORN_HOST", "localhost")
    port = os.getenv("UVICORN_PORT", "8001")
    print(f"[API] Swagger UI: http://{host}:{port}/docs")


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_ID, "device": DEVICE}


@app.post("/caption")
async def caption(file: UploadFile = File(...)):
    try:
        img_bytes = await file.read()
        image = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot open image: {e}")

    try:
        processor, model = get_model()
        # prompt = "a chest x-ray showing"
        # inputs = processor(images=image, text=prompt, return_tensors="pt").to(DEVICE)
        inputs = processor(images=image, return_tensors="pt").to(DEVICE)

        with torch.no_grad():
            out = model.generate(
                **inputs,
                max_new_tokens=40,
                num_beams=5,
                no_repeat_ngram_size=3,
                repetition_penalty=1.2,
            )
        text = processor.decode(out[0], skip_special_tokens=True).strip()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Captioning error: {e}")

    return {"caption": text}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("api:app", host="0.0.0.0", port=8001, reload=False)
