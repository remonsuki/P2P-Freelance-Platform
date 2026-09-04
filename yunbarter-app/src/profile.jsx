import { useState, useEffect } from 'react';
import { ArrowLeft, User, Star, GraduationCap, ShieldCheck, BookOpen, Undo2, Calendar, CircleDollarSign, AlertCircle, CalendarDays, Plus, X } from 'lucide-react';

export default function Profile({ userName, setUserName, teachers, onDeleteTeacher, onUpdateTeacher, refreshTeachers, showNotification, showConfirmation }) {
  const [isEditing, setIsEditing] = useState(false);
  
  const [editName, setEditName] = useState(userName);
  const [editBio, setEditBio] = useState('熱愛程式與音樂，目前在鑽研網頁設計與吉他指彈。');
  const [editDept, setEditDept] = useState('尚未填寫系所');
  // 新增：用來存放預覽圖片的網址
  const [avatarPreview, setAvatarPreview] = useState(null);

  // 新增：當使用者選擇圖片時觸發的函數
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // 產生一個純前端暫時的圖片預覽網址
      const imageUrl = URL.createObjectURL(file);
      setAvatarPreview(imageUrl);
    }
  };

  const [availableTimes, setAvailableTimes] = useState([]);
  const [newDate, setNewDate] = useState('');
  const [newSlot, setNewSlot] = useState('Morning');

  const [bookedCourses, setBookedCourses] = useState([
    { id: 101, teacherName: '阿弦', skill: '吉他指彈教學', price: 2.0, date: '2026-06-10', category: '音樂' },
    { id: 102, teacherName: '林克', skill: '網頁開發實戰', price: 3.5, date: '2026-06-15', category: '程式' }
  ]);

  const [refundingCourse, setRefundingCourse] = useState(null);

  useEffect(() => {
    fetch('http://localhost:5000/api/user/profile')
      .then(res => res.json())
      .then(data => {
        if (data.userName) {
          setEditName(data.userName);
          setUserName(data.userName); 
        }
        if (data.department) setEditDept(data.department);
        if (data.bio) setEditBio(data.bio);
        if (data.availableTimes) setAvailableTimes(data.availableTimes);
      })
      .catch(err => console.error("無法獲取個人資料:", err));
  }, []);

  const myTeachers = teachers.filter(teacher => teacher.name === userName);

  const handleAddSpecificTime = () => {
    if (!newDate) {
      showNotification('warning', '操作提示', '請先選擇一個日期！');
      return;
    }
    const timeKey = `${newDate}|${newSlot}`;
    if (availableTimes.includes(timeKey)) {
      showNotification('warning', '重複新增', '這個時段已經存在了');
      return;
    }
    setAvailableTimes(prev => [...prev, timeKey].sort());
  };

  const handleRemoveTime = (timeKeyToRemove) => {
    setAvailableTimes(prev => prev.filter(time => time !== timeKeyToRemove));
  };

  const formatDisplayTime = (timeKey) => {
    if (timeKey.includes('|')) {
      const [date, slot] = timeKey.split('|');
      const slotMap = { 'Morning': '早上', 'Afternoon': '下午', 'Night': '晚上' };
      return `${date} ${slotMap[slot] || slot}`;
    }
    return timeKey; 
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      showNotification('warning', '資料不完整', '名稱不可為空！');
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName: editName, department: editDept, bio: editBio, availableTimes })
      });

      if (response.ok) {
        setUserName(editName); 
        setIsEditing(false);
        refreshTeachers();
        showNotification('success', '成功', '資料更新成功！');
      } else {
        showNotification('error', '失敗', '更新失敗，請檢查後端連線。');
      }
    } catch (error) {
      showNotification('error', '連線失敗', '無法連線至後端伺服器');
    }
  };

  const handleRefundClick = (course) => setRefundingCourse(course);

  const executeRefund = () => {
    if (!refundingCourse) return;
    setBookedCourses(prev => prev.filter(c => c.id !== refundingCourse.id));
    showNotification('success', '退款成功', `已退款 ${refundingCourse.price.toFixed(1)} YTC`);
    setRefundingCourse(null);
  };

  const confirmDeleteTeacher = (teacher) => {
    showConfirmation('確認下架', `確定要下架「${teacher.skill}」嗎？`, () => onDeleteTeacher(teacher.id));
  };

  return (
    <div style={{ backgroundColor: '#f4f7f6', minHeight: 'calc(100vh - 70px)', padding: '40px 20px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* 卡片一：封面與個人名片 */}
        <div style={{ backgroundColor: 'white', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
          <div style={{ height: '140px', background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', position: 'relative' }}></div>
          <div style={{ padding: '0 30px 30px 30px', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              {/* 加上預覽邏輯與 overflow: hidden */}
              <div style={{ width: '100px', height: '100px', backgroundColor: '#f1f5f9', borderRadius: '50%', border: '4px solid white', marginTop: '-50px', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', zIndex: 1, position: 'relative', overflow: 'hidden' }}>
                {avatarPreview ? (
                  <img src={avatarPreview} alt="大頭貼" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <User size={44} color="#64748b" />
                )}
              </div>
              <button onClick={() => setIsEditing(true)} style={{ marginTop: '15px', padding: '8px 20px', borderRadius: '20px', border: '1px solid #3498db', backgroundColor: 'transparent', color: '#3498db', fontWeight: 'bold', cursor: 'pointer' }}>編輯名片</button>
            </div>
            <div style={{ marginTop: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                <h1 style={{ margin: 0, color: '#2c3e50', fontSize: '26px' }}>{userName}</h1>
                <span style={{ backgroundColor: '#0f172a', color: '#f59e0b', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}><Star size={12} fill="#f59e0b" color="#f59e0b" /> 認證達人</span>
              </div>
              <div style={{ display: 'flex', gap: '20px', margin: '15px 0', color: '#34495e', fontSize: '15px' }}>
                <div><strong style={{ color: '#2c3e50' }}>{myTeachers.length}</strong> 上架技能</div>
                <div><strong style={{ color: '#2c3e50' }}>5.0</strong> 平均評價</div>
                <div><strong style={{ color: '#2c3e50' }}>100%</strong> 回覆率</div>
              </div>
              <p style={{ margin: 0, color: '#7f8c8d', lineHeight: '1.6', fontSize: '15px', fontStyle: 'italic' }}>“ {editBio} ”</p>
            </div>
          </div>
        </div>

        {/* 卡片二：專業身分 */}
        <div style={{ backgroundColor: 'white', padding: '25px 30px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
          <h3 style={{ margin: '0 0 20px 0', color: '#2c3e50', fontSize: '18px' }}>專業身分</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
              <GraduationCap size={22} color="#64748b" />
              <div><div style={{ fontWeight: 'bold', color: '#2c3e50', fontSize: '15px' }}>教育經歷 / 職稱</div><div style={{ color: '#7f8c8d', fontSize: '14px', marginTop: '2px' }}>{editDept}</div></div>
            </div>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
              <ShieldCheck size={22} color="#64748b" />
              <div><div style={{ fontWeight: 'bold', color: '#2c3e50', fontSize: '15px' }}>帳號認證狀態</div><div style={{ color: '#7f8c8d', fontSize: '14px', marginTop: '2px' }}>National Yunlin University of Science and Technology 學生身分已核可</div></div>
            </div>
          </div>
        </div>

        {/* 卡片三：指定授課時間 */}
        <div style={{ backgroundColor: 'white', padding: '25px 30px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}><CalendarDays size={20} color="#0f172a" />我的授課時間</h3>
            
            <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ flex: '2', minWidth: '150px' }}>
                        <label style={{ display: 'block', fontSize: '13px', color: '#64748b', fontWeight: 'bold', marginBottom: '6px' }}>選擇日期</label>
                        <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ flex: '1', minWidth: '100px' }}>
                        <label style={{ display: 'block', fontSize: '13px', color: '#64748b', fontWeight: 'bold', marginBottom: '6px' }}>時段</label>
                        <select value={newSlot} onChange={(e) => setNewSlot(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                            <option value="Morning">早上</option><option value="Afternoon">下午</option><option value="Night">晚上</option>
                        </select>
                    </div>
                    <button onClick={handleAddSpecificTime} style={{ padding: '10px 16px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                        <Plus size={16} /> 新增
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', minHeight: '50px' }}>
                {availableTimes.map(timeKey => (
                    <div key={timeKey} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold' }}>
                        <Calendar size={14} />{formatDisplayTime(timeKey)}
                        <button onClick={() => handleRemoveTime(timeKey)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={14} /></button>
                    </div>
                ))}
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={handleSaveProfile} style={{ padding: '10px 24px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>儲存排班設定</button>
            </div>
        </div>

        {/* 卡片四：預約課程 */}
        <div style={{ backgroundColor: 'white', padding: '25px 30px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
          <h3 style={{ margin: '0 0 20px 0', color: '#2c3e50', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}><BookOpen size={20} color="#0f172a" />我預約的課程 ({bookedCourses.length})</h3>
          {bookedCourses.map(course => (
              <div key={course.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <div>
                    <h4 style={{ margin: '0 0 6px 0' }}>{course.skill}</h4>
                    <div style={{ display: 'flex', gap: '10px', fontSize: '13px', color: '#64748b' }}>
                        <span>{course.teacherName} 老師</span><span>{course.date}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}><CircleDollarSign size={13} /> {course.price.toFixed(1)}</span>
                    </div>
                  </div>
                  <button onClick={() => handleRefundClick(course)} style={{ padding: '8px 16px', backgroundColor: '#fff5f5', color: '#e53e3e', border: '1px solid #fed7d7', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>申請退款</button>
              </div>
          ))}
        </div>

        {/* 卡片五：我的技能 */}
        <div style={{ backgroundColor: 'white', padding: '25px 30px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '18px' }}>我的技能課程 ({myTeachers.length})</h3>
          {myTeachers.map(teacher => (
              <div key={teacher.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <span>{teacher.skill}</span>
                  <button onClick={() => confirmDeleteTeacher(teacher)} style={{ color: 'red', cursor: 'pointer', background: 'none', border: 'none' }}>下架</button>
              </div>
          ))}
        </div>
      </div>
      
      {/* 🌟 復活的 Modal 區域：退款視窗 */}
      {refundingCourse && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2500, padding: '20px', boxSizing: 'border-box' }}>
          <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '420px', borderRadius: '24px', padding: '32px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <div style={{ width: '60px', height: '60px', backgroundColor: '#fef2f2', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '20px' }}><AlertCircle size={32} color="#ef4444" strokeWidth={2} /></div>
            <h2 style={{ margin: '0 0 12px 0', fontSize: '22px', color: '#0f172a', fontWeight: 'bold' }}>確定要取消預約嗎？</h2>
            <p style={{ margin: '0 0 24px 0', color: '#64748b', fontSize: '15px', lineHeight: '1.6' }}>取消後，這堂課程將從您的預約清單中移除，並全額退回代幣至您的錢包。此動作無法復原。</p>
            <div style={{ width: '100%', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', marginBottom: '30px', textAlign: 'left' }}>
              <div style={{ fontSize: '14px', color: '#475569', fontWeight: 'bold', marginBottom: '6px' }}>{refundingCourse.skill}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: '13px', color: '#64748b' }}>{refundingCourse.teacherName} 老師</span><span style={{ fontSize: '15px', color: '#d97706', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}><CircleDollarSign size={14} /> +{refundingCourse.price.toFixed(1)} YTC</span></div>
            </div>
            <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
              <button onClick={() => setRefundingCourse(null)} style={{ flex: 1, padding: '14px', backgroundColor: 'white', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '12px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' }}>保留預約</button>
              <button onClick={executeRefund} style={{ flex: 1, padding: '14px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' }}>確認退款</button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 復活的 Modal 區域：編輯個人檔案視窗 */}
      {isEditing && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
          <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '500px', borderRadius: '20px', padding: '0', boxShadow: '0 20px 50px rgba(0,0,0,0.2)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '20px 25px', borderBottom: '1px solid #f1f5f9' }}>
              <button onClick={() => setIsEditing(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', marginRight: '15px', padding: 0, display: 'flex', alignItems: 'center' }}><ArrowLeft size={20} /></button>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: 'bold' }}>編輯個人檔案</h3>
            </div>
            <div style={{ padding: '25px', overflowY: 'auto' }}>
              {/* 🌟 升級版：支援點擊上傳與預覽的頭像區塊 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '30px' }}>
                
                {/* 隱藏的 input，用來選取檔案 */}
                <input 
                  type="file" 
                  id="avatarUpload" 
                  accept="image/*" 
                  style={{ display: 'none' }} 
                  onChange={handleImageChange} 
                />
                
                {/* 點擊這個 div 會觸發上面的隱藏 input */}
                <div 
                  onClick={() => document.getElementById('avatarUpload').click()}
                  style={{ width: '70px', height: '70px', backgroundColor: '#f1f5f9', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', cursor: 'pointer', border: '1px dashed #cbd5e1', overflow: 'hidden' }}
                >
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="預覽頭像" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <User size={32} color="#94a3b8" />
                  )}
                </div>
                
                <span style={{ color: '#64748b', fontSize: '14px' }}>點擊頭像上傳照片</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div><label style={{ display: 'block', fontSize: '14px', color: '#475569', fontWeight: 'bold', marginBottom: '8px' }}>名稱</label><input type="text" value={editName} onChange={e => setEditName(e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: '15px', color: '#0f172a', boxSizing: 'border-box' }} /></div>
                <div><label style={{ display: 'block', fontSize: '14px', color: '#475569', fontWeight: 'bold', marginBottom: '8px' }}>職稱 / 身份 (選填)</label><input type="text" value={editDept} onChange={e => setEditDept(e.target.value)} placeholder="例：資管系 二技" style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: '15px', color: '#0f172a', boxSizing: 'border-box' }} /></div>
                <div><label style={{ display: 'block', fontSize: '14px', color: '#475569', fontWeight: 'bold', marginBottom: '8px' }}>自我介紹 (選填)</label><textarea value={editBio} onChange={e => setEditBio(e.target.value)} placeholder="介紹一下自己..." rows="4" style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: '15px', color: '#0f172a', boxSizing: 'border-box', resize: 'vertical' }} /></div>
              </div>
            </div>
            <div style={{ padding: '20px 25px', borderTop: '1px solid #f1f5f9', backgroundColor: 'white' }}>
              <button onClick={handleSaveProfile} style={{ width: '100%', padding: '14px', borderRadius: '25px', border: 'none', backgroundColor: '#0f172a', color: 'white', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}>儲存</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}