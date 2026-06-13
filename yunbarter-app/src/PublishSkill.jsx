import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, BookOpen, CircleDollarSign, Tags, AlignLeft, Send, Loader2 } from 'lucide-react';

// 🌟 接收來自 App.jsx 的 showNotification
export default function PublishSkill({ onAddTeacher, showNotification }) {
  const navigate = useNavigate();

  const [skill, setSkill] = useState('');
  const [category, setCategory] = useState('程式');
  const [price, setPrice] = useState(1.0);
  const [description, setDescription] = useState('');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiStyle, setAiStyle] = useState('幽默風趣'); 

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!skill.trim()) {
      // 🌟 替換為高級通知
      showNotification('warning', '資料不完整', '請輸入技能名稱！');
      return;
    }

    onAddTeacher(skill, price, category);
    // 🌟 替換為高級通知
    showNotification('success', '上架成功', `成功上架「${skill}」課程！開始賺取 YTC 吧！`);
    navigate('/profile'); 
  };

  const handleAIGenerate = async () => {
    if (!skill.trim()) {
      // 🌟 替換為高級通知
      showNotification('warning', '提示', '請先在上方輸入「課程名稱」，AI 才知道要幫你寫什麼喔！');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('http://localhost:5000/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skill, style: aiStyle })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSkill(data.title);
        setDescription(data.description);
        setPrice(parseFloat(data.price)); 
        showNotification('success', '生成完成', '已自動為您填入優化後的標題與詳細說明！');
      } else {
        showNotification('error', '生成失敗', data.error || "未知錯誤");
      }
    } catch (error) {
      console.error("AI 伺服器連線錯誤:", error);
      showNotification('error', '連線異常', '無法連線至 AI 伺服器，請確認後端已啟動。');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#f4f7f6', minHeight: 'calc(100vh - 70px)', padding: '60px 20px', fontFamily: 'sans-serif', display: 'flex', justifyContent: 'center' }}>
      
      <div style={{ width: '100%', maxWidth: '750px' }}>
        
        {/* 頂部標題區 */}
        <div style={{ textAlign: 'center', marginBottom: '35px' }}>
          <h2 style={{ fontSize: '32px', color: '#0f172a', margin: '0 0 10px 0', fontWeight: '900' }}>將你的天賦變現</h2>
          <p style={{ fontSize: '16px', color: '#64748b', margin: 0 }}>上架技能課程，賺取 YTC 代幣，與社群互助成長</p>
        </div>

        {/* 核心表單大卡片 (已優化內邊距與整體呼吸感) */}
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '45px', boxShadow: '0 10px 30px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0', boxSizing: 'border-box' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            
            {/* 技能名稱 */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', color: '#334155', fontWeight: 'bold', marginBottom: '10px' }}>
                <BookOpen size={18} color="#3498db" /> 課程名稱 (你想教什麼？)
              </label>
              <input 
                type="text" 
                value={skill} 
                onChange={(e) => setSkill(e.target.value)} 
                placeholder="例：從零開始的日文 N3 檢定班" 
                style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: '15px', color: '#0f172a', boxSizing: 'border-box', outlineColor: '#3498db', transition: 'all 0.2s' }} 
                required 
              />
            </div>

            {/* 雙欄位：類別與定價 */}
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', color: '#334155', fontWeight: 'bold', marginBottom: '10px' }}>
                  <Tags size={18} color="#9b59b6" /> 技能類別
                </label>
                <select 
                  value={category} 
                  onChange={(e) => setCategory(e.target.value)} 
                  style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: '15px', color: '#0f172a', outlineColor: '#3498db', cursor: 'pointer' }}
                >
                  <option value="程式">程式開發</option>
                  <option value="語言">語言學習</option>
                  <option value="音樂">音樂藝術</option>
                  <option value="設計">視覺設計</option>
                  <option value="運動">健身運動</option>
                  <option value="綜合">其他綜合</option>
                </select>
              </div>
              
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', color: '#334155', fontWeight: 'bold', marginBottom: '10px' }}>
                  <CircleDollarSign size={18} color="#d97706" /> 課程定價 (YTC)
                </label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="number" 
                    min="0.1" 
                    step="0.1" 
                    value={price} 
                    onChange={(e) => setPrice(parseFloat(e.target.value))} 
                    style={{ width: '100%', padding: '14px 16px 14px 45px', borderRadius: '12px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: '15px', color: '#0f172a', boxSizing: 'border-box', outlineColor: '#3498db' }} 
                    required 
                  />
                  <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
                    <CircleDollarSign size={16} color="#d97706" />
                  </span>
                </div>
              </div>
            </div>

            {/* 內嵌式 AI 智慧說明欄位 */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', color: '#334155', fontWeight: 'bold' }}>
                  <AlignLeft size={18} color="#10b981" /> 課程詳細說明
                </div>
                
                {/* 整合在右側的 AI 控制版面 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <select 
                    value={aiStyle} 
                    onChange={(e) => setAiStyle(e.target.value)} 
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontSize: '13px', color: '#475569', outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="幽默風趣">幽默風趣 (適合輕鬆才藝)</option>
                    <option value="熱血推銷">熱血推銷 (適合衝刺班)</option>
                    <option value="專業嚴謹">專業嚴謹 (適合專業技能)</option>
                  </select>
                  
                  <button 
                    type="button" 
                    onClick={handleAIGenerate}
                    disabled={isGenerating}
                    style={{ padding: '8px 14px', background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', cursor: isGenerating ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'opacity 0.2s', opacity: isGenerating ? 0.7 : 1, boxShadow: '0 2px 4px rgba(168, 85, 247, 0.15)' }}
                  >
                    {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    {isGenerating ? '魔法生成中...' : '一鍵 AI 生成'}
                  </button>
                </div>
              </div>

              <textarea 
                value={description} 
                onChange={(e) => setDescription(e.target.value)} 
                placeholder="詳細介紹這堂課會教些什麼、適合什麼樣的學生... 或者利用右側的一鍵 AI 功能自動生成精彩介紹！" 
                rows="7" 
                style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: '15px', color: '#0f172a', boxSizing: 'border-box', resize: 'vertical', outlineColor: '#3498db', lineHeight: '1.6' }} 
              />
            </div>

            {/* 提交按鈕 (拉開與上方區塊的間距，強化呼吸感) */}
            <div style={{ marginTop: '12px' }}>
              <button 
                type="submit" 
                style={{ width: '100%', padding: '16px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', boxShadow: '0 10px 20px -5px rgba(15, 23, 42, 0.25)', transition: 'background-color 0.2s' }}
                onMouseOver={e => e.currentTarget.style.backgroundColor = '#1e293b'}
                onMouseOut={e => e.currentTarget.style.backgroundColor = '#0f172a'}
              >
                <Send size={18} />
                發佈課程上架
              </button>
            </div>

          </form>
        </div>

      </div>
    </div>
  );
}