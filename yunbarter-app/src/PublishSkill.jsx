import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
// 🌟 引入頂級線條圖示
import { Sparkles, BookOpen, Coins, Tags, AlignLeft, Send, Loader2 } from 'lucide-react';

export default function PublishSkill({ onAddTeacher }) {
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
      alert("請輸入技能名稱！");
      return;
    }

    onAddTeacher(skill, price, category);
    alert(`✅ 成功上架「${skill}」課程！開始賺取 YTC 吧！`);
    navigate('/profile'); 
  };

  const handleAIGenerate = async () => {
    if (!skill.trim()) {
      alert("💡 請先在上方輸入「課程名稱」（例如：Python 爬蟲），AI 才知道要幫你寫什麼喔！");
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
      } else {
        alert("AI 生成失敗：" + (data.error || "未知錯誤"));
      }
    } catch (error) {
      console.error("AI 伺服器連線錯誤:", error);
      alert("無法連線至 AI 伺服器，請確認後端已啟動。");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#f4f7f6', minHeight: 'calc(100vh - 70px)', padding: '50px 20px', fontFamily: 'sans-serif' }}>
      
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        
        {/* 頂部標題區 */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h2 style={{ fontSize: '32px', color: '#0f172a', margin: '0 0 10px 0', fontWeight: '900' }}>將你的天賦變現</h2>
          <p style={{ fontSize: '16px', color: '#64748b', margin: 0 }}>上架技能課程，賺取 YTC 代幣，與社群互助成長</p>
        </div>

        <div style={{ display: 'flex', gap: '30px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          
          {/* 左側：表單區 */}
          <div style={{ flex: '1', minWidth: '400px', backgroundColor: 'white', borderRadius: '20px', padding: '40px', boxShadow: '0 10px 30px rgba(0,0,0,0.04)' }}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
              
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
                  style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: '16px', color: '#0f172a', boxSizing: 'border-box', outlineColor: '#3498db', transition: 'all 0.2s' }} 
                  required 
                />
              </div>

              {/* 雙欄位：類別與定價 */}
              <div style={{ display: 'flex', gap: '20px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', color: '#334155', fontWeight: 'bold', marginBottom: '10px' }}>
                    <Tags size={18} color="#9b59b6" /> 技能類別
                  </label>
                  {/* 🌟 拔除 Emoji，保持純文字的乾淨專業感 */}
                  <select 
                    value={category} 
                    onChange={(e) => setCategory(e.target.value)} 
                    style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: '16px', color: '#0f172a', outlineColor: '#3498db', cursor: 'pointer' }}
                  >
                    <option value="程式">程式開發</option>
                    <option value="語言">語言學習</option>
                    <option value="音樂">音樂藝術</option>
                    <option value="設計">視覺設計</option>
                    <option value="運動">健身運動</option>
                    <option value="綜合">其他綜合</option>
                  </select>
                </div>
                
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', color: '#334155', fontWeight: 'bold', marginBottom: '10px' }}>
                    <Coins size={18} color="#d97706" /> 課程定價 (YTC)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type="number" 
                      min="0.1" 
                      step="0.1" 
                      value={price} 
                      onChange={(e) => setPrice(parseFloat(e.target.value))} 
                      style={{ width: '100%', padding: '14px 16px 14px 45px', borderRadius: '12px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: '16px', color: '#0f172a', boxSizing: 'border-box', outlineColor: '#3498db' }} 
                      required 
                    />
                    {/* 🌟 替換為 Lucide 線條圖示 */}
                    <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
                      <Coins size={16} color="#d97706" />
                    </span>
                  </div>
                </div>
              </div>

              {/* 課程說明 */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', color: '#334155', fontWeight: 'bold' }}>
                    <AlignLeft size={18} color="#10b981" /> 課程詳細說明
                  </div>
                </label>
                <textarea 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)} 
                  placeholder="詳細介紹這堂課會教些什麼、適合什麼樣的學生..." 
                  rows="6" 
                  style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: '16px', color: '#0f172a', boxSizing: 'border-box', resize: 'vertical', outlineColor: '#3498db', lineHeight: '1.6' }} 
                />
              </div>

              {/* 提交按鈕 */}
              <button 
                type="submit" 
                style={{ width: '100%', padding: '16px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', boxShadow: '0 10px 20px -5px rgba(15, 23, 42, 0.3)', transition: 'background-color 0.2s', marginTop: '10px' }}
                onMouseOver={e => e.currentTarget.style.backgroundColor = '#1e293b'}
                onMouseOut={e => e.currentTarget.style.backgroundColor = '#0f172a'}
              >
                <Send size={18} />
                發佈課程上架
              </button>
            </form>
          </div>

          {/* 右側：✨ 專題亮點 AI 輔助面板 */}
          <div style={{ flex: '0.6', minWidth: '250px', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', borderRadius: '20px', padding: '30px', color: 'white', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 15px 35px rgba(0,0,0,0.1)' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ width: '40px', height: '40px', background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)', borderRadius: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <Sparkles size={24} color="white" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>AI 智能文案助手</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>不知道怎麼推銷自己？交給 AI 吧！</p>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '8px' }}>選擇文案風格</label>
              {/* 🌟 拔除 Emoji，保持純文字的乾淨專業感 */}
              <select 
                value={aiStyle} 
                onChange={(e) => setAiStyle(e.target.value)} 
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', fontSize: '14px', outline: 'none', cursor: 'pointer' }}
              >
                <option value="幽默風趣" style={{ color: 'black' }}>幽默風趣 (適合輕鬆才藝)</option>
                <option value="熱血推銷" style={{ color: 'black' }}>熱血推銷 (適合衝刺班)</option>
                <option value="專業嚴謹" style={{ color: 'black' }}>專業嚴謹 (適合專業技能)</option>
              </select>
            </div>

            <button 
              type="button" 
              onClick={handleAIGenerate}
              disabled={isGenerating}
              style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '15px', cursor: isGenerating ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', transition: 'opacity 0.2s', opacity: isGenerating ? 0.7 : 1 }}
            >
              {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
              {isGenerating ? 'AI 正在發揮創意...' : '一鍵生成完美文案'}
            </button>

            <div style={{ marginTop: 'auto', backgroundColor: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '10px', fontSize: '13px', color: '#94a3b8', lineHeight: '1.6' }}>
              <strong>使用提示：</strong><br/>先在左側輸入「課程名稱」，再點擊生成按鈕。AI 會自動幫你撰寫高轉換率的課程說明，並提供建議定價！
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}