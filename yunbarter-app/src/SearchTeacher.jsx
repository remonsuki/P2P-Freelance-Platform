import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function SearchTeacher({ isLoggedIn, balance, onDeduct, teachers }) {
  const navigate = useNavigate();

  // 1. [新增] 搜尋與分類過濾的狀態
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('全部');
  const categories = ['全部', '程式', '語言', '音樂', '綜合'];

  // 2. [新增] 過濾邏輯：產生篩選後的課程清單
  const filteredTeachers = teachers.filter((teacher) => {
    const matchKeyword = 
      teacher.skill.toLowerCase().includes(searchTerm.toLowerCase()) || 
      teacher.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategory = selectedCategory === '全部' || teacher.category === selectedCategory;
    
    return matchKeyword && matchCategory;
  });

  // 原本的預約彈出視窗狀態
  const [bookingTeacher, setBookingTeacher] = useState(null);

  const handleBookingClick = (teacher) => {
    if (!isLoggedIn) {
      alert("提示：您需要先登入帳號，才能預約課程與扣款喔！即將為您導向登入頁面。");
      navigate('/login');
      return; 
    }
    setBookingTeacher(teacher);
  };

  const confirmPayment = async () => {
    if (balance < bookingTeacher.price) {
      alert("❌ 餘額不足！請先至錢包儲值 YTC。");
      setBookingTeacher(null);
      return;
    }

    try {
      await onDeduct(bookingTeacher.price, bookingTeacher.name, bookingTeacher.skill);
      alert(`✅ 智能合約模擬執行成功！已將 ${bookingTeacher.price.toFixed(1)} YTC 扣款並鎖定，祝您學習愉快！`);
    } catch (error) {
      console.error("交易失敗:", error);
      alert("❌ 交易處理失敗，請稍後再試。");
    } finally {
      setBookingTeacher(null); 
    }
  };

  return (
    <div style={{ padding: '40px 20px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2 style={{ color: '#2c3e50', marginBottom: '30px', textAlign: 'center' }}>尋找您想學習的技能</h2>

      {/* ================= 新增：搜尋與過濾 UI 區塊 ================= */}
      <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', marginBottom: '40px' }}>
        <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
          <input 
            type="text" 
            placeholder="搜尋你想學的技能或老師名字..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ flex: 1, padding: '15px', borderRadius: '8px', border: '1px solid #ced4da', fontSize: '16px' }}
          />
        </div>
        
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {categories.map(category => (
            <button 
              key={category}
              onClick={() => setSelectedCategory(category)}
              style={{ 
                padding: '8px 20px', 
                borderRadius: '20px', 
                border: 'none', 
                cursor: 'pointer',
                fontWeight: 'bold',
                backgroundColor: selectedCategory === category ? '#3498db' : '#f0f2f5',
                color: selectedCategory === category ? 'white' : '#7f8c8d',
                transition: 'all 0.2s'
              }}
            >
              {category}
            </button>
          ))}
        </div>
      </div>
      {/* ========================================================= */}

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {/* 注意：這裡把原本的 teachers.map 換成了 filteredTeachers.map */}
        {filteredTeachers.length > 0 ? (
          filteredTeachers.map(teacher => (
            <div key={teacher.id} style={{ 
              width: '280px', backgroundColor: 'white', borderRadius: '15px', 
              boxShadow: '0 4px 15px rgba(0,0,0,0.05)', padding: '20px', 
              display: 'flex', flexDirection: 'column' 
            }}>
              <div style={{
                width: '100%', height: '140px', backgroundColor: '#f0f0f0', border: '1px dashed #ccc',
                display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '10px',
                color: '#999', fontSize: '14px', marginBottom: '15px'
              }}>
                照片 ({teacher.name})
              </div>

              <div style={{ flexGrow: 1 }}>
                <span style={{ backgroundColor: '#eafaf1', color: '#2ecc71', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                  {teacher.category}
                </span>
                <h3 style={{ margin: '10px 0', color: '#2c3e50' }}>{teacher.skill}</h3>
                <p style={{ margin: '0 0 15px 0', color: '#7f8c8d', fontSize: '14px' }}>指導者：{teacher.name}</p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #eee', paddingTop: '15px' }}>
                <div style={{ fontWeight: 'bold', color: '#2c3e50', fontSize: '18px' }}>
                  {teacher.price.toFixed(1)} <span style={{ fontSize: '14px', color: '#f39c12' }}>YTC</span>
                </div>
                <button 
                  onClick={() => handleBookingClick(teacher)}
                  style={{ 
                    backgroundColor: '#3498db', color: 'white', border: 'none', 
                    padding: '8px 16px', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer' 
                  }}
                >
                  預約付款
                </button>
              </div>
            </div>
          ))
        ) : (
          <div style={{ width: '100%', textAlign: 'center', padding: '40px', color: '#7f8c8d', fontSize: '18px', backgroundColor: 'white', borderRadius: '15px' }}>
            找不到符合條件的課程喔！試試看其他關鍵字吧!
          </div>
        )}
      </div>

      {/* 原本的：彈出式確認訂單視窗 (Modal) 完全保留 */}
      {bookingTeacher && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '35px', borderRadius: '20px', width: '90%', maxWidth: '400px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#2c3e50', fontSize: '22px' }}>確認預約訂單</h3>
            <p style={{ color: '#7f8c8d', marginBottom: '25px', lineHeight: '1.5' }}>您即將向 <strong>{bookingTeacher.name}</strong> 預約<br/>「{bookingTeacher.skill}」課程。</p>
            <div style={{ backgroundColor: '#f9f9f9', padding: '20px', borderRadius: '12px', marginBottom: '25px' }}>
              <div style={{ fontSize: '14px', color: '#95a5a6', marginBottom: '5px' }}>需支付金額 (目前餘額: {balance.toFixed(1)})</div>
              <div style={{ fontSize: '40px', fontWeight: 'bold', color: '#f39c12' }}>🪙 {bookingTeacher.price.toFixed(1)} <span style={{ fontSize: '18px' }}>YTC</span></div>
            </div>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
              <button onClick={() => setBookingTeacher(null)} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #bdc3c7', backgroundColor: 'transparent', color: '#7f8c8d', fontWeight: 'bold', cursor: 'pointer' }}>❌ 取消</button>
              <button onClick={confirmPayment} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', backgroundColor: '#f39c12', color: 'white', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px rgba(243, 156, 18, 0.2)' }}>授權扣款</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}