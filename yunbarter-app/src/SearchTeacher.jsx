import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Code, Music, Languages, Sparkles, User, X, Clock, Calendar, Star, ShieldCheck, AlignLeft, Info } from 'lucide-react';

export default function SearchTeacher({ isLoggedIn, balance, onDeduct, teachers, userName }) {
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [sortBy, setSortBy] = useState('new'); 
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  
  // 🌟 新增：用來記錄使用者在 Modal 裡面選了哪個時段
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('');

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
    setSelectedTeacher(teacher);
    // 🌟 每次打開 Modal 時，把時段重置為空白，確保使用者一定得重選
    setSelectedTimeSlot('');
  };

  const confirmBooking = () => {
    if (!isLoggedIn) {
      alert("🔒 請先登入才能預約課程喔！");
      navigate('/login', { state: { from: '/search' } });
      return;
    }

    // 🌟 核心防呆：如果使用者沒有選時間，直接擋下來！
    if (!selectedTimeSlot) {
      alert("⚠️ 請先選擇一個老師有空的授課時段！");
      return;
    }
    
    if (balance >= selectedTeacher.price) {
      onDeduct(selectedTeacher.price, selectedTeacher.name, selectedTeacher.skill);
      
      // 🌟 優化提示：告訴他預約了哪個時間
      let timeText = selectedTimeSlot;
      if (timeText.includes('-')) {
        timeText = formatTimeSlot(timeText);
      }
      alert(`✅ 預約成功！已經幫您聯絡 ${selectedTeacher.name} 老師。\n約定時間：${timeText}`);
      
      setSelectedTeacher(null);
    } else {
      alert("❌ 餘額不足！請先至錢包儲值。");
      setSelectedTeacher(null);
      navigate('/wallet');
    }
  };

  const formatTimeSlot = (timeKey) => {
    if (!timeKey) return '';
    const [day, slot] = timeKey.split('-');
    if (!day || !slot) return timeKey;
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
            {filteredAndSortedTeachers.map(teacher => {
              const isMyOwnCourse = isLoggedIn && teacher.name === userName;

              return (
                <div key={teacher.id} style={{ backgroundColor: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.04)', transition: 'transform 0.2s', display: 'flex', flexDirection: 'column' }} onMouseOver={e => e.currentTarget.style.transform = 'translateY(-5px)'} onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}>
                  <div style={{ height: '160px', background: getGradientForCategory(teacher.category), display: 'flex', justifyContent: 'center', alignItems: 'center' }}>{getIconForCategory(teacher.category)}</div>
                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                      <span style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold' }}>{teacher.category}</span>
                      <span style={{ color: '#d97706', fontWeight: '900', fontSize: '18px' }}>🪙 {teacher.price.toFixed(1)}</span>
                    </div>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#0f172a', flexGrow: 1 }}>{teacher.skill}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>
                      <div style={{ width: '22px', height: '22px', backgroundColor: '#f1f5f9', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}><User size={14} color="#64748b" /></div>
                      {teacher.name} {isMyOwnCourse && <span style={{ color: '#3b82f6', fontSize: '12px', fontWeight: 'bold' }}>(你自己)</span>}
                    </div>
                    
                    {isMyOwnCourse ? (
                      <button disabled style={{ width: '100%', padding: '12px', backgroundColor: '#f1f5f9', color: '#94a3b8', border: '2px solid #e2e8f0', borderRadius: '8px', fontWeight: 'bold', fontSize: '15px', cursor: 'not-allowed' }}>這是你上架的課程</button>
                    ) : (
                      <button onClick={() => openBookingModal(teacher)} style={{ width: '100%', padding: '12px', backgroundColor: 'transparent', color: '#3b82f6', border: '2px solid #3b82f6', borderRadius: '8px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }} onMouseOver={e => { e.currentTarget.style.backgroundColor = '#3b82f6'; e.currentTarget.style.color = 'white'; }} onMouseOut={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#3b82f6'; }}>
                        <Info size={18} /> 查看課程詳情
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selectedTeacher && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(6px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000, padding: '20px', boxSizing: 'border-box' }}>
          
          <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '1000px', maxHeight: '90vh', borderRadius: '24px', overflow: 'hidden', display: 'flex', flexDirection: 'row', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)', position: 'relative' }}>
            
            <button onClick={() => setSelectedTeacher(null)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', zIndex: 10, transition: 'all 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#f1f5f9'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'white'}>
              <X size={20} color="#64748b" />
            </button>

            <div style={{ flex: '1.5', overflowY: 'auto', display: 'flex', flexDirection: 'column', backgroundColor: 'white' }}>
              <div style={{ height: '220px', background: getGradientForCategory(selectedTeacher.category), display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                <div style={{ transform: 'scale(1.8)', opacity: 0.9 }}>{getIconForCategory(selectedTeacher.category)}</div>
              </div>

              <div style={{ padding: '40px' }}>
                <div style={{ marginBottom: '15px' }}>
                  <span style={{ backgroundColor: '#f1f5f9', color: '#334155', padding: '6px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold' }}>
                    {selectedTeacher.category} 課程
                  </span>
                </div>
                
                <h2 style={{ margin: '0 0 20px 0', fontSize: '32px', color: '#0f172a', lineHeight: '1.3', fontWeight: '900' }}>
                  {selectedTeacher.skill}
                </h2>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '40px', paddingBottom: '30px', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontSize: '16px', fontWeight: 'bold' }}>
                    <div style={{ width: '32px', height: '32px', backgroundColor: '#e2e8f0', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      <User size={18} color="#64748b" />
                    </div>
                    {selectedTeacher.name} 老師
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#d97706', fontSize: '15px', fontWeight: 'bold' }}>
                    <Star size={18} fill="#d97706" color="#d97706" /> 5.0 (12 則評價)
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: '20px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
                    <AlignLeft size={20} color="#3b82f6" /> 關於這堂課程
                  </h3>
                  <div style={{ color: '#475569', fontSize: '16px', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>
                    {selectedTeacher.description || '這堂課的老師很神秘，還沒有為課程寫下詳細的介紹說明。不過別擔心，您可以先預約一堂課來體驗看看！'}
                  </div>
                </div>

              </div>
            </div>

            <div style={{ flex: '1', backgroundColor: '#f8fafc', borderLeft: '1px solid #e2e8f0', padding: '40px 30px', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '20px', color: '#0f172a', fontWeight: 'bold' }}>預約資訊</h3>

              <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', border: '1px solid #e2e8f0', marginBottom: '30px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '10px' }}>
                  <span style={{ fontSize: '36px', color: '#0f172a', fontWeight: '900' }}>🪙 {selectedTeacher.price.toFixed(1)}</span>
                  <span style={{ fontSize: '16px', color: '#64748b', fontWeight: 'bold' }}>YTC / 堂</span>
                </div>
                <div style={{ fontSize: '13px', color: '#94a3b8' }}>免收平台手續費，100% 價值回歸</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '30px' }}>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#475569', fontWeight: 'bold', marginBottom: '8px' }}>
                    <Calendar size={16} /> 選擇老師有空時段
                  </label>
                  
                  {/* 🌟 核心修改：綁定 selectedTimeSlot 狀態，並把預設的 option 設為空字串 value="" */}
                  <select 
                    value={selectedTimeSlot} 
                    onChange={(e) => setSelectedTimeSlot(e.target.value)}
                    style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: 'white', color: '#0f172a', fontSize: '15px', outlineColor: '#3b82f6', cursor: 'pointer' }}
                  >
                    <option value="">請選擇時段</option>
                    
                    {selectedTeacher.availableTimes && selectedTeacher.availableTimes.length > 0 ? (
                      selectedTeacher.availableTimes.map(timeKey => (
                        <option key={timeKey} value={timeKey}>{formatTimeSlot(timeKey)}</option>
                      ))
                    ) : (
                      <><option value="Mon-Night">{selectedTeacher.name === '阿弦' ? '星期一 晚上' : '星期六 早上'}</option><option value="Sun-Afternoon">{selectedTeacher.name === '阿弦' ? '星期三 晚上' : '星期日 下午'}</option></>
                    )}
                  </select>

                </div>
                
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#475569', fontWeight: 'bold', marginBottom: '8px' }}>
                    <Clock size={16} /> 課程時長
                  </label>
                  <select style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: 'white', color: '#0f172a', fontSize: '15px', outlineColor: '#3b82f6', cursor: 'pointer' }}>
                    <option>1 小時 (標準)</option>
                    <option>2 小時</option>
                  </select>
                </div>
              </div>

              <div style={{ marginTop: 'auto' }}>
                <button 
                  onClick={confirmBooking} 
                  style={{ width: '100%', padding: '16px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', boxShadow: '0 10px 20px -5px rgba(15, 23, 42, 0.3)', transition: 'background-color 0.2s' }}
                  onMouseOver={e => e.currentTarget.style.backgroundColor = '#1e293b'}
                  onMouseOut={e => e.currentTarget.style.backgroundColor = '#0f172a'}
                >
                  <ShieldCheck size={20} />確認預約並扣款
                </button>
                <div style={{ textAlign: 'center', marginTop: '15px' }}>
                  <span style={{ fontSize: '13px', color: '#64748b' }}>目前錢包餘額：</span>
                  <span style={{ fontSize: '14px', color: '#d97706', fontWeight: 'bold' }}>🪙 {balance.toFixed(1)} YTC</span>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}