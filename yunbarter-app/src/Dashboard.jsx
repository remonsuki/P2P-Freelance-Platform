import { Link } from 'react-router-dom';
import { Search, Sparkles, Clock, User, CircleDollarSign, ArrowUpRight } from 'lucide-react';

export default function Dashboard({ userName, teachers }) {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '早安';
    if (hour < 18) return '午安';
    return '晚安';
  };

  const safeTeachers = Array.isArray(teachers) ? teachers : [];
  const recentCourses = [...safeTeachers].sort((a, b) => b.id - a.id).slice(0, 3);
  const uniqueCategories = [...new Set(safeTeachers.map(t => t.category))].length;

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: 'calc(100vh - 70px)', padding: '50px 20px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '30px' }}>
        
        {/* 歡迎橫幅 */}
        <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', borderRadius: '24px', padding: '40px', color: 'white', position: 'relative', overflow: 'hidden', boxShadow: '0 20px 40px -15px rgba(15, 23, 42, 0.4)' }}>
          <div style={{ position: 'absolute', top: '-50%', right: '-10%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(59, 130, 246, 0.2) 0%, rgba(255,255,255,0) 70%)', borderRadius: '50%' }}></div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '15px', marginBottom: '10px' }}>
              <Sparkles size={18} color="#fcd34d" /> 歡迎回到 YunBarter
            </div>
            <h1 style={{ margin: '0 0 15px 0', fontSize: '36px', fontWeight: '900' }}>
              {getGreeting()}，{userName}！<br/>準備好探索新知識了嗎？
            </h1>
            <p style={{ margin: '0 0 30px 0', color: '#cbd5e1', fontSize: '16px', maxWidth: '500px', lineHeight: '1.6' }}>
              目前平台上有來自 {uniqueCategories} 個不同領域的專家，正等待與你進行技能交換。
            </p>
            <div style={{ display: 'flex', gap: '15px' }}>
              <Link to="/search" style={{ textDecoration: 'none' }}>
                <button style={{ padding: '14px 28px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Search size={18} /> 尋找課程
                </button>
              </Link>
              <Link to="/publish" style={{ textDecoration: 'none' }}>
                <button style={{ padding: '14px 28px', backgroundColor: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ArrowUpRight size={18} /> 發佈技能
                </button>
              </Link>
            </div>
          </div>
        </div>

        {/* 推薦課程區塊 */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, fontSize: '22px', color: '#0f172a', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={22} color="#3b82f6" /> 最新上架課程
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '25px' }}>
            {recentCourses.map(teacher => (
              <div key={teacher.id} style={{ backgroundColor: 'white', borderRadius: '20px', padding: '25px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <span style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '4px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' }}>{teacher.category}</span>
                  
                  <span style={{ color: '#d97706', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <CircleDollarSign size={16} strokeWidth={2.5} /> {teacher.price.toFixed(1)}
                  </span>
                  
                </div>
                <h3 style={{ fontSize: '18px', color: '#0f172a', marginBottom: '15px' }}>{teacher.skill}</h3>
                <div style={{ fontSize: '14px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <User size={14} /> {teacher.name} 老師
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}