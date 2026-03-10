import { useMemo, useState } from 'react';
import { aiApi } from '../services/apiClient';

export default function SegmentationPage() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [resultOverlay, setResultOverlay] = useState('');
  const [resultMask, setResultMask] = useState('');
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fileName = useMemo(() => selectedFile?.name || '', [selectedFile]);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setResultOverlay('');
    setResultMask('');
    setStats(null);
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedFile) {
      setError('Vui lòng chọn ảnh trước khi phân đoạn.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await aiApi.segmentImage(selectedFile);
      setResultOverlay(result.overlay_b64 ? `data:image/png;base64,${result.overlay_b64}` : '');
      setResultMask(result.mask_b64 ? `data:image/png;base64,${result.mask_b64}` : '');
      setStats(result.stats || null);
    } catch (err) {
      setError(err.message || 'Không thể phân đoạn ảnh.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="page page-segmentation">
      <div className="segment-card">
        <div className="segment-header">
          <h2>Phân đoạn ảnh y tế</h2>
          <p className="segment-subtitle">
            Tải lên ảnh y tế (X-ray/CT) để hệ thống AI thực hiện segmentation và trả về mặt nạ cùng ảnh overlay.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="segment-form">
          <label className="upload-area">
            <input type="file" accept="image/*" onChange={handleFileChange} />
            <div>
              <strong>{fileName || 'Chọn ảnh y tế'}</strong>
              <p>Hỗ trợ PNG/JPG, tối đa 5MB.</p>
            </div>
          </label>

          {previewUrl && (
            <div className="preview-grid">
              <div>
                <h4>Ảnh gốc</h4>
                <img src={previewUrl} alt="Ảnh gốc" />
              </div>
              <div>
                <h4>Overlay</h4>
                {resultOverlay ? <img src={resultOverlay} alt="Overlay" /> : <div className="empty-box">Chưa có kết quả</div>}
              </div>
              <div>
                <h4>Mask</h4>
                {resultMask ? <img src={resultMask} alt="Mask" /> : <div className="empty-box">Chưa có kết quả</div>}
              </div>
            </div>
          )}

          {stats && (
            <div className="segment-stats">
              <h4>Thông tin phân đoạn</h4>
              <div className="stats-grid">
                <div>
                  <span>Latency</span>
                  <strong>{stats.latency_ms} ms</strong>
                </div>
                <div>
                  <span>Kích thước</span>
                  <strong>
                    {stats.original_size?.width} × {stats.original_size?.height}
                  </strong>
                </div>
                <div>
                  <span>Tỉ lệ segmentation</span>
                  <strong>{stats.segmentation_ratio}</strong>
                </div>
              </div>
            </div>
          )}

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="btn btn-primary" disabled={isLoading}>
            {isLoading ? 'Đang xử lý...' : 'Phân đoạn ảnh'}
          </button>
        </form>
      </div>
    </section>
  );
}
