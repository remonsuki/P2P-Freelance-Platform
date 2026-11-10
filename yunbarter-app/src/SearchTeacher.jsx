import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Code, Music, Languages, Sparkles, User, X, Clock, Calendar, Star, ShieldCheck, AlignLeft, Info, CircleDollarSign, Loader2 } from 'lucide-react';
import { useSkillTrade } from './hooks/useSkillTrade';
import { fetchChainConfig } from './services/api';
import { useLiveData } from './hooks/useLiveData';
import './SearchTeacher.css';


export default function SearchTeacher({ isLoggedIn, teachers, userId, showNotification }) {
  const navigate = useNavigate();
  const {data:chainConfig}=useLiveData(fetchChainConfig);
  const { executeSkillTrade, loadingMessage, isTrading } = useSkillTrade();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [sortBy, setSortBy] = useState('new'); 
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('');
  const [isBooking, setIsBooking] = useState(false);

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
    setSelectedTimeSlot('');
  };

  const confirmBooking = async () => {
    if (isBooking || isTrading) return;
    if (!isLoggedIn) {
      showNotification('warning', '權限提示', '請先登入才能預約課程喔！');
      navigate('/login', { state: { from: '/search' } });
      return;
    }

    if (!selectedTimeSlot) {
      showNotification('warning', '操作提示', '請先選擇一個老師有空的授課時段！');
      return;
    }

    if(!chainConfig?.enabled) { showNotification('error','交易暫停',chainConfig?.message||'鏈上交易尚未就緒'); return; }

    setIsBooking(true);
    try {
      const payment=await executeSkillTrade(selectedTeacher.courseId,selectedTimeSlot,userId);
      showNotification(payment.status==='quoted'?'warning':'success',payment.status==='quoted'?'付款確認中':'SKILL 付款已確認',
        payment.status==='quoted'?'交易已送出，請到預約管理同步確認，請勿重複付款。':'SKILL 已存入託管合約，完課後才會撥款給老師。');
      setSelectedTeacher(null);
      navigate('/bookings');
    } catch (err) {
      showNotification('error', '交易失敗', err.message || '未知錯誤');
      setSelectedTeacher(null);
    } finally {
      setIsBooking(false);
    }
  };

  const formatTimeSlot = (timeKey) => {
    if (!timeKey) return '';
    
    const timeTranslation = {
      'Mon': '星期一', 'Tue': '星期二', 'Wed': '星期三', 'Thu': '星期四', 'Fri': '星期五', 'Sat': '星期六', 'Sun': '星期日',
      'Morning': '早上', 'Afternoon': '下午', 'Night': '晚上'
    };

    if (timeKey.includes('|')) {
      const [datePart, slotPart] = timeKey.split('|');
      return `${datePart} ${timeTranslation[slotPart] || slotPart}`;
    }
    
    if (timeKey.includes('-')) {
      const [day, slot] = timeKey.split('-');
      if (!day || !slot) return timeKey;
      return `${timeTranslation[day]} ${timeTranslation[slot]}`;
    }

    return timeKey;
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
    <div className="search-layout">

        
      {/* 優化左側課程篩選 */}
      <div
        className="search-sidebar"
        style={{
          backgroundColor: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '18px',
          padding: '22px',
          boxShadow: '0 4px 20px rgba(15,23,42,0.04)',
          boxSizing: 'border-box',
        }}
        >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '22px',
            gap: '8px',
          }}
        >
          <h3 style={{
            margin: 0,
            color: '#0f172a',
            fontSize: '18px',
            fontWeight: '800',
          }}>
            課程篩選
          </h3>

          {(searchTerm.trim() ||
            selectedCategories.length > 0 ||
            sortBy !== 'new') && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSelectedCategories([]);
                setSortBy('new');
              }}
              style={{
                border: 'none',
                background: 'none',
                color: '#2563eb',
                fontWeight: 'bold',
                fontSize: '12px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              重設條件
            </button>
          )}
        </div>
        {/* 手機版分類展開按鈕 */}
        <button
          type="button"
          className="search-filter-toggle"
          onClick={() => setIsMobileFilterOpen(prev => !prev)}
          aria-expanded={isMobileFilterOpen}
          aria-controls="course-category-options"
        >
          <span>
            {isMobileFilterOpen ? '收合分類' : '展開分類'}
            {selectedCategories.length > 0 &&
              `（已選 ${selectedCategories.length} 類）`}
          </span>

          <span aria-hidden="true">
            {isMobileFilterOpen ? '▲' : '▼'}
          </span>
        </button>
        <div
          id="course-category-options"
          className={
            isMobileFilterOpen
              ? 'search-filter-options is-open'
              : 'search-filter-options'
          }
        >
          <h4 style={{
            margin: '0 0 6px',
            color: '#64748b',
            fontSize: '13px',
            fontWeight: 'bold',
          }}>
            技能類別
          </h4>

          {availableCategories.map(cat => {
            const selected = selectedCategories.includes(cat);

            return (
              <label
                key={cat}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px',
                  borderRadius: '10px',
                  border: selected
                    ? '1px solid #2563eb'
                    : '1px solid #e2e8f0',
                  backgroundColor: selected
                    ? '#eff6ff'
                    : 'white',
                  color: selected ? '#1d4ed8' : '#334155',
                  fontWeight: selected ? 'bold' : 'normal',
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => handleCategoryToggle(cat)}
                  style={{
                    width: '17px',
                    height: '17px',
                    accentColor: '#2563eb',
                    cursor: 'pointer',
                  }}
                />
                <span>{cat}</span>
                {selected && (
                  <span style={{ marginLeft: 'auto' }}>✓</span>
                )}
              </label>
            );
          })}

          {availableCategories.length === 0 && (
            <p style={{
              fontSize: '13px',
              color: '#94a3b8',
              lineHeight: 1.6,
            }}>
              目前沒有可篩選的技能類別
            </p>
          )}
        </div>
      </div>

        
        <div className="search-content">

          {/* 課程探索 Banner */}
        <section
          style={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: '20px',
            background: 'linear-gradient(120deg, #0f172a 0%, #1e40af 100%)',
            padding: '30px 32px',
            color: 'white',
            boxShadow: '0 12px 28px rgba(15, 23, 42, 0.12)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              right: '-35px',
              top: '-55px',
              width: '190px',
              height: '190px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.08)',
              pointerEvents: 'none',
            }}
          />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <p style={{
              fontSize: '12px',
              letterSpacing: '2px',
              opacity: 0.7,
              margin: '0 0 12px',
            }}>
              YUNBARTER · LEARN & SHARE
            </p>

            <h1 style={{
              fontSize: '28px',
              fontWeight: '900',
              margin: '0 0 12px',
              lineHeight: 1.3,
            }}>
              找到適合你的技能課程
            </h1>

            <p style={{
              fontSize: '14px',
              lineHeight: 1.8,
              opacity: 0.85,
              margin: '0 0 20px',
            }}>
              從程式、音樂到語言，探索不同領域的知識，
              找到值得學習的新技能。
            </p>

            <span style={{
              display: 'inline-block',
              padding: '7px 14px',
              borderRadius: '20px',
              background: 'rgba(255, 255, 255, 0.14)',
              fontSize: '13px',
              fontWeight: 'bold',
            }}>
              目前顯示 {filteredAndSortedTeachers.length} / {teachers.length} 門課程
            </span>
          </div>
        </section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
          {/* 優化搜尋欄 */}
          <div
            style={{
              position: 'relative',
              flex: '1 1 300px',
              minWidth: '220px',
              maxWidth: '420px',
            }}
          >
            <Search
              size={19}
              color="#64748b"
              style={{
                position: 'absolute',
                left: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
              }}
            />

            <input
              type="text"
              aria-label="搜尋課程或老師"
              placeholder="搜尋課程名稱、老師..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                height: '48px',
                padding: '0 46px',
                borderRadius: '14px',
                border: '1px solid #dbe4f0',
                backgroundColor: 'white',
                boxShadow: '0 4px 16px rgba(15,23,42,0.04)',
                fontSize: '14px',
                color: '#0f172a',
                outlineColor: '#2563eb',
                boxSizing: 'border-box',
              }}
            />

            {searchTerm.length > 0 && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                title="清除搜尋文字"
                aria-label="清除搜尋文字"
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  border: 'none',
                  backgroundColor: '#f1f5f9',
                  borderRadius: '50%',
                  width: '26px',
                  height: '26px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={15} color="#64748b" />
              </button>
            )}
          </div>
            <div className="search-sort-controls" style={{ display: 'flex', gap: '10px' }}>
              {['new', 'priceAsc', 'priceDesc'].map(type => (
                <button key={type} onClick={() => setSortBy(type)} style={{ padding: '8px 16px', borderRadius: '20px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', border: sortBy === type ? 'none' : '1px solid #e2e8f0', backgroundColor: sortBy === type ? '#0f172a' : 'white', color: sortBy === type ? 'white' : '#64748b' }}>
                  {sortBy === type && '✓ '}{type === 'new' ? '最新上架' : type === 'priceAsc' ? '價格：低到高' : '價格：高到低'}
                </button>
              ))}
            </div>
          </div>

          <div className="search-course-grid">
          {/* 搜尋無結果提示 */}
          {filteredAndSortedTeachers.length === 0 && (
            <div
              style={{
                gridColumn: '1 / -1',
                width: '100%',
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '20px',
                padding: '60px 24px',
                boxSizing: 'border-box',
                textAlign: 'center',
                boxShadow: '0 8px 24px rgba(15,23,42,0.04)',
              }}
            >
              {/* 搜尋圖示 */}
              <div
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '24px',
                  backgroundColor: '#eff6ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 24px',
                }}
              >
                <Search size={36} color="#2563eb" />
              </div>

              {/* 提示標題 */}
              <h3
                style={{
                  fontSize: '22px',
                  fontWeight: '800',
                  color: '#0f172a',
                  margin: '0 0 12px',
                }}
              >
                {teachers.length === 0
                  ? '目前還沒有上架的課程'
                  : '找不到符合條件的課程'}
              </h3>

              {/* 提示說明 */}
              <p
                style={{
                  color: '#64748b',
                  fontSize: '14px',
                  lineHeight: 1.8,
                  maxWidth: '360px',
                  margin: '0 auto 24px',
                }}
              >
                {teachers.length === 0
                  ? '目前還沒有老師上架課程，歡迎稍後再來探索！'
                  : '試試其他關鍵字，或清除分類與排序條件，探索更多技能課程。'}
              </p>

              {/* 清除篩選按鈕 */}
              {teachers.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedCategories([]);
                    setSortBy('new');
                  }}
                  style={{
                    padding: '13px 24px',
                    borderRadius: '12px',
                    border: 'none',
                    backgroundColor: '#2563eb',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#1d4ed8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#2563eb';
                  }}
                >
                  清除搜尋與篩選
                </button>
              )}
            </div>
          )}
            {filteredAndSortedTeachers.map(teacher => {
              const isMyOwnCourse = isLoggedIn && teacher.teacherId === userId;

              return (
                <div
                  key={teacher.id}
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '20px',
                    overflow: 'hidden',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 8px 24px rgba(15,23,42,0.06)',
                    transition: 'transform 0.25s ease, box-shadow 0.25s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    minWidth: 0,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-6px)';
                    e.currentTarget.style.boxShadow =
                      '0 16px 36px rgba(15,23,42,0.13)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow =
                      '0 8px 24px rgba(15,23,42,0.06)';
                  }}
                >
                  {/* 課程卡片封面 */}
                    <div
                      className="search-course-cover"
                      style={{
                        position: 'relative',
                        overflow: 'hidden',
                        background: getGradientForCategory(teacher.category),
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      {/* 背景裝飾圓形 */}
                      <div
                        style={{
                          position: 'absolute',
                          width: '170px',
                          height: '170px',
                          borderRadius: '50%',
                          backgroundColor: 'rgba(255,255,255,0.13)',
                          top: '-90px',
                          right: '-40px',
                          pointerEvents: 'none',
                        }}
                      />

                      <div
                        style={{
                          position: 'absolute',
                          width: '110px',
                          height: '110px',
                          borderRadius: '50%',
                          backgroundColor: 'rgba(255,255,255,0.1)',
                          bottom: '-70px',
                          left: '-20px',
                          pointerEvents: 'none',
                        }}
                      />

                      {/* 左上角分類標籤 */}
                      <span
                        style={{
                          position: 'absolute',
                          top: '14px',
                          left: '16px',
                          backgroundColor: 'rgba(255,255,255,0.85)',
                          color: '#334155',
                          padding: '6px 12px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                        }}
                      >
                        技能課程
                      </span>

                      {/* 中央技能圖示 */}
                      <div
                        style={{
                          width: '86px',
                          height: '86px',
                          borderRadius: '24px',
                          backgroundColor: 'rgba(255,255,255,0.2)',
                          border: '1px solid rgba(255,255,255,0.3)',
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
                          position: 'relative',
                          zIndex: 1,
                        }}
                      >
                        {getIconForCategory(teacher.category)}
                      </div>

                      {/* 右下角可選時段狀態 */}
                      <span
                        style={{
                          position: 'absolute',
                          bottom: '14px',
                          right: '16px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          backgroundColor: 'rgba(15,23,42,0.72)',
                          color: 'white',
                          padding: '6px 10px',
                          borderRadius: '20px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                        }}
                      >
                        <Clock size={13} />
                        {teacher.availableTimes?.length > 0
                          ? '有可選時段'
                          : '暫無可選時段'}
                      </span>
                    </div>
                  {/* 課程卡片內容 */}
                  <div
                    className="search-course-body"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      flexGrow: 1,
                      gap: '12px',
                    }}
                  >
                    {/* 技能分類與 SKILL 價格 */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '10px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span
                        style={{
                          backgroundColor: '#eff6ff',
                          color: '#2563eb',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                        }}
                      >
                        {teacher.category}
                      </span>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'baseline',
                          gap: '5px',
                          color: '#0f172a',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '22px',
                            fontWeight: '900',
                            letterSpacing: '-0.5px',
                          }}
                        >
                          {teacher.price}
                        </span>
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: 'bold',
                            color: '#64748b',
                          }}
                        >
                          SKILL
                        </span>
                      </div>
                    </div>

                    {/* 課程名稱與老師資訊 */}
                    <div style={{ flexGrow: 1 }}>
                      <h3
                        title={teacher.skill}
                        style={{
                          margin: '0 0 14px',
                          fontSize: '18px',
                          fontWeight: '800',
                          color: '#0f172a',
                          lineHeight: '1.45',
                          minHeight: '52px',
                          display: '-webkit-box',
                          WebkitBoxOrient: 'vertical',
                          WebkitLineClamp: 2,
                          overflow: 'hidden',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {teacher.skill}
                      </h3>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          color: '#64748b',
                          fontSize: '14px',
                        }}
                      >
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: '#f1f5f9',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <User size={17} color="#64748b" />
                        </div>

                        <span>
                          {teacher.name} 老師
                          {isMyOwnCourse && (
                            <span
                              style={{
                                marginLeft: '7px',
                                color: '#2563eb',
                                fontSize: '12px',
                                fontWeight: 'bold',
                              }}
                            >
                              (你自己)
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* 查看詳情按鈕：保留原本的預約視窗與本人課程限制 */}
                    <div
                      style={{
                        borderTop: '1px solid #f1f5f9',
                        paddingTop: '16px',
                        marginTop: '4px',
                      }}
                    >
                      {isMyOwnCourse ? (
                        <button
                          type="button"
                          disabled
                          style={{
                            width: '100%',
                            padding: '13px',
                            border: '1px solid #e2e8f0',
                            borderRadius: '12px',
                            backgroundColor: '#f1f5f9',
                            color: '#94a3b8',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            cursor: 'not-allowed',
                          }}
                        >
                          這是你上架的課程
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openBookingModal(teacher)}
                          style={{
                            width: '100%',
                            padding: '13px',
                            backgroundColor: '#2563eb',
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'background-color 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#1d4ed8';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#2563eb';
                          }}
                        >
                          <Info size={17} />
                          查看課程詳情
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal 內容... (已保留先前優化邏輯) */}
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
                    <Star size={18} fill="#d97706" color="#d97706" /> {selectedTeacher.rating == null ? '尚無評價' : selectedTeacher.rating.toFixed(1)} ({selectedTeacher.reviewCount || 0} 則評價)
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

            <div
              style={{
                flex: 1,
                backgroundColor: '#f8fafc',
                borderLeft: '1px solid #e2e8f0',
                padding: '40px 30px',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                overflowY: 'auto',
              }}
            >
              <h3 style={{ margin: '0 0 20px 0', fontSize: '20px', color: '#0f172a', fontWeight: 'bold' }}>預約資訊</h3>

              <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', border: '1px solid #e2e8f0', marginBottom: '30px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '10px' }}>
                  <span style={{ fontSize: '36px', color: '#0f172a', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CircleDollarSign size={32} strokeWidth={2.5} color="#0f172a" /> {selectedTeacher.price}
                  </span>
                  <span style={{ fontSize: '16px', color: '#64748b', fontWeight: 'bold' }}>SKILL / 堂</span>
                </div>
                <div style={{ fontSize: '13px', color: '#94a3b8' }}>課程費全額結算，另需 ETH 網路費</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '30px' }}>
                <p style={{fontSize:'13px',color:'#475569',lineHeight:1.7}}>使用 SKILL 鏈上託管付款，網路費以 ETH 支付。付款時段最多保留約 10 分鐘，請依序完成 MetaMask 的授權與付款。</p>
                {!chainConfig?.enabled&&<p role="alert">{chainConfig?.message||'鏈上交易尚未就緒'}</p>}
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#475569', fontWeight: 'bold', marginBottom: '8px' }}>
                    <Calendar size={16} /> 選擇老師有空時段
                  </label>
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
                      <option disabled value="">目前沒有可預約時段</option>
                    )}
                  </select>
                </div>
                
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#475569', fontWeight: 'bold', marginBottom: '8px' }}>
                    <Clock size={16} /> 課程時長
                  </label>
                  <select style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: 'white', color: '#0f172a', fontSize: '15px', outlineColor: '#3b82f6', cursor: 'pointer' }}>
                    <option>1 小時 (標準)</option>
                  </select>
                </div>
              </div>

              {isTrading && loadingMessage && (
                <div style={{ padding: '12px', backgroundColor: '#eff6ff', borderRadius: '10px', color: '#1d4ed8', fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <Loader2 size={18} className="animate-spin" />
                  {loadingMessage}
                </div>
              )}

              <div style={{ marginTop: 'auto' }}>
                <button 
                  onClick={confirmBooking}
                  disabled={isTrading || isBooking || !chainConfig?.enabled || !selectedTeacher.availableTimes?.length}
                  style={{ width: '100%', padding: '16px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '16px', cursor: isTrading ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', boxShadow: '0 10px 20px -5px rgba(15, 23, 42, 0.3)', transition: 'background-color 0.2s', opacity: isTrading ? 0.7 : 1 }}
                  onMouseOver={e => { if (!isTrading) e.currentTarget.style.backgroundColor = '#1e293b'; }}
                  onMouseOut={e => e.currentTarget.style.backgroundColor = '#0f172a'}
                >
                  {isTrading ? <Loader2 size={20} className="animate-spin" /> : <ShieldCheck size={20} />}
                  {isTrading || isBooking ? (loadingMessage || '處理中...') : '確認預約並扣款'}
                </button>

              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
