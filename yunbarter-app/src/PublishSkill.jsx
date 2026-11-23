import { apiFetch } from './services/api';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, BookOpen, CircleDollarSign, Tags, AlignLeft, Send, Loader2 } from 'lucide-react';

const referenceLabels = { similar: '相似', category: '同類別', catalog: '全站' };
const priceFormat = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 6 });
const categoryLabels = {
  程式: '程式開發',
  語言: '語言學習',
  音樂: '音樂藝術',
  設計: '視覺設計',
  運動: '健身運動',
  飲食: '飲食',
  影像: '影像',
  手作: '手作',
  職場: '職場',
  園藝: '園藝',
  生活: '生活',
  綜合: '其他綜合',
};

export default function PublishSkill({ onAddTeacher, showNotification }) {
  const navigate = useNavigate();

  const [skill, setSkill] = useState('');
  const [category, setCategory] = useState('程式');
  const [price, setPrice] = useState('1');
  const [description, setDescription] = useState('');
  const [pricing, setPricing] = useState(null);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiStyle, setAiStyle] = useState('幽默風趣');
  const generationRequest = useRef(null);

  useEffect(() => () => {
    const request = generationRequest.current;
    generationRequest.current = null;
    request?.abort();
  }, []);

  const updateDraft = (setter, value, clearPricing = false) => {
    const request = generationRequest.current;
    if (request) {
      generationRequest.current = null;
      request.abort();
      setIsGenerating(false);
    }
    setter(value);
    if (clearPricing) setPricing(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!skill.trim()) {
      // 🌟 替換為高級通知
      showNotification('warning', '資料不完整', '請輸入技能名稱！');
      return;
    }

    if (isSubmitting || generationRequest.current) return;
    setIsSubmitting(true);
    try {
      await onAddTeacher(skill, Number(price), category, description);
      showNotification('success', '上架成功', `成功上架「${skill}」課程！`);
      navigate('/profile');
    } catch (error) {
      showNotification('error', '上架失敗', error.message || '無法新增課程');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAIGenerate = async () => {
    if (generationRequest.current || isSubmitting) return;
    if (!skill.trim()) {
      showNotification('warning', '請先輸入課程名稱', '輸入簡短的課程主題即可產生完整草稿。');
      return;
    }

    const request = new AbortController();
    generationRequest.current = request;
    setIsGenerating(true);
    try {
      const response = await apiFetch('/api/ai/generate', {
        method: 'POST',
        signal: request.signal,
        body: JSON.stringify({ skill: skill.trim(), style: aiStyle, description }),
      });
      const data = await response.json().catch(() => null);
      if (generationRequest.current !== request) return;

      if (!response.ok) {
        if (response.status === 401) window.dispatchEvent(new Event('yunbarter:unauthorized'));
        showNotification('error', '生成失敗', data?.error || '暫時無法產生課程草稿，請稍後再試。');
        return;
      }
      if (typeof data?.title !== 'string' || !data.title.trim()
        || typeof data.description !== 'string' || !data.description.trim()
        || typeof data.category !== 'string' || !Object.hasOwn(categoryLabels, data.category)
        || !Number.isFinite(data.price) || data.price < 0.1 || data.price > 1e9) {
        showNotification('error', '生成失敗', 'AI 回傳的課程資料不完整，請再試一次。');
        return;
      }
      setSkill(data.title);
      setCategory(data.category);
      setDescription(data.description);
      setPrice(String(data.price));
      setPricing({ ...data.pricing, suggestedPrice: data.price });
      showNotification('success', '草稿已生成', '可確認或調整草稿內容，再發布課程。');
    } catch {
      if (generationRequest.current === request) {
        showNotification('error', '連線異常', '暫時無法連線產生課程草稿，請稍後再試。');
      }
    } finally {
      if (generationRequest.current === request) {
        generationRequest.current = null;
        setIsGenerating(false);
      }
    }
  };

  return (
    <div className="yb-publish-page" style={{ backgroundColor: '#f4f7f6', minHeight: 'calc(100vh - 70px)', padding: '60px 20px', fontFamily: 'sans-serif', display: 'flex', justifyContent: 'center' }}>
      {/* ===== Step 5.7：發佈技能手機版 RWD ===== */}
      <style>{`
        @media (max-width: 768px) {

          /* 頁面整體留白 */
          .yb-publish-page {
            padding: 24px 14px 40px !important;
            box-sizing: border-box;
            min-width: 0;
            overflow-x: clip;
          }

          /* 主內容寬度 */
          .yb-publish-container {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0;
            box-sizing: border-box;
          }

          /* 表單白色卡片 */
          .yb-publish-card {
            padding: 22px 18px !important;
            border-radius: 16px !important;
            min-width: 0;
            box-sizing: border-box;
          }

          /* 表單各欄位間距 */
          .yb-publish-card form {
            gap: 22px !important;
            min-width: 0;
          }

          /* 類別與定價改成上下排列 */
          .yb-publish-fields {
            flex-direction: column !important;
            gap: 20px !important;
            min-width: 0;
          }

          .yb-publish-fields > div {
            flex: 0 0 auto !important;
            width: 100% !important;
            min-width: 0 !important;
            box-sizing: border-box;
          }

          /* 生成提示與操作區上下排列 */
          .yb-publish-ai-header {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 14px !important;
          }

          .yb-publish-ai-header > p {
            flex: none !important;
          }

          /* AI 風格與生成按鈕改成上下排列 */
          .yb-publish-ai-controls {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr);
            width: 100%;
            min-width: 0;
            gap: 10px !important;
          }

          .yb-publish-ai-controls select {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            padding: 13px !important;
            font-size: 16px !important;
            box-sizing: border-box;
          }

          .yb-publish-ai-controls button {
            width: 100% !important;
            min-height: 46px;
            justify-content: center;
            font-size: 14px !important;
            box-sizing: border-box;
          }

          /* 手機輸入框 */
          .yb-publish-card input,
          .yb-publish-card select,
          .yb-publish-card textarea {
            max-width: 100%;
            min-width: 0;
            box-sizing: border-box;
            font-size: 16px !important;
          }

          /* 提交按鈕 */
          .yb-publish-card button[type="submit"] {
            min-height: 50px;
            touch-action: manipulation;
          }

          /* 防止長文字撐破 */
          .yb-publish-page h2,
          .yb-publish-card label,
          .yb-publish-card p {
            overflow-wrap: anywhere;
          }

          .yb-publish-page h2 {
            font-size: 27px !important;
          }
        }

        /* 特別窄的手機 */
        @media (max-width: 360px) {
          .yb-publish-page {
            padding: 18px 10px 30px !important;
          }

          .yb-publish-card {
            padding: 18px 14px !important;
          }

          .yb-publish-page h2 {
            font-size: 24px !important;
          }
        }
      `}</style>
      <div className="yb-publish-container" style={{ width: '100%', maxWidth: '750px' }}>
        
        {/* 頂部標題區 */}
        <div style={{ textAlign: 'center', marginBottom: '35px' }}>
          <h2 style={{ fontSize: '32px', color: '#0f172a', margin: '0 0 10px 0', fontWeight: '900' }}>將你的天賦變現</h2>
          <p style={{ fontSize: '16px', color: '#64748b', margin: 0 }}>上架技能課程，賺取 SKILL 代幣，與社群互助成長</p>
        </div>

        {/* 核心表單大卡片 (已優化內邊距與整體呼吸感) */}
        <div className="yb-publish-card" style={{ backgroundColor: 'white', borderRadius: '16px', padding: '45px', boxShadow: '0 10px 30px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0', boxSizing: 'border-box' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            
            {/* 技能名稱 */}
            <div>
              <label htmlFor="publish-course-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', color: '#334155', fontWeight: 'bold', marginBottom: '10px' }}>
                <BookOpen size={18} color="#3498db" /> 課程名稱 (你想教什麼？)
              </label>
              <input 
                id="publish-course-title"
                type="text" 
                value={skill} 
                onChange={(e) => updateDraft(setSkill, e.target.value, true)}
                maxLength={200}
                aria-describedby="publish-course-title-help"
                placeholder="例：從零開始的日文 N3 檢定班" 
                style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: '15px', color: '#0f172a', boxSizing: 'border-box', outlineColor: '#3498db', transition: 'all 0.2s' }} 
                required 
              />
              <div className="yb-publish-ai-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap', gap: '10px' }}>
                <p id="publish-course-title-help" style={{ flex: '1 1 200px', margin: 0, fontSize: '13px', lineHeight: 1.5, color: '#475569' }}>
                  填入課程名稱即可一鍵生成標題、類別、說明與建議價格。
                </p>
                <div className="yb-publish-ai-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <select
                    aria-label="AI 文案風格"
                    value={aiStyle}
                    onChange={(e) => updateDraft(setAiStyle, e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontSize: '13px', color: '#475569', outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="幽默風趣">幽默風趣 (適合輕鬆才藝)</option>
                    <option value="熱血推銷">熱血推銷 (適合衝刺班)</option>
                    <option value="專業嚴謹">專業嚴謹 (適合專業技能)</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleAIGenerate}
                    disabled={isGenerating || isSubmitting}
                    style={{ padding: '8px 14px', background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', cursor: isGenerating || isSubmitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'opacity 0.2s', opacity: isGenerating || isSubmitting ? 0.7 : 1, boxShadow: '0 2px 4px rgba(168, 85, 247, 0.15)' }}
                  >
                    {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    {isGenerating ? '正在生成…' : '一鍵 AI 生成'}
                  </button>
                </div>
              </div>
            </div>

            {/* 雙欄位：類別與定價 */}
            <div className="yb-publish-fields" style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label htmlFor="publish-course-category" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', color: '#334155', fontWeight: 'bold', marginBottom: '10px' }}>
                  <Tags size={18} color="#9b59b6" /> 技能類別
                </label>
                <select 
                  id="publish-course-category"
                  value={category} 
                  onChange={(e) => updateDraft(setCategory, e.target.value, true)}
                  style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: '15px', color: '#0f172a', outlineColor: '#3498db', cursor: 'pointer' }}
                >
                  {Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label htmlFor="publish-course-price" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', color: '#334155', fontWeight: 'bold', marginBottom: '10px' }}>
                  <CircleDollarSign size={18} color="#d97706" /> 課程定價 (SKILL)
                </label>
                <div style={{ position: 'relative' }}>
                  <input 
                    id="publish-course-price"
                    type="number" 
                    min="0.1" 
                    max="1000000000"
                    step="0.1" 
                    value={price} 
                    onChange={(e) => updateDraft(setPrice, e.target.value)}
                    aria-describedby={pricing ? 'publish-course-pricing-reference' : undefined}
                    style={{ width: '100%', padding: '14px 16px 14px 45px', borderRadius: '12px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: '15px', color: '#0f172a', boxSizing: 'border-box', outlineColor: '#3498db' }} 
                    required 
                  />
                  <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
                    <CircleDollarSign size={16} color="#d97706" />
                  </span>
                </div>
                {pricing && (
                  <p id="publish-course-pricing-reference" role="status" style={{ margin: '8px 0 0', fontSize: '13px', lineHeight: 1.5, color: '#475569' }}>
                    {pricing.referenceCount > 0
                      ? `AI 建議 ${priceFormat.format(pricing.suggestedPrice)} SKILL。參考 ${pricing.referenceCount} 堂${referenceLabels[pricing.basis] || '已上架'}課程，中位數 ${priceFormat.format(pricing.median)} SKILL。`
                      : `AI 起始建議 ${priceFormat.format(pricing.suggestedPrice)} SKILL，依課程內容估算。`}
                  </p>
                )}
              </div>
            </div>

            {/* 課程詳細說明 */}
            <div>
              <label htmlFor="publish-course-description" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', color: '#334155', fontWeight: 'bold', marginBottom: '10px' }}>
                <AlignLeft size={18} color="#10b981" /> 課程詳細說明
              </label>

              <textarea 
                id="publish-course-description"
                value={description} 
                onChange={(e) => updateDraft(setDescription, e.target.value)}
                maxLength={10000}
                placeholder="填寫課程重點、適合對象或需要準備的物品，也可交給 AI 整理成草稿。"
                rows="7" 
                style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: '15px', color: '#0f172a', boxSizing: 'border-box', resize: 'vertical', outlineColor: '#3498db', lineHeight: '1.6' }} 
              />
            </div>

            {/* 提交按鈕 (拉開與上方區塊的間距，強化呼吸感) */}
            <div style={{ marginTop: '12px' }}>
              <button 
                type="submit" 
                disabled={isSubmitting || isGenerating}
                style={{ width: '100%', padding: '16px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', boxShadow: '0 10px 20px -5px rgba(15, 23, 42, 0.25)', transition: 'background-color 0.2s' }}
                onMouseOver={e => e.currentTarget.style.backgroundColor = '#1e293b'}
                onMouseOut={e => e.currentTarget.style.backgroundColor = '#0f172a'}
              >
                <Send size={18} />
                {isSubmitting ? '正在儲存課程...' : '發佈課程上架'}
              </button>
            </div>

          </form>
        </div>

      </div>
    </div>
  );
}
