import { useState, useEffect } from 'react';
import { ArrowLeft, User, Star, GraduationCap, ShieldCheck, BookOpen, Undo2, Calendar, CircleDollarSign, AlertCircle, CalendarDays, Plus, X } from 'lucide-react';

// 🌟 接收 showNotification 和 showConfirmation 作為 Props
export default function Profile({ userName, setUserName, teachers, onDeleteTeacher, onUpdateTeacher, refreshTeachers, showNotification, showConfirmation }) {
  const [isEditing, setIsEditing] = useState(false);
  
  const [editName, setEditName] = useState(userName);
  const [editBio, setEditBio] = useState('熱愛程式與音樂，目前在鑽研網頁設計與吉他指彈。');
  const [editDept, setEditDept] = useState('尚未填寫系所');

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

  // 🌟 日期排班邏輯
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
        
        {/* 卡片一：封面與個人名片 (保留原樣) */}
        <div style={{ backgroundColor: 'white', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
          <div style={{ height: '140px', background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', position: 'relative' }}></div>
          <div style={{ padding: '0 30px 30px 30px', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ width: '100px', height: '100px', backgroundColor: '#f1f5f9', borderRadius: '50%', border: '4px solid white', marginTop: '-50px', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', zIndex: 1, position: 'relative' }}>
                <User size={44} color="#64748b" />
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

        {/* 卡片二：專業身分 (保留原樣) */}
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

        {/* 🌟 卡片三：指定授課時間 (已改成日期選擇器，排版優化) */}
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

        {/* 卡片四：預約課程 (保留原樣) */}
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

        {/* 卡片五：我的技能 (保留原樣) */}
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
      
      {/* 編輯名片與退款 Modal 保留原樣 */}
      {/* ... (其餘 Modal 程式碼相同) ... */}
    </div>
  );
}