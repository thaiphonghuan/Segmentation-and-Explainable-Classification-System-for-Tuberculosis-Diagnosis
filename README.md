# IMP302M Project

Dự án gồm 3 phần chính:

- **backend_ai**: API AI cho captioning và segmentation.
- **backend_se**: Backend Node.js cho xác thực và API người dùng.
- **frontend**: Frontend React (Vite).

## Yêu cầu hệ thống

- Node.js >= 18
- Python >= 3.9

## Cấu trúc thư mục

```
imp302m_project/
  backend_ai/
    captioning/
    segmentation/
  backend_se/
  frontend/
```

## Cài đặt

### 1) Backend SE (Node.js)

```bash
cd backend_se
npm install
```

Chạy dev:

```bash
npm run dev
```

Chạy production:

```bash
npm start
```

### 2) Backend AI (Python)

**Captioning**:

```bash
cd backend_ai/captioning
pip install fastapi uvicorn transformers torch pillow
uvicorn api:app --host 0.0.0.0 --port 8001 --reload
```

**Segmentation**:

```bash
cd backend_ai/segmentation
pip install fastapi uvicorn onnxruntime pillow opencv-python numpy
uvicorn api:app --host 0.0.0.0 --port 8000 --reload
```

### 3) Frontend (Vite)

```bash
cd frontend
npm install
npm run dev
```

## Biến môi trường

- `backend_se`: tạo file `.env` theo cấu hình DB/JWT/email.
- `backend_ai`: có thể thiết lập `MODEL_ID` (captioning) hoặc `MODEL_PATH` (segmentation) nếu cần.

## API endpoints

- **Captioning**: `POST /caption`, `GET /health`
- **Segmentation**: `POST /predict`, `POST /predict/image`, `GET /health`

## Ghi chú

- File model `.pt` / `.onnx` và thư mục `node_modules` đã được ignore trong `.gitignore`.
