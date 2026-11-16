
import { Link } from 'react-router-dom';
import {
  Search, Sparkles, Clock, User, ArrowUpRight
} from 'lucide-react';

// 不同技能分類的封面顏色
const categoryGradients = {
  程式: 'linear-gradient(135deg, #11998e, #38ef7d)',
  音樂: 'linear-gradient(135deg, #ff9a9e, #fecfef)',
  語言: 'linear-gradient(135deg, #a18cd1, #fbc2eb)',
};

const defaultGradient =
  'linear-gradient(135deg, #89f7fe, #66a6ff)';

export default function Dashboard({ userName, teachers }) {
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? '早安' : hour < 18 ? '午安' : '晚安';

  const safeTeachers = Array.isArray(teachers) ? teachers : [];

  const recentCourses = [...safeTeachers]
  .sort((a, b) => b.id - a.id)
  .slice(0, 3);

  const uniqueCategories = new Set(
    safeTeachers.map(t => t.category).filter(Boolean)
  ).size;

  return (
    <div style={{
      backgroundColor: '#f8fafc',
      minHeight: 'calc(100vh - 70px)',
      padding: '50px 20px',
      fontFamily: 'sans-serif',
    }}>
      <div style={{
        maxWidth: '1000px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '30px',
      }}>

        {/* ===== 歡迎橫幅 ===== */}
        <section style={{
          background: 'linear-gradient(135deg, #0f172a, #1e293b)',
          borderRadius: '24px',
          padding: '40px',
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 20px 40px -15px rgba(15,23,42,0.4)',
        }}>
          <div style={{
            position: 'absolute',
            top: '-50%',
            right: '-10%',
            width: '300px',
            height: '300px',
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(59,130,246,0.2), transparent 70%)',
            pointerEvents: 'none',
          }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#94a3b8',
              fontSize: '15px',
              marginBottom: '10px',
            }}>
              <Sparkles size={18} color="#fcd34d" />
              歡迎回到 YunBarter
            </div>

            <h1 style={{
              margin: '0 0 15px',
              fontSize: '36px',
              fontWeight: 900,
              lineHeight: 1.3,
            }}>
              {greeting}，{userName}！
              <br />
              準備好探索新知識了嗎？
            </h1>

            <p style={{
              margin: '0 0 30px',
              color: '#cbd5e1',
              fontSize: '16px',
              maxWidth: '500px',
              lineHeight: 1.6,
            }}>
              目前平台共有 {safeTeachers.length} 門課程，
              涵蓋 {uniqueCategories} 個技能領域。
              快來探索你感興趣的技能吧！
            </p>

            <div style={{
              display: 'flex',
              gap: '15px',
              flexWrap: 'wrap',
            }}>
              <Link
                to="/search"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '14px 28px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  borderRadius: '12px',
                  fontWeight: 'bold',
                  fontSize: '15px',
                  textDecoration: 'none',
                }}
              >
                <Search size={18} />
                尋找課程
              </Link>

              <Link
                to="/publish"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '14px 28px',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '12px',
                  fontWeight: 'bold',
                  fontSize: '15px',
                  textDecoration: 'none',
                }}
              >
                <ArrowUpRight size={18} />
                發佈技能
              </Link>
            </div>
          </div>
        </section>

        {/* ===== 最新上架課程 ===== */}
        <section>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
            marginBottom: '20px',
          }}>
            <h2 style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              margin: 0,
              fontSize: '22px',
              fontWeight: 800,
              color: '#0f172a',
            }}>
              <Clock size={22} color="#3b82f6" />
              最新上架課程
            </h2>

            <Link
              to="/search"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                color: '#2563eb',
                fontSize: '14px',
                fontWeight: 'bold',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              查看全部課程
              <ArrowUpRight size={17} />
            </Link>
          </div>

          {/* ===== 課程卡片 Grid ===== */}
          <div style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
            gap: '22px',
          }}>
          {/* Step 3：目前沒有課程時的提示 */}
          {recentCourses.length === 0 && (
            <div
              style={{
                gridColumn: '1 / -1',
                width: '100%',
                padding: '55px 25px',
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '20px',
                boxShadow: '0 8px 24px rgba(15,23,42,0.04)',
                textAlign: 'center',
                boxSizing: 'border-box',
              }}
            >
              {/* 圖示 */}
              <div
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '24px',
                  backgroundColor: '#eff6ff',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  margin: '0 auto 22px',
                }}
              >
                <Search size={34} color="#2563eb" />
              </div>

              {/* 標題 */}
              <h3
                style={{
                  margin: '0 0 12px',
                  fontSize: '21px',
                  fontWeight: '800',
                  color: '#0f172a',
                }}
              >
                目前還沒有上架的課程
              </h3>

              {/* 說明 */}
              <p
                style={{
                  color: '#64748b',
                  fontSize: '14px',
                  lineHeight: 1.8,
                  maxWidth: '400px',
                  margin: '0 auto 24px',
                }}
              >
                還沒有老師分享技能，
                成為第一位上架課程的老師吧！
              </p>

              {/* 發佈課程入口 */}
              <Link
                to="/publish"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '13px 24px',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  borderRadius: '12px',
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: 'bold',
                }}
              >
                <ArrowUpRight size={17} />
                發佈第一門課程
              </Link>
            </div>
          )}
            {recentCourses.map(teacher => (
              <article
                key={teacher.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  minWidth: 0,
                  overflow: 'hidden',
                  backgroundColor: 'white',
                  borderRadius: '20px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 8px 24px rgba(15,23,42,0.06)',
                  transition:
                    'transform 0.25s, box-shadow 0.25s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform =
                    'translateY(-5px)';
                  e.currentTarget.style.boxShadow =
                    '0 16px 36px rgba(15,23,42,0.13)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform =
                    'translateY(0)';
                  e.currentTarget.style.boxShadow =
                    '0 8px 24px rgba(15,23,42,0.06)';
                }}
              >
                {/* 課程封面 */}
                <div style={{
                  height: '140px',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  background:
                    categoryGradients[teacher.category] ||
                    defaultGradient,
                }}>
                  {/* 背景裝飾圓形 */}
                  <div style={{
                    position: 'absolute',
                    width: '160px',
                    height: '160px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255,255,255,0.13)',
                    top: '-80px',
                    right: '-40px',
                    pointerEvents: 'none',
                  }} />

                  {/* 最新上架標籤 */}
                  <span style={{
                    position: 'absolute',
                    top: '14px',
                    left: '14px',
                    borderRadius: '20px',
                    padding: '6px 12px',
                    backgroundColor: 'rgba(255,255,255,0.85)',
                    color: '#334155',
                    fontSize: '12px',
                    fontWeight: 'bold',
                  }}>
                    最新上架
                  </span>

                  {/* 中央技能圖示 */}
                  <div style={{
                    width: '75px',
                    height: '75px',
                    borderRadius: '22px',
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    border: '1px solid rgba(255,255,255,0.3)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    position: 'relative',
                  }}>
                    <Sparkles size={35} color="white" />
                  </div>
                </div>

                {/* ===== 課程資訊 ===== */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  flexGrow: 1,
                  gap: '15px',
                  padding: '22px',
                }}>
                  {/* 分類與價格 */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px',
                  }}>
                    <span style={{
                      padding: '6px 12px',
                      backgroundColor: '#eff6ff',
                      color: '#2563eb',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                    }}>
                      {teacher.category || '其他'}
                    </span>

                    <div style={{
                      display: 'flex',
                      gap: '5px',
                      alignItems: 'baseline',
                    }}>
                      <strong style={{
                        color: '#0f172a',
                        fontSize: '22px',
                      }}>
                        {teacher.price != null &&
                        Number.isFinite(Number(teacher.price))
                          ? Number(teacher.price).toLocaleString(
                              'zh-TW',
                              { maximumFractionDigits: 2 }
                            )
                          : '—'}
                      </strong>

                      <span style={{
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: '#64748b',
                      }}>
                        SKILL
                      </span>
                    </div>
                  </div>

                  {/* 課程名稱 */}
                  <h3
                    title={teacher.skill}
                    style={{
                      fontSize: '18px',
                      fontWeight: 800,
                      color: '#0f172a',
                      lineHeight: 1.5,
                      margin: 0,
                      minHeight: '54px',
                      display: '-webkit-box',
                      WebkitBoxOrient: 'vertical',
                      WebkitLineClamp: 2,
                      overflow: 'hidden',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {teacher.skill}
                  </h3>

                  {/* 老師資訊 */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '9px',
                    color: '#64748b',
                    fontSize: '14px',
                    flexGrow: 1,
                  }}>
                    <span style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#f1f5f9',
                      flexShrink: 0,
                    }}>
                      <User size={17} color="#64748b" />
                    </span>

                    <span>{teacher.name} 老師</span>
                  </div>

                  {/* 底部按鈕 */}
                  <div style={{
                    borderTop: '1px solid #f1f5f9',
                    paddingTop: '16px',
                  }}>
                    <Link
                      to="/search"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '13px',
                        boxSizing: 'border-box',
                        backgroundColor: '#2563eb',
                        color: 'white',
                        borderRadius: '12px',
                        textDecoration: 'none',
                        fontSize: '14px',
                        fontWeight: 'bold',
                      }}
                    >
                      前往尋找課程
                      <ArrowUpRight size={17} />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
