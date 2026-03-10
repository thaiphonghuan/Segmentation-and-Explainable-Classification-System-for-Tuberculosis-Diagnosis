export default function HomePage() {
  return (
    <section className="page page-home">
      <div className="hero-card">
        <h1>Chào mừng đến với hệ thống đặt lịch khám</h1>
        <p>
          Bạn có thể đặt lịch khám bệnh, chọn bác sĩ, chuyên khoa và theo dõi lịch sử khám chữa bệnh một cách{' '}
          <strong>tiện lợi</strong> và <strong>nhanh chóng</strong>.
        </p>
        <ul className="feature-list">
          <li>Giao diện đơn giản, hiện đại với tông màu xanh lá - trắng</li>
          <li>Đăng ký tài khoản nhanh chóng bằng CCCD</li>
          <li>Đăng nhập, đăng xuất an toàn</li>
          <li>Phân đoạn ảnh y tế bằng AI ngay trong hệ thống</li>
        </ul>
      </div>
    </section>
  );
}

