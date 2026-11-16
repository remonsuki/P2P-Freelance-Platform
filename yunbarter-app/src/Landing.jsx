import { Link } from 'react-router-dom';
// 🌟 引入所有需要的 Lucide 圖示
import { ArrowRight, Search, Sparkles, ShieldCheck, Repeat, BookOpen, CircleDollarSign, Zap } from 'lucide-react';

export default function Landing() {
  return (
    <div style={{ fontFamily: 'sans-serif', color: '#0f172a', backgroundColor: '#f8fafc' }}>
      
      {/* ================= 🌟 第一區：主視覺 (Hero Section) ================= */}
        <section
          style={{
            padding: '85px 20px 75px',
            background:
              'linear-gradient(135deg, #eff6ff 0%, #f8fafc 55%, #f5f3ff 100%)',
            position: 'relative',
            overflow: 'hidden',
            textAlign: 'center',
          }}
        >
          {/* 背景裝飾 */}
          <div
            style={{
              position: 'absolute',
              top: '-160px',
              right: '-100px',
              width: '400px',
              height: '400px',
              borderRadius: '50%',
              background: 'rgba(59,130,246,0.07)',
              pointerEvents: 'none',
            }}
          />

          <div
            style={{
              maxWidth: '900px',
              margin: '0 auto',
              position: 'relative',
              zIndex: 1,
            }}
          >
            {/* 頂部標籤 */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                backgroundColor: '#dbeafe',
                color: '#1d4ed8',
                borderRadius: '30px',
                fontSize: '13px',
                fontWeight: 'bold',
                marginBottom: '26px',
              }}
            >
              <Sparkles size={16} />
              校園 P2P 技能交流平台
            </div>

            {/* 主標題 */}
            <h1
              style={{
                fontSize: 'clamp(32px, 5vw, 52px)',
                fontWeight: '900',
                lineHeight: 1.35,
                letterSpacing: '-1px',
                color: '#0f172a',
                margin: '0 0 24px',
              }}
            >
              你的專長，值得被看見。
              <br />
              <span
                style={{
                  background:
                    'linear-gradient(135deg, #2563eb, #7c3aed)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                你的好奇，值得被滿足。
              </span>
            </h1>

            {/* 平台介紹 */}
            <p
              style={{
                maxWidth: '650px',
                margin: '0 auto 32px',
                color: '#64748b',
                fontSize: '17px',
                lineHeight: 1.9,
              }}
            >
              在 YunBarter，你可以探索同學分享的技能課程，
              也能把自己的知識與專長分享給更多人。
              從尋找老師到安排授課時間，開啟你的校園技能交流旅程。
            </p>

            {/* 主要操作按鈕 */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                flexWrap: 'wrap',
                gap: '14px',
              }}
            >
              <Link
                to="/search"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '9px',
                  padding: '15px 30px',
                  borderRadius: '12px',
                  backgroundColor: '#0f172a',
                  color: 'white',
                  textDecoration: 'none',
                  fontSize: '15px',
                  fontWeight: 'bold',
                  boxShadow: '0 8px 20px rgba(15,23,42,0.15)',
                }}
              >
                <Search size={19} />
                探索課程
              </Link>

              <Link
                to="/register"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '9px',
                  padding: '15px 30px',
                  borderRadius: '12px',
                  backgroundColor: 'white',
                  border: '1px solid #cbd5e1',
                  color: '#0f172a',
                  textDecoration: 'none',
                  fontSize: '15px',
                  fontWeight: 'bold',
                }}
              >
                立即註冊
                <ArrowRight size={19} />
              </Link>
            </div>

            {/* 三個核心功能 */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
                gap: '14px',
                maxWidth: '720px',
                margin: '45px auto 0',
              }}
            >
              {[
                {
                  Icon: Search,
                  title: '尋找課程',
                  desc: '探索各種技能領域',
                },
                {
                  Icon: Repeat,
                  title: '分享專長',
                  desc: '成為老師分享知識',
                },
                {
                  Icon: BookOpen,
                  title: '交流學習',
                  desc: '向其他同學學習',
                },
              ].map(({ Icon, title, desc }) => (
                <div
                  key={title}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.9)',
                    border: '1px solid #e2e8f0',
                    borderRadius: '16px',
                    padding: '22px 15px',
                    boxShadow: '0 6px 20px rgba(15,23,42,0.035)',
                  }}
                >
                  <div
                    style={{
                      width: '46px',
                      height: '46px',
                      margin: '0 auto 12px',
                      backgroundColor: '#eff6ff',
                      borderRadius: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon size={23} color="#2563eb" />
                  </div>

                  <h3
                    style={{
                      margin: '0 0 7px',
                      fontSize: '16px',
                      color: '#0f172a',
                      fontWeight: '800',
                    }}
                  >
                    {title}
                  </h3>

                  <p
                    style={{
                      margin: 0,
                      fontSize: '12px',
                      color: '#64748b',
                      lineHeight: 1.6,
                    }}
                  >
                    {desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

      {/* ================= 第二區：平台核心特色 ================= */}
      <section
        style={{
          padding: '85px 20px',
          backgroundColor: '#ffffff',
        }}
      >
        <div style={{ maxWidth: '1150px', margin: '0 auto' }}>

          {/* 區塊標題 */}
          <div
            style={{
              textAlign: 'center',
              marginBottom: '48px',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                padding: '7px 15px',
                backgroundColor: '#eff6ff',
                borderRadius: '20px',
                color: '#2563eb',
                fontWeight: 'bold',
                fontSize: '12px',
                letterSpacing: '1px',
                marginBottom: '16px',
              }}
            >
              WHY YUNBARTER
            </span>

            <h2
              style={{
                fontSize: 'clamp(26px, 4vw, 34px)',
                fontWeight: '900',
                color: '#0f172a',
                margin: '0 0 15px',
                letterSpacing: '-0.5px',
              }}
            >
              為什麼選擇 YunBarter？
            </h2>

            <p
              style={{
                color: '#64748b',
                fontSize: '16px',
                lineHeight: 1.8,
                margin: 0,
              }}
            >
              讓技能交流更簡單，
              也讓每個人的專長被更多人看見。
            </p>
          </div>

          {/* 三張平台特色卡片 */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
              gap: '22px',
            }}
          >
            {[
              {
                number: '01',
                title: 'P2P 點對點技能媒合',
                description:
                  '不必透過傳統補習班，學生就能直接分享專長、尋找課程，讓知識在校園中自由交流。',
                Icon: Repeat,
                color: '#2563eb',
                background: '#dbeafe',
                label: '技能交流',
              },
              {
                number: '02',
                title: 'AI 智能文案輔助',
                description:
                  '不知道如何介紹自己的技能？透過 AI 文案輔助，協助整理課程特色，讓課程上架更輕鬆。',
                Icon: Zap,
                color: '#db2777',
                background: '#fce7f3',
                label: '智慧輔助',
              },
              {
                number: '03',
                title: 'Web3 區塊鏈交易設計',
                description:
                  '結合 MetaMask、SKILL 代幣與智慧合約託管機制，打造可追蹤的課程交易流程。',
                Icon: ShieldCheck,
                color: '#059669',
                background: '#dcfce7',
                label: '交易機制',
              },
            ].map((feature) => {
              const FeatureIcon = feature.Icon;

              return (
                <article
                  key={feature.number}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '20px',
                    overflow: 'hidden',
                    boxShadow: '0 5px 20px rgba(15,23,42,0.04)',
                    transition:
                      'transform 0.25s ease, box-shadow 0.25s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    minWidth: 0,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform =
                      'translateY(-6px)';
                    e.currentTarget.style.boxShadow =
                      '0 16px 36px rgba(15,23,42,0.10)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform =
                      'translateY(0)';
                    e.currentTarget.style.boxShadow =
                      '0 5px 20px rgba(15,23,42,0.04)';
                  }}
                >
                  {/* 頂部裝飾線 */}
                  <div
                    style={{
                      height: '5px',
                      backgroundColor: feature.color,
                    }}
                  />

                  {/* 卡片內容 */}
                  <div
                    style={{
                      padding: '30px',
                      display: 'flex',
                      flexDirection: 'column',
                      flexGrow: 1,
                    }}
                  >
                    {/* 圖示與編號 */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '26px',
                      }}
                    >
                      <div
                        style={{
                          width: '64px',
                          height: '64px',
                          borderRadius: '18px',
                          backgroundColor: feature.background,
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}
                      >
                        <FeatureIcon
                          size={30}
                          color={feature.color}
                          strokeWidth={2}
                        />
                      </div>

                      <span
                        style={{
                          color: '#cbd5e1',
                          fontSize: '28px',
                          fontWeight: '900',
                        }}
                      >
                        {feature.number}
                      </span>
                    </div>

                    {/* 特色分類 */}
                    <span
                      style={{
                        color: feature.color,
                        fontSize: '12px',
                        fontWeight: 'bold',
                        marginBottom: '10px',
                      }}
                    >
                      {feature.label}
                    </span>

                    {/* 特色標題 */}
                    <h3
                      style={{
                        color: '#0f172a',
                        fontSize: '19px',
                        fontWeight: '800',
                        margin: '0 0 14px',
                        lineHeight: 1.5,
                      }}
                    >
                      {feature.title}
                    </h3>

                    {/* 特色介紹 */}
                    <p
                      style={{
                        color: '#64748b',
                        fontSize: '14px',
                        lineHeight: 1.9,
                        margin: 0,
                        flexGrow: 1,
                      }}
                    >
                      {feature.description}
                    </p>

                    {/* 底部分隔線 */}
                    <div
                      style={{
                        height: '1px',
                        backgroundColor: '#f1f5f9',
                        marginTop: '26px',
                      }}
                    />

                    <div
                      style={{
                        marginTop: '16px',
                        fontSize: '12px',
                        color: '#94a3b8',
                        fontWeight: 'bold',
                        letterSpacing: '0.5px',
                      }}
                    >
                      YUNBARTER · FEATURE {feature.number}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= 第三區：技能交換三步驟 ================= */}
      <section
        style={{
          padding: '90px 20px',
          background:
            'linear-gradient(180deg, #f8fafc 0%, #eff6ff 100%)',
        }}
      >
        <div
          style={{
            maxWidth: '1150px',
            margin: '0 auto',
          }}
        >
          {/* 區塊標題 */}
          <div
            style={{
              textAlign: 'center',
              marginBottom: '50px',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                padding: '7px 16px',
                backgroundColor: '#dbeafe',
                color: '#2563eb',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 'bold',
                letterSpacing: '1px',
                marginBottom: '18px',
              }}
            >
              HOW IT WORKS
            </span>

            <h2
              style={{
                fontSize: 'clamp(26px, 4vw, 34px)',
                fontWeight: '900',
                color: '#0f172a',
                margin: '0 0 16px',
                letterSpacing: '-0.5px',
              }}
            >
              簡單三步，開啟技能交換
            </h2>

            <p
              style={{
                color: '#64748b',
                fontSize: '16px',
                lineHeight: 1.8,
                margin: 0,
              }}
            >
              從探索課程到完成學習，
              YunBarter 讓技能交流變得更簡單。
            </p>
          </div>

          {/* 三步驟流程卡片 */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
              gap: '24px',
              alignItems: 'stretch',
            }}
          >
            {[
              {
                number: '01',
                title: '探索與分享技能',
                description:
                  '瀏覽同學上架的課程，尋找感興趣的技能。你也可以設定授課時間，分享自己的專長。',
                Icon: BookOpen,
                color: '#2563eb',
                background: '#dbeafe',
                tag: '探索技能',
              },
              {
                number: '02',
                title: '選擇時段並預約',
                description:
                  '選擇老師開放的授課時段，依照平台流程使用 SKILL 代幣預約課程。',
                Icon: CircleDollarSign,
                color: '#7c3aed',
                background: '#f3e8ff',
                tag: '課程預約',
              },
              {
                number: '03',
                title: '完成技能交流',
                description:
                  '依照約定時間與同學交流學習，並透過預約管理查看課程狀態及後續流程。',
                Icon: Sparkles,
                color: '#059669',
                background: '#dcfce7',
                tag: '學習交流',
              },
            ].map((step, index) => {
              const StepIcon = step.Icon;

              return (
                <article
                  key={step.number}
                  style={{
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '22px',
                    padding: '30px',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    minWidth: 0,
                    boxShadow: '0 8px 24px rgba(15,23,42,0.05)',
                    transition:
                      'transform 0.25s ease, box-shadow 0.25s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform =
                      'translateY(-6px)';
                    e.currentTarget.style.boxShadow =
                      '0 18px 36px rgba(15,23,42,0.10)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform =
                      'translateY(0)';
                    e.currentTarget.style.boxShadow =
                      '0 8px 24px rgba(15,23,42,0.05)';
                  }}
                >
                  {/* 圖示與步驟編號 */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      marginBottom: '28px',
                    }}
                  >
                    <div
                      style={{
                        width: '66px',
                        height: '66px',
                        borderRadius: '18px',
                        backgroundColor: step.background,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <StepIcon
                        size={30}
                        color={step.color}
                        strokeWidth={2}
                      />
                    </div>

                    <div
                      style={{
                        fontSize: '42px',
                        fontWeight: '900',
                        color: '#e2e8f0',
                        lineHeight: 1,
                      }}
                    >
                      {step.number}
                    </div>
                  </div>

                  {/* 步驟分類 */}
                  <span
                    style={{
                      display: 'inline-block',
                      alignSelf: 'flex-start',
                      padding: '6px 12px',
                      backgroundColor: step.background,
                      color: step.color,
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      marginBottom: '17px',
                    }}
                  >
                    STEP {step.number} · {step.tag}
                  </span>

                  {/* 步驟標題 */}
                  <h3
                    style={{
                      fontSize: '20px',
                      fontWeight: '800',
                      color: '#0f172a',
                      margin: '0 0 14px',
                      lineHeight: 1.4,
                    }}
                  >
                    {step.title}
                  </h3>

                  {/* 步驟說明 */}
                  <p
                    style={{
                      color: '#64748b',
                      fontSize: '14px',
                      lineHeight: 1.9,
                      margin: '0 0 26px',
                      flexGrow: 1,
                    }}
                  >
                    {step.description}
                  </p>

                  {/* 底部流程標示 */}
                  <div
                    style={{
                      borderTop: '1px solid #f1f5f9',
                      paddingTop: '19px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span
                      style={{
                        color: '#94a3b8',
                        fontSize: '12px',
                        fontWeight: 'bold',
                      }}
                    >
                      {index === 2
                        ? '完成流程'
                        : '接續下一步'}
                    </span>

                    <div
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '50%',
                        backgroundColor: step.background,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {index === 2 ? (
                        <Sparkles
                          size={16}
                          color={step.color}
                        />
                      ) : (
                        <ArrowRight
                          size={17}
                          color={step.color}
                        />
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* 流程區域底部操作按鈕 */}
          <div
            style={{
              textAlign: 'center',
              marginTop: '45px',
            }}
          >
            <Link
              to="/search"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                padding: '15px 30px',
                backgroundColor: '#2563eb',
                color: 'white',
                borderRadius: '12px',
                textDecoration: 'none',
                fontSize: '15px',
                fontWeight: 'bold',
                boxShadow: '0 8px 22px rgba(37,99,235,0.16)',
              }}
            >
              <Search size={19} />
              開始探索課程
              <ArrowRight size={18} />
            </Link>

            <p
              style={{
                margin: '16px 0 0',
                color: '#94a3b8',
                fontSize: '13px',
              }}
            >
              先瀏覽感興趣的課程，再開始你的技能交流旅程。
            </p>
          </div>
        </div>
      </section>

      {/* ================= 第四區：加入 YunBarter ================= */}
      <section
        style={{
          background:
            'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
          padding: '85px 20px',
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 背景裝飾 */}
        <div
          style={{
            position: 'absolute',
            width: '380px',
            height: '380px',
            borderRadius: '50%',
            right: '-130px',
            top: '-170px',
            background: 'rgba(59,130,246,0.1)',
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            maxWidth: '1120px',
            margin: '0 auto',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(min(100%, 350px), 1fr))',
              gap: '45px',
              alignItems: 'center',
            }}
          >
            {/* 左側：品牌與行動呼籲 */}
            <div>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#93c5fd',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  letterSpacing: '1px',
                  marginBottom: '20px',
                }}
              >
                <Sparkles size={16} />
                START YOUR JOURNEY
              </span>

              <h2
                style={{
                  fontSize: 'clamp(29px, 4vw, 42px)',
                  fontWeight: '900',
                  lineHeight: 1.35,
                  margin: '0 0 22px',
                  letterSpacing: '-0.5px',
                }}
              >
                不只學習，
                <br />
                <span style={{ color: '#93c5fd' }}>
                  也能分享你的專長。
                </span>
              </h2>

              <p
                style={{
                  maxWidth: '470px',
                  fontSize: '16px',
                  color: '#cbd5e1',
                  lineHeight: 1.9,
                  margin: '0 0 26px',
                }}
              >
                在 YunBarter，你可以是學生，也可以是老師。
                探索感興趣的技能課程，
                或分享自己的知識與專長，
                讓每一次交流都成為新的學習機會。
              </p>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '12px',
                  alignItems: 'center',
                  fontSize: '13px',
                  color: '#cbd5e1',
                }}
              >
                <span style={{
                  padding: '7px 12px',
                  borderRadius: '20px',
                  border: '1px solid rgba(255,255,255,0.18)',
                }}>
                  P2P 技能交流
                </span>

                <span style={{
                  padding: '7px 12px',
                  borderRadius: '20px',
                  border: '1px solid rgba(255,255,255,0.18)',
                }}>
                  校園課程媒合
                </span>

                <span style={{
                  padding: '7px 12px',
                  borderRadius: '20px',
                  border: '1px solid rgba(255,255,255,0.18)',
                }}>
                  SKILL 代幣
                </span>
              </div>
            </div>

            {/* 右側：兩種使用者入口 */}
            <div
              style={{
                display: 'grid',
                gap: '16px',
              }}
            >
              {/* 學習者入口 */}
              <Link
                to="/search"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '18px',
                  backgroundColor: 'white',
                  padding: '23px',
                  borderRadius: '18px',
                  textDecoration: 'none',
                  color: '#0f172a',
                  boxShadow: '0 12px 30px rgba(0,0,0,0.1)',
                  transition: 'transform 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform =
                    'translateY(-4px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform =
                    'translateY(0)';
                }}
              >
                <div
                  style={{
                    width: '58px',
                    height: '58px',
                    backgroundColor: '#dbeafe',
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Search size={27} color="#2563eb" />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3
                    style={{
                      margin: '0 0 6px',
                      fontSize: '20px',
                      fontWeight: '800',
                    }}
                  >
                    我想學習
                  </h3>

                  <p
                    style={{
                      margin: '0 0 8px',
                      color: '#64748b',
                      fontSize: '13px',
                      lineHeight: 1.6,
                    }}
                  >
                    探索同學分享的技能課程
                  </p>

                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      color: '#2563eb',
                      fontSize: '13px',
                      fontWeight: 'bold',
                    }}
                  >
                    探索課程
                    <ArrowRight size={15} />
                  </span>
                </div>
              </Link>

              {/* 分享者入口 */}
              <Link
                to="/register"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '18px',
                  backgroundColor: 'white',
                  padding: '23px',
                  borderRadius: '18px',
                  textDecoration: 'none',
                  color: '#0f172a',
                  boxShadow: '0 12px 30px rgba(0,0,0,0.1)',
                  transition: 'transform 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform =
                    'translateY(-4px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform =
                    'translateY(0)';
                }}
              >
                <div
                  style={{
                    width: '58px',
                    height: '58px',
                    backgroundColor: '#f3e8ff',
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <BookOpen size={27} color="#7c3aed" />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3
                    style={{
                      margin: '0 0 6px',
                      fontSize: '20px',
                      fontWeight: '800',
                    }}
                  >
                    我想分享
                  </h3>

                  <p
                    style={{
                      margin: '0 0 8px',
                      color: '#64748b',
                      fontSize: '13px',
                      lineHeight: 1.6,
                    }}
                  >
                    註冊會員，開始分享你的專長
                  </p>

                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      color: '#7c3aed',
                      fontSize: '13px',
                      fontWeight: 'bold',
                    }}
                  >
                    立即加入
                    <ArrowRight size={15} />
                  </span>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ================= Footer ================= */}
      <footer
        style={{
          backgroundColor: '#020617',
          color: '#94a3b8',
          padding: '35px 20px',
        }}
      >
        <div
          style={{
            maxWidth: '1120px',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '20px',
          }}
        >
          {/* 品牌資訊 */}
          <div>
            <Link
              to="/"
              style={{
                color: '#ffffff',
                textDecoration: 'none',
                fontSize: '21px',
                fontWeight: '900',
                letterSpacing: '-0.5px',
              }}
            >
              YunBarter
            </Link>

            <p
              style={{
                margin: '8px 0 0',
                fontSize: '13px',
                lineHeight: 1.7,
              }}
            >
              分享技能，連結彼此。
              <br />
              讓知識在校園中持續流動。
            </p>
          </div>

          {/* 快速導覽 */}
          <nav
            aria-label="頁尾導覽"
            style={{
              display: 'flex',
              gap: '22px',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            {/* 探索課程 */}
            <Link
              to="/search"
              style={{
                color: '#cbd5e1',
                textDecoration: 'none',
                fontSize: '14px',
              }}
            >
              探索課程
            </Link>

            {/* 會員登入：進入登入畫面 */}
            <Link
              to="/login"
              style={{
                color: '#cbd5e1',
                textDecoration: 'none',
                fontSize: '14px',
              }}
            >
              會員登入
            </Link>

            {/* 免費註冊：進入註冊畫面 */}
            <Link
              to="/register"
              style={{
                color: '#cbd5e1',
                textDecoration: 'none',
                fontSize: '14px',
              }}
            >
              免費註冊
            </Link>
          </nav>
        </div>

        <div
          style={{
            maxWidth: '1120px',
            margin: '26px auto 0',
            paddingTop: '20px',
            borderTop: '1px solid #1e293b',
            fontSize: '12px',
            textAlign: 'center',
            color: '#64748b',
          }}
        >
          © 2026 YunBarter · P2P Freelance Platform Project
        </div>
      </footer>

    </div>
  );
}