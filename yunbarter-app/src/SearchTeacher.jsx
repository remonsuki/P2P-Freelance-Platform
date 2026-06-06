import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Code, Music, Languages, Sparkles, User, X, Clock, Calendar, Star, ShieldCheck } from 'lucide-react';

export default function SearchTeacher({ isLoggedIn, balance, onDeduct, teachers }) {
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [sortBy, setSortBy] = useState('new'); 
  const [selectedTeacher, setSelectedTeacher] = useState(null);

  // 🌟 新增：翻譯字典，將代碼 (Mon-Night) 轉為漂亮的中文
  const timeTranslation = {
    'Mon': '星期一', 'Tue': '星期二', 'Wed': '星期三', 'Thu': '星期四', 'Fri': '星期五', 'Sat': '星期六', 'Sun': '星期日',
    'Morning': '早上', 'Afternoon': '下午', 'Night': '晚上'
  };

  const availableCategories = useMemo(() => {
    const categories = teachers.map(t => t.category);
    return [...new Set(categories)]; 
  }, [teachers]);

  const handleCategoryToggle = (category) => {
    setSelectedCategories(prev => 
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    );
  };

  const filteredAndSortedTeachers = useMemo(() => {
    let result = [...teachers];
    if (searchTerm.trim() !== '') {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(t => 
        t.name.toLowerCase().includes(lowerSearch) || t.skill.toLowerCase().includes(lowerSearch)
      );
    }
    if (selectedCategories.length > 0) {
      result = result.filter(t => selectedCategories.includes(t.category));
    }
    switch (sortBy) {
      case 'priceAsc': result.sort((a, b) => a.price - b.price); break;
      case 'priceDesc': result.sort((a, b) => b.price - a.price); break;
      default: result.sort((a, b) => b.id - a.id); break;
    }
    return result;
  }, [teachers, searchTerm, selectedCategories, sortBy]);

  const openBookingModal = (teacher) => {
    if (!isLoggedIn) {
      alert("🔒 請先登入才能預約課程喔！");
      navigate('/login', { state: { from: '/search' } });
      return;
    }
    setSelectedTeacher(teacher);
  };

  const confirmBooking = () => {
    if (balance >= selectedTeacher.price) {
      onDeduct(selectedTeacher.price, selectedTeacher.name, selectedTeacher.skill);
      alert(`✅ 預約成功！已經幫您聯絡 ${selectedTeacher.name} 老師。`);
      setSelectedTeacher(null);
    } else {
      alert("❌ 餘額不足！請先至錢包儲值。");
      setSelectedTeacher(null);
      navigate('/wallet');
    }
  };

  // 🌟 輔助函式：解析並翻譯時間字串 (例如 Mon-Night -> 星期一 晚上)
  const formatTimeSlot = (timeKey) => {
    const [day, slot] = timeKey.split('-');
    return `${timeTranslation[day]} ${timeTranslation[slot]}`;
  };

  const getGradientForCategory = (category) => {
    switch(category) {
      case '程式': return 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)';
      case '音樂': return 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)';
      case '語言': return 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)';
      default: return 'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)'; 
    }
  };

  const getIconForCategory = (category) => {
    switch(category) {
      case '程式': return <Code size={48} color="white" strokeWidth={1.5} />;
      case '音樂': return <Music size={48} color="white" strokeWidth={1.5} />;
      case '語言': return <Languages size={48} color="white" strokeWidth={1.5} />;
      default: return <Sparkles size={48} color="white" strokeWidth={1.5} />; 
    }
  };

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: 'calc(100vh - 70px)', padding: '40px 20px', fontFamily: 'sans-serif', position: 'relative' }}>
      
      <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', gap: '30px', alignItems: 'flex-start' }}>
        
        {/* 左側 Sidebar */}
        <div style={{ width: '250px', backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', position: 'sticky', top: '100px', flexShrink: 0 }}>
          <h3 style={{ margin: '0 0 20px 0', color: '#0f172a', fontSize: '18px' }}>課程篩選</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <h4 style={{ margin: '0 0 5px 0', color: '#64748b', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>技能類別</h4>
            {availableCategories.map(cat => (
              <label key={cat} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: '#334155', fontSize: '15px' }}>
                <input type="checkbox" checked={selectedCategories.includes(cat)} onChange={() => handleCategoryToggle(cat)} style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#3498db' }} />
                {cat}
              </label>
            ))}
          </div>
        </div>

        {/* 右側內容區 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
            <div style={{ position: 'relative', width: '300px' }}>
              <span style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}><Search size={18} color="#94a3b8" strokeWidth={2} /></span>
              <input type="text" placeholder="搜尋老師或技能..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ width: '100%', padding: '12px 15px 12px 45px', borderRadius: '30px', border: '1px solid #e2e8f0', backgroundColor: 'white', boxSizing: 'border-box', fontSize: '15px', outlineColor: '#3498db' }} />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              {['new', 'priceAsc', 'priceDesc'].map(type => (
                <button key={type} onClick={() => setSortBy(type)} style={{ padding: '8px 16px', borderRadius: '20px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', border: sortBy === type ? 'none' : '1px solid #e2e8f0', backgroundColor: sortBy === type ? '#0f172a' : 'white', color: sortBy === type ? 'white' : '#64748b' }}>
                  {sortBy === type && '✓ '}{type === 'new' ? '最新上架' : type === 'priceAsc' ? '價格：低到高' : '價格：高到低'}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '25px', marginTop: '10px' }}>
            {filteredAndSortedTeachers.map(teacher => (
              <div key={teacher.id} style={{ backgroundColor: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.04)', transition: 'transform 0.2s', cursor: 'pointer', display: 'flex', flexDirection: 'column' }} onMouseOver={e => e.currentTarget.style.transform = 'translateY(-5px)'} onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}>
                <div style={{ height: '160px', background: getGradientForCategory(teacher.category), display: 'flex', justifyContent: 'center', alignItems: 'center' }}>{getIconForCategory(teacher.category)}</div>
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <span style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold' }}>{teacher.category}</span>
                    <span style={{ color: '#d97706', fontWeight: '900', fontSize: '18px' }}>🪙 {teacher.price.toFixed(1)}</span>
                  </div>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#0f172a', flexGrow: 1 }}>{teacher.skill}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>
                    <div style={{ width: '22px', height: '22px', backgroundColor: '#f1f5f9', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}><User size={14} color="#64748b" /></div>
                    {teacher.name}
                  </div>
                  <button onClick={() => openBookingModal(teacher)} style={{ width: '100%', padding: '12px', backgroundColor: 'transparent', color: '#0f172a', border: '2px solid #0f172a', borderRadius: '8px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' }}>預約課程</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ================= 高級結帳 Modal ================= */}
      {selectedTeacher && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000, padding: '20px', boxSizing: 'border-box' }}>
          <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '850px', borderRadius: '24px', overflow: 'hidden', display: 'flex', flexDirection: 'row', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', position: 'relative' }}>
            
            <button onClick={() => setSelectedTeacher(null)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'white', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', zIndex: 10 }}><X size={20} color="#64748b" /></button>

            <div style={{ flex: '1', minWidth: '300px', background: getGradientForCategory(selectedTeacher.category), display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px' }}>
              <div style={{ transform: 'scale(1.5)' }}>{getIconForCategory(selectedTeacher.category)}</div>
            </div>

            <div style={{ flex: '1.2', padding: '40px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ marginBottom: '25px' }}><span style={{ backgroundColor: '#f1f5f9', color: '#334155', padding: '6px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold' }}>{selectedTeacher.category} 課程</span></div>
              <h2 style={{ margin: '0 0 10px 0', fontSize: '28px', color: '#0f172a' }}>{selectedTeacher.skill}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569', fontSize: '15px', fontWeight: 'bold' }}><User size={16} /> {selectedTeacher.name} 老師</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#d97706', fontSize: '14px', fontWeight: 'bold' }}><Star size={16} fill="#d97706" color="#d97706" /> 5.0 (12)</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '30px', paddingBottom: '30px', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '18px', color: '#64748b', fontWeight: 'bold' }}>總計</span>
                <span style={{ fontSize: '36px', color: '#0f172a', fontWeight: '900' }}>🪙 {selectedTeacher.price.toFixed(1)} <span style={{ fontSize: '18px', color: '#64748b' }}>YTC</span></span>
              </div>

              {/* 🌟 核心更新：動態顯示老師的有空時間 */}
              <div style={{ display: 'flex', gap: '15px', marginBottom: '30px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#64748b', fontWeight: 'bold', marginBottom: '8px' }}><Calendar size={14} /> 選擇授課時段</label>
                  
                  <select style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#0f172a', fontSize: '14px' }}>
                    {/* 這裡先檢查該名老師是否有設定時間 (availableTimes) */}
                    {selectedTeacher.availableTimes && selectedTeacher.availableTimes.length > 0 ? (
                      selectedTeacher.availableTimes.map(timeKey => (
                        <option key={timeKey} value={timeKey}>
                          {formatTimeSlot(timeKey)}
                        </option>
                      ))
                    ) : (
                      // 🌟 防呆/示範：如果該老師沒設定時間，我們給出示範選項 (例如：一晚上、三晚上)
                      <>
                        <option>請選擇時段</option>
                        <option>{selectedTeacher.name === '阿弦' ? '星期一 晚上' : '星期六 早上'}</option>
                        <option>{selectedTeacher.name === '阿弦' ? '星期三 晚上' : '星期日 下午'}</option>
                      </>
                    )}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#64748b', fontWeight: 'bold', marginBottom: '8px' }}><Clock size={14} /> 課程時長</label>
                  <select style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#0f172a', fontSize: '14px' }}>
                    <option>1 小時 (標準)</option>
                    <option>2 小時</option>
                  </select>
                </div>
              </div>

              <div style={{ marginTop: 'auto' }}>
                <button onClick={confirmBooking} style={{ width: '100%', padding: '16px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}><ShieldCheck size={20} />確認付款並預約</button>
                <p style={{ textAlign: 'center', fontSize: '12px', color: '#94a3b8', margin: '15px 0 0 0' }}>目前餘額：🪙 {balance.toFixed(1)} YTC</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}