import { useState, useEffect } from 'react';

export default function Profile({ userName, setUserName, teachers, onDeleteTeacher, onUpdateTeacher }) {
  const [isEditing, setIsEditing] = useState(false);
  
  // 📝 編輯模式的狀態
  const [editName, setEditName] = useState(userName);
  const [editBio, setEditBio] = useState('熱愛程式與音樂，目前在鑽研網頁設計與吉他指彈。');
  const [editDept, setEditDept] = useState('尚未填寫系所');

  // 🔄 頁面載入時：去後端抓取真正的自我介紹跟系級
  useEffect(() => {
    fetch('http://localhost:5000/api/user/profile')
      .then(res => res.json())
      .then(data => {
        if (data.userName) {
          setEditName(data.userName);
          setUserName(data.userName); // 同步給總部
        }
        if (data.department) setEditDept(data.department);
        if (data.bio) setEditBio(data.bio);
      })
      .catch(err => console.error("無法獲取個人資料:", err));
  }, []);

  const myTeachers = teachers.filter(teacher => teacher.name === userName);

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      alert("名稱不可為空！");
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName: editName, department: editDept, bio: editBio })
      });

      if (response.ok) {
        setUserName(editName); 
        setIsEditing(false);
        alert("✅ 個人資料更新成功！");
      } else {
        alert("❌ 更新失敗，請檢查後端連線。");
      }
    } catch (error) {
      console.error("更新個人資料失敗:", error);
      alert("連線失敗，請稍後再試。");
    }
  };

  return (
    <div style={{ backgroundColor: '#f4f7f6', minHeight: 'calc(100vh - 70px)', padding: '40px 20px', fontFamily: 'sans-serif' }}>
      
      {/* 限制最大寬度並置中 */}
      <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* ================= 卡片一：封面與個人名片 ================= */}
        <div style={{ backgroundColor: 'white', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
          
          <div style={{ height: '140px', background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', position: 'relative' }}></div>

          <div style={{ padding: '0 30px 30px 30px', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ 
                width: '100px', height: '100px', backgroundColor: '#ecf0f1', borderRadius: '50%', 
                border: '4px solid white', marginTop: '-50px', 
                display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '40px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)', zIndex: 1, position: 'relative'
              }}>
              
              </div>

              {/* 編輯按鈕 */}
              <button 
                onClick={() => setIsEditing(true)}
                style={{ marginTop: '15px', padding: '8px 20px', borderRadius: '20px', border: '1px solid #3498db', backgroundColor: 'transparent', color: '#3498db', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                編輯名片
              </button>
            </div>

            <div style={{ marginTop: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                <h1 style={{ margin: 0, color: '#2c3e50', fontSize: '26px' }}>{userName}</h1>
                <span style={{ backgroundColor: '#2c3e50', color: '#f1c40f', padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <span>⭐</span> 認證達人
                </span>
              </div>
              
              <div style={{ display: 'flex', gap: '20px', margin: '15px 0', color: '#34495e', fontSize: '15px' }}>
                <div><strong style={{ color: '#2c3e50' }}>{myTeachers.length}</strong> 上架技能</div>
                <div><strong style={{ color: '#2c3e50' }}>5.0</strong> 平均評價</div>
                <div><strong style={{ color: '#2c3e50' }}>100%</strong> 回覆率</div>
              </div>

              <p style={{ margin: 0, color: '#7f8c8d', lineHeight: '1.6', fontSize: '15px' }}>
                “ {editBio} ”
              </p>
            </div>
          </div>
        </div>

        {/* ================= 卡片二：專業身分 ================= */}
        <div style={{ backgroundColor: 'white', padding: '25px 30px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
          <h3 style={{ margin: '0 0 20px 0', color: '#2c3e50', fontSize: '18px' }}>專業身分</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
              <div style={{ fontSize: '20px' }}></div>
              <div>
                <div style={{ fontWeight: 'bold', color: '#2c3e50', marginBottom: '4px' }}>教育經歷 / 職稱</div>
                <div style={{ color: '#7f8c8d', fontSize: '14px' }}>{editDept}</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
              <div style={{ fontSize: '20px' }}></div>
              <div>
                <div style={{ fontWeight: 'bold', color: '#2c3e50', marginBottom: '4px' }}>認證身分</div>
                <div style={{ color: '#7f8c8d', fontSize: '14px' }}>National Yunlin University of Science and Technology 學生</div>
              </div>
            </div>
          </div>
        </div>

        {/* ================= 卡片三：我上架的技能 ================= */}
        <div style={{ backgroundColor: 'white', padding: '25px 30px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '18px' }}>我的技能課程 ({myTeachers.length})</h3>
          </div>

          {myTeachers.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {myTeachers.map(teacher => (
                <div key={teacher.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <div>
                    <h4 style={{ margin: '0 0 5px 0', color: '#2c3e50', fontSize: '16px' }}>{teacher.skill}</h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ backgroundColor: '#eafaf1', color: '#2ecc71', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>{teacher.category}</span>
                      <span style={{ color: '#f39c12', fontWeight: 'bold', fontSize: '14px' }}>🪙 {teacher.price.toFixed(1)}</span>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => {
                      if(window.confirm(`確定要下架「${teacher.skill}」嗎？`)) {
                        onDeleteTeacher(teacher.id);
                      }
                    }}
                    style={{ padding: '6px 12px', backgroundColor: '#fff', color: '#e74c3c', border: '1px solid #e74c3c', borderRadius: '20px', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s' }}
                  >
                    下架
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '30px 10px', color: '#bdc3c7', fontSize: '14px' }}>
              目前還沒有上架任何技能。<br/>去「發佈技能」頁面新增一堂課吧！
            </div>
          )}
        </div>

      </div>

      {/* ================= 🌟 托特風格：編輯個人檔案 Modal ================= */}
      {isEditing && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
          
          <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '500px', borderRadius: '20px', padding: '0', boxShadow: '0 20px 50px rgba(0,0,0,0.2)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            
            {/* 標題列 (返回鍵 + 標題) */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '20px 25px', borderBottom: '1px solid #f1f5f9' }}>
              <button onClick={() => setIsEditing(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b', marginRight: '15px', padding: 0 }}>
                ←
              </button>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: 'bold' }}>編輯個人檔案</h3>
            </div>

            {/* 可滾動的表單內容區 */}
            <div style={{ padding: '25px', overflowY: 'auto' }}>
              
              {/* 更換頭像區塊 (UI 展示用) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '30px' }}>
                <div style={{ 
                  width: '70px', height: '70px', backgroundColor: '#f1f5f9', borderRadius: '50%', 
                  display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '30px',
                  position: 'relative', cursor: 'pointer', border: '1px dashed #cbd5e1'
                }}>
                  🧑‍💻
                  {/* 模擬更換照片的半透明遮罩 */}
                  <div style={{ position: 'absolute', bottom: 0, width: '100%', height: '30%', backgroundColor: 'rgba(0,0,0,0.5)', borderBottomLeftRadius: '35px', borderBottomRightRadius: '35px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <span style={{ color: 'white', fontSize: '10px' }}>更換</span>
                  </div>
                </div>
                <span style={{ color: '#64748b', fontSize: '14px' }}>點擊頭像更換照片 (建置中)</span>
              </div>

              {/* 表單欄位 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                <div>
                  <label style={{ display: 'block', fontSize: '14px', color: '#475569', fontWeight: 'bold', marginBottom: '8px' }}>名稱</label>
                  <input 
                    type="text" 
                    value={editName} 
                    onChange={e => setEditName(e.target.value)} 
                    style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: '15px', color: '#0f172a', boxSizing: 'border-box', outlineColor: '#3b82f6' }} 
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', color: '#475569', fontWeight: 'bold', marginBottom: '8px' }}>職稱 / 身份 (選填)</label>
                  <input 
                    type="text" 
                    value={editDept} 
                    onChange={e => setEditDept(e.target.value)} 
                    placeholder="例：資管系 二技" 
                    style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: '15px', color: '#0f172a', boxSizing: 'border-box', outlineColor: '#3b82f6' }} 
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', color: '#475569', fontWeight: 'bold', marginBottom: '8px' }}>自我介紹 (選填)</label>
                  <textarea 
                    value={editBio} 
                    onChange={e => setEditBio(e.target.value)} 
                    placeholder="介紹一下自己..." 
                    rows="4" 
                    style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: '15px', color: '#0f172a', boxSizing: 'border-box', resize: 'vertical', outlineColor: '#3b82f6' }} 
                  />
                </div>

              </div>
            </div>

            {/* 底部固定儲存按鈕 */}
            <div style={{ padding: '20px 25px', borderTop: '1px solid #f1f5f9', backgroundColor: 'white' }}>
              <button 
                onClick={handleSaveProfile} 
                style={{ width: '100%', padding: '14px', borderRadius: '25px', border: 'none', backgroundColor: '#1e293b', color: 'white', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', transition: 'background-color 0.2s' }}
                onMouseOver={(e) => e.target.style.backgroundColor = '#0f172a'}
                onMouseOut={(e) => e.target.style.backgroundColor = '#1e293b'}
              >
                儲存
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}