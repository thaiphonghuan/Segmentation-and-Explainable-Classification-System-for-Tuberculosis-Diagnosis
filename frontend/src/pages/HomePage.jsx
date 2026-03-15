export default function HomePage() {
  return (
    <section className="page page-home">
      <div className="hero-card hero-wide">
        <div className="hero-content">
          <div>
            <p className="hero-tag">Nền tảng AI cho ảnh y tế</p>
            <h1>Chẩn đoán hỗ trợ từ Segmentation, Classification & XAI</h1>
            <p>
              Tải ảnh X-ray/CT để hệ thống tự động phân đoạn vùng quan tâm, phân loại bệnh và giải thích trực quan bằng
              Grad-CAM.
            </p>
            <div className="hero-actions">
              <a className="btn btn-primary" href="/segmentation">
                Thử Segmentation
              </a>
              <a className="btn btn-outline" href="/classification">
                Thử Classification + XAI
              </a>
            </div>
          </div>
          <div className="hero-stats">
            <div className="hero-stat">
              <span>Segmentation</span>
              <strong>Mask + Overlay</strong>
            </div>
            <div className="hero-stat">
              <span>Classification</span>
              <strong>Dự đoán TB</strong>
            </div>
            <div className="hero-stat">
              <span>XAI</span>
              <strong>Grad-CAM</strong>
            </div>
          </div>
        </div>
        <div className="hero-features">
          <h3>Tính năng nổi bật</h3>
          <ul className="feature-list">
            <li>Segmentation vùng phổi và hiển thị mask trực quan.</li>
            <li>Classification bệnh lao với xác suất chi tiết.</li>
            <li>Giải thích mô hình bằng ảnh Grad-CAM dễ hiểu.</li>
            <li>Giao diện tối giản, tập trung vào hình ảnh.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

