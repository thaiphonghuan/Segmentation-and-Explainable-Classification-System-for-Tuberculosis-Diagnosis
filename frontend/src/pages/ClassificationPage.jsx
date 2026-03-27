import { useMemo, useState } from 'react';
import { aiApi } from '../services/apiClient';

const IMAGE_TILES = [
  {
    key: 'original',
    title: '1. Original X-ray',
    description: 'Ảnh X-ray ngực gốc'
  },
  {
    key: 'mask',
    title: '2. Corrected Mask',
    description: 'Mask phổi đã được tách khỏi nền'
  },
  {
    key: 'lungs',
    title: '3. CLAHE',
    description: 'Ảnh đã được áp dụng CLAHE để làm tăng độ tương phản'
  },
  {
    key: 'gradcam',
    title: '4. Grad-CAM Result',
    description: 'Kết quả Grad-CAM. Vùng màu nóng (đỏ/vàng) là nơi mô hình tập trung để dự đoán.'
  }
];

function toDataUrl(base64) {
  if (!base64) return '';
  return `data:image/png;base64,${base64}`;
}

export default function ClassificationPage() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [maskUrl, setMaskUrl] = useState('');
  const [overlayUrl, setOverlayUrl] = useState('');
  const [lungOnlyUrl, setLungOnlyUrl] = useState('');
  const [maskedGradcamUrl, setMaskedGradcamUrl] = useState('');
  
  // State lưu kết quả chẩn đoán
  const [prediction, setPrediction] = useState(null);
  
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fileName = useMemo(() => selectedFile?.name || '', [selectedFile]);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setMaskUrl('');
    setOverlayUrl('');
    setLungOnlyUrl('');
    setMaskedGradcamUrl('');
    setPrediction(null);
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedFile) {
      setError('Vui lòng chọn ảnh trước khi phân loại.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await aiApi.segmentImage(selectedFile);
      
      // Console log để kiểm tra (F12)
      console.log("Dữ liệu từ API:", result.classification);

      const nextMaskUrl = toDataUrl(result.mask_b64);
      const nextOverlayUrl = toDataUrl(result.overlay_b64);
      const nextLungOnlyUrl = toDataUrl(result.classification?.lung_only_b64);
      const nextGradcamUrl = toDataUrl(result.classification?.gradcam_b64);
      
      setMaskUrl(nextMaskUrl);
      setOverlayUrl(nextOverlayUrl);
      setLungOnlyUrl(nextLungOnlyUrl);
      setMaskedGradcamUrl(nextGradcamUrl);

      if (result.classification) {
        // KHỚP CHÍNH XÁC VỚI FILE API.PY CỦA BẠN:
        // predicted_class trả về "TB" hoặc "Normal"
        // confidence trả về giá trị xác suất (ví dụ: 0.685)
        setPrediction({
          label: result.classification.predicted_class || "",
          probability: result.classification.confidence ?? 0
        });
      }
    } catch (err) {
      setError(err.message || 'Không thể phân loại ảnh.');
    } finally {
      setIsLoading(false);
    }
  };

  const imageSources = {
    original: previewUrl,
    mask: maskUrl,
    lungs: lungOnlyUrl,
    gradcam: maskedGradcamUrl || overlayUrl
  };

  // KIỂM TRA BỆNH LAO:
  // Vì Backend trả về "TB" nên ta kiểm tra chuỗi có chứa "TB" hoặc "tuber" không
  const isTuberculosis = useMemo(() => {
    if (!prediction?.label) return false;
    const label = prediction.label.toLowerCase();
    return label.includes('tb') || label.includes('tuber');
  }, [prediction]);

  return (
    <section className="page page-classification">
      <div className="classification-card-wrapper">
        <div className="classification-page-header">
          <div>
            <p className="page-tag">Classification + XAI</p>
            <h2>Phân loại bệnh lao + Giải thích (XAI)</h2>
            <p className="classification-page-subtitle">
              Tải ảnh X-ray để AI đánh giá có dấu hiệu bệnh lao hay không và hiển thị ảnh mask, ảnh phổi đầu vào và ảnh
              Grad-CAM.
            </p>
          </div>
          <div className="segment-actions">
            <span className="hint-chip">Classification</span>
            <span className="hint-chip">Grad-CAM</span>
            <span className="hint-chip">Explainable AI</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="classification-form">
          <label className="upload-area">
            <input type="file" accept="image/*" onChange={handleFileChange} />
            <div>
              <strong>{fileName || 'Chọn ảnh X-ray'}</strong>
              <p>Hỗ trợ PNG/JPG, tối đa 5MB.</p>
            </div>
          </label>

          {/* DÒNG HIỂN THỊ KẾT QUẢ ĐÃ ĐƯỢC FIX KHỚP VỚI BACKEND */}
          {prediction && (
            <div style={{
              margin: '25px 0',
              padding: '15px',
              borderRadius: '8px',
              textAlign: 'center',
              backgroundColor: isTuberculosis ? '#fff1f0' : '#f6ffed',
              border: `1px solid ${isTuberculosis ? '#ffa39e' : '#b7eb8f'}`
            }}>
              <h3 style={{
                margin: 0,
                color: isTuberculosis ? '#cf1322' : '#389e0d',
                fontSize: '1.4rem',
                fontWeight: 'bold'
              }}>
                KẾT QUẢ: {isTuberculosis ? 'CÓ DẤU HIỆU BỆNH LAO' : 'PHỔI BÌNH THƯỜNG'}
              </h3>
              <p style={{ margin: '5px 0 0', color: '#555' }}>
                Độ tin cậy: <strong>{(prediction.probability * 100).toFixed(2)}%</strong>
              </p>
            </div>
          )}

          {previewUrl && (
            <div className="xai-image-grid">
              {IMAGE_TILES.map((tile) => (
                <div key={tile.key} className="xai-image-card">
                  <div className="image-card-header">
                    <h4>{tile.title}</h4>
                    <span className="status-chip">{tile.key.toUpperCase()}</span>
                  </div>
                  {imageSources[tile.key] ? (
                    <img
                      src={imageSources[tile.key]}
                      alt={tile.title}
                      className={tile.key === 'original' ? 'image-original' : undefined}
                    />
                  ) : (
                    <div className="empty-box">Chưa có kết quả</div>
                  )}
                  <p className="image-caption">{tile.description}</p>
                </div>
              ))}
            </div>
          )}

          {error && <p className="form-error">{error}</p>}

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={isLoading}>
              {isLoading ? 'Đang xử lý...' : 'Phân loại ảnh'}
            </button>
            <a className="btn btn-outline" href="/segmentation">
              Sang Segmentation
            </a>
          </div>
        </form>
      </div>
    </section>
  );
}