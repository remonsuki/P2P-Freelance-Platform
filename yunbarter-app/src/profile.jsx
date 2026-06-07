import { useState, useEffect } from 'react';
import { ArrowLeft, User, Star, GraduationCap, ShieldCheck, BookOpen, Undo2, Calendar, CircleDollarSign, AlertCircle, CalendarDays } from 'lucide-react';

// 🌟 接收來自 App.jsx 的 refreshTeachers 函數
export default function Profile({ userName, setUserName, teachers, onDeleteTeacher, onUpdateTeacher, refreshTeachers }) {
  const [isEditing, setIsEditing] = useState(false);
  
  const [editName, setEditName] = useState(userName);
  const [editBio, setEditBio] = useState('熱愛程式與音樂，目前在鑽研網頁設計與吉他指彈。');
  const [editDept, setEditDept] = useState('尚未填寫系所');

  const [availableTimes, setAvailableTimes] = useState([]);

  const [bookedCourses, setBookedCourses] = useState([
    { id: 101, teacherName: '阿弦', skill: '吉他指彈教學', price: 2.0, date: '2026-06-10', category: '音樂' },
    { id: 102, teacherName: '林克', skill: '網頁開發實戰', price: 3.5, date: '2026-06-15', category: '程式' }
  ]);

  const [refundingCourse, setRefundingCourse] = useState(null);

  const WEEK_DAYS = [
    { id: 'Mon', label: '星期一' }, { id: 'Tue', label: '星期二' },
    { id: 'Wed', label: '星期三' }, { id: 'Thu', label: '星期四' },
    { id: 'Fri', label: '星期五' }, { id: 'Sat', label: '星期六' },
    { id: 'Sun', label: '星期日' }
  ];
  
  const TIME_SLOTS = [
    { id: 'Morning', label: '早上' }, { id: 'Afternoon', label: '下午' }, { id: 'Night', label: '晚上' }
  ];

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

  const toggleTimeSlot = (dayId, slotId) => {
    const timeKey = `${dayId}-${slotId}`;
    setAvailableTimes(prev => 
      prev.includes(timeKey) ? prev.filter(t => t !== timeKey) : [...prev, timeKey]
    );
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      alert("名稱不可為空！");
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
        refreshTeachers(); // 🌟 核心：儲存成功後，立刻通知系統去後端抓最新的課表！
        alert("✅ 資料更新成功！您的授課時間也已同步到所有課程。");
      } else {
        alert("❌ 更新失敗，請檢查後端連線。");
      }
    } catch (error) {
      console.error("更新資料失敗:", error);
      alert("連線失敗，請稍後再試。");
    }
  };

  const handleRefundClick = (course) => setRefundingCourse(course);

  const executeRefund = () => {
    if (!refundingCourse) return;
    setBookedCourses(prev => prev.filter(c => c.id !== refundingCourse.id));
    alert(`✅ 退款成功！已將 🪙 ${refundingCourse.price.toFixed(1)} YTC 退回您的錢包。`);
    setRefundingCourse(null);
  };

  return (
    <div style={{ backgroundColor: '#f4f7f6', minHeight: 'calc(100vh - 70px)', padding: '40px 20px', fontFamily: 'sans-serif' }}>
      
      <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* 卡片一：封面與個人名片 */}
        <div style={{ backgroundColor: 'white', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
          <div style={{ height: '140px', background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', position: 'relative' }}></div>
          <div style={{ padding: '0 30px 30px 30px', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ width: '100px', height: '100px', backgroundColor: '#f1f5f9', borderRadius: '50%', border: '4px solid white', marginTop: '-50px', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', zIndex: 1, position: 'relative' }}>
                <User size={44} color="#64748b" />
              </div>
              <button onClick={() => setIsEditing(true)} style={{ marginTop: '15px', padding: '8px 20px', borderRadius: '20px', border: '1px solid #3498db', backgroundColor: 'transparent', color: '#3498db', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}>編輯名片</button>
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

        {/* 🌟 卡片三：每週授課時間設定 */}
        <div style={{ backgroundColor: 'white', padding: '25px 30px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}><CalendarDays size={20} color="#0f172a" />我的授課時間</h3>
            <span style={{ fontSize: '13px', color: '#94a3b8' }}>點擊切換有空時段</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {WEEK_DAYS.map(day => (
              <div key={day.id} style={{ display: 'flex', alignItems: 'center', gap: '15px', paddingBottom: '12px', borderBottom: '1px solid #f8fafc' }}>
                <div style={{ width: '60px', fontWeight: 'bold', color: '#475569', fontSize: '14px' }}>{day.label}</div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {TIME_SLOTS.map(slot => {
                    const timeKey = `${day.id}-${slot.id}`;
                    const isSelected = availableTimes.includes(timeKey);
                    return (
                      <button key={slot.id} onClick={() => toggleTimeSlot(day.id, slot.id)} style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s', border: isSelected ? '1px solid #3498db' : '1px solid #e2e8f0', backgroundColor: isSelected ? '#eff6ff' : 'white', color: isSelected ? '#3498db' : '#94a3b8' }}>{slot.label}</button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleSaveProfile} style={{ padding: '10px 24px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', transition: 'background-color 0.2s', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>儲存時間設定</button>
          </div>
        </div>

        {/* 卡片四：我預約的課程 */}
        <div style={{ backgroundColor: 'white', padding: '25px 30px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
          <h3 style={{ margin: '0 0 20px 0', color: '#2c3e50', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}><BookOpen size={20} color="#0f172a" />我預約的課程 ({bookedCourses.length})</h3>
          {bookedCourses.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {bookedCourses.map(course => (
                <div key={course.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <div>
                    <h4 style={{ margin: '0 0 6px 0', color: '#2c3e50', fontSize: '16px' }}>{course.skill}</h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', color: '#64748b', fontSize: '13px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><User size={14} /> {course.teacherName} 老師</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={14} /> {course.date}</span>
                      <span style={{ color: '#d97706', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '2px' }}><CircleDollarSign size={14} /> {course.price.toFixed(1)}</span>
                    </div>
                  </div>
                  <button onClick={() => handleRefundClick(course)} style={{ padding: '8px 16px', backgroundColor: '#fff5f5', color: '#e53e3e', border: '1px solid #fed7d7', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><Undo2 size={13} /> 申請退款</button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '30px 10px', color: '#slate-400', fontSize: '14px', lineHeight: '1.6' }}>目前沒有任何預約中的課程。<br/>前往「尋找課程」解鎖新技能吧！</div>
          )}
        </div>

        {/* 卡片五：我上架的技能 */}
        <div style={{ backgroundColor: 'white', padding: '25px 30px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
          <h3 style={{ margin: '0 0 20px 0', color: '#2c3e50', fontSize: '18px' }}>我的技能課程 ({myTeachers.length})</h3>
          {myTeachers.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {myTeachers.map(teacher => (
                <div key={teacher.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <div>
                    <h4 style={{ margin: '0 0 5px 0', color: '#2c3e50', fontSize: '16px' }}>{teacher.skill}</h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>{teacher.category}</span>
                      <span style={{ color: '#d97706', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '2px' }}><CircleDollarSign size={14} /> {teacher.price.toFixed(1)}</span>
                    </div>
                  </div>
                  <button onClick={() => { if(window.confirm(`確定要下架「${teacher.skill}」嗎？`)) onDeleteTeacher(teacher.id); }} style={{ padding: '6px 14px', backgroundColor: '#fff', color: '#e74c3c', border: '1px solid #e74c3c', borderRadius: '20px', fontSize: '13px', cursor: 'pointer' }}>下架</button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '30px 10px', color: '#bdc3c7', fontSize: '14px' }}>目前還沒有上架任何技能。</div>
          )}
        </div>
      </div>

      {/* 專屬退款確認 Modal */}
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

      {/* 編輯個人檔案 Modal */}
      {isEditing && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
          <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '500px', borderRadius: '20px', padding: '0', boxShadow: '0 20px 50px rgba(0,0,0,0.2)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '20px 25px', borderBottom: '1px solid #f1f5f9' }}>
              <button onClick={() => setIsEditing(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', marginRight: '15px', padding: 0, display: 'flex', alignItems: 'center' }}><ArrowLeft size={20} /></button>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: 'bold' }}>編輯個人檔案</h3>
            </div>
            <div style={{ padding: '25px', overflowY: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '30px' }}>
                <div style={{ width: '70px', height: '70px', backgroundColor: '#f1f5f9', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', cursor: 'pointer', border: '1px dashed #cbd5e1' }}><User size={32} color="#94a3b8" /></div>
                <span style={{ color: '#64748b', fontSize: '14px' }}>點擊頭像更換照片 (建置中)</span>
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