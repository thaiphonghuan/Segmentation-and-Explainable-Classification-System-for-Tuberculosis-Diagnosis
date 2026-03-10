import { useMemo, useState } from 'react';
import { aiApi } from '../services/apiClient';

export default function CaptioningPage() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fileName = useMemo(() => selectedFile?.name || '', [selectedFile]);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setCaption('');
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedFile) {
      setError('Vui lòng chọn ảnh trước khi tạo caption.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await aiApi.captionImage(selectedFile);
      setCaption(result.caption || 'Không có caption');
    } catch (err) {
      setError(err.message || 'Không thể tạo caption.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="page page-captioning">
      <div className="caption-card">
        <div className="caption-header">
          <h2>Captioning ảnh y tế</h2>
          <p className="caption-subtitle">
            Tải ảnh X-ray để mô hình BLIP tạo mô tả tự động.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="caption-form">
          <label className="upload-area">
            <input type="file" accept="image/*" onChange={handleFileChange} />
            <div>
              <strong>{fileName || 'Chọn ảnh X-ray'}</strong>
              <p>Hỗ trợ PNG/JPG, tối đa 5MB.</p>
            </div>
          </label>

          {previewUrl && (
            <div className="caption-preview">
              <img src={previewUrl} alt="Ảnh gốc" />
            </div>
          )}

          {caption && (
            <div className="caption-result">
              <h4>Kết quả caption</h4>
              <p>{caption}</p>
            </div>
          )}

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="btn btn-primary" disabled={isLoading}>
            {isLoading ? 'Đang xử lý...' : 'Tạo caption'}
          </button>
        </form>
      </div>
    </section>
  );
}
