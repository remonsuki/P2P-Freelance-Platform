import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// 這裡新增接收從 App.jsx 傳來的 onAddTeacher 功能
export default function PublishSkill({ onAddTeacher }) {
  const navigate = useNavigate();

  const [skillInput, setSkillInput] = useState('');
  const [styleInput, setStyleInput] = useState('專業嚴謹');

  const [generatedTitle, setGeneratedTitle] = useState('');
  const [generatedPrice, setGeneratedPrice] = useState('');
  const [generatedDescription, setGeneratedDescription] = useState('');
  
  const [isGenerating, setIsGenerating] = useState(false);

  const handleAIGenerate = () => {
    if (!skillInput.trim()) {
      alert('❌ 請先輸入您想教的技能名稱！');
      return;
    }

    setIsGenerating(true);

    setTimeout(() => {
      let newTitle = '';
      let newDesc = '';
      let newPrice = (Math.random() * 3 + 1).toFixed(1); 

      if (styleInput === '幽默風趣') {
        newTitle = `保證不打瞌睡的${skillInput}大師班`;
        newDesc = `想學${skillInput}卻總是半途而廢嗎？別擔心，跟著我學，保證讓你笑著學會！我會用最生活化的比喻，把複雜的觀念變成一塊小蛋糕。上完這堂課，你不但能掌握${skillInput}，還能順便練腹肌喔！`;
      } else if (styleInput === '熱血推銷') {
        newTitle = `【極速上手】${skillInput}特訓營，突破你的極限！`;
        newDesc = `給自己一個改變的機會！這堂${skillInput}課程專為渴望進步的你設計。我們沒有廢話，只有滿滿的實戰技巧。只要你肯練，我保證把你教到會！現在就加入，讓我們一起稱霸${skillInput}的領域！`;
      } else {
        newTitle = `基礎與進階：${skillInput}全方位解析`;
        newDesc = `本課程致力於提供系統化的${skillInput}教學。我們將從核心基礎觀念著手，逐步深入至進階應用技巧。適合希望建立紮實基礎、並尋求專業指導的學習者。課程內容包含理論講解與實務演練。`;
      }

      setGeneratedTitle(newTitle);
      setGeneratedPrice(newPrice);
      setGeneratedDescription(newDesc);
      setIsGenerating(false);
    }, 1500);
  };

  const handlePublish = () => {
    if (!generatedTitle || !generatedPrice || !generatedDescription) {
      alert('❌ 請先填寫完整資訊，或使用 AI 自動生成。');
      return;
    }

    // 關鍵更新：呼叫 App.jsx 傳遞過來的新增功能，把標題和價格傳回去
    onAddTeacher(generatedTitle, generatedPrice);

    alert('✅ 技能發佈成功！您的課程已上架至平台。');
    navigate('/search'); 
  };

  return (
    <div style={{ padding: '40px 20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
        <h2 style={{ color: '#2c3e50', marginBottom: '30px', textAlign: 'center' }}>發佈您的技能</h2>
        
        <div style={{ backgroundColor: '#f8f9fa', padding: '25px', borderRadius: '10px', marginBottom: '30px', border: '1px solid #e9ecef' }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#34495e', fontSize: '18px' }}>AI 文案助手</h3>
          <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
            <div style={{ flex: 2 }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#7f8c8d', fontSize: '14px' }}>您想教什麼技能？</label>
              <input 
                type="text" 
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                placeholder="例如：Python 爬蟲、日文會話"
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ced4da', fontSize: '16px' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#7f8c8d', fontSize: '14px' }}>文案風格</label>
              <select 
                value={styleInput}
                onChange={(e) => setStyleInput(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ced4da', fontSize: '16px', backgroundColor: 'white' }}
              >
                <option value="專業嚴謹">專業嚴謹</option>
                <option value="熱血推銷">熱血推銷</option>
                <option value="幽默風趣">幽默風趣</option>
              </select>
            </div>
          </div>
          
          <button 
            onClick={handleAIGenerate}
            disabled={isGenerating}
            style={{ 
              width: '100%', padding: '14px', borderRadius: '8px', border: 'none', 
              backgroundColor: isGenerating ? '#95a5a6' : '#9b59b6', 
              color: 'white', fontWeight: 'bold', fontSize: '16px', cursor: isGenerating ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.3s'
            }}
          >
            {isGenerating ? 'AI 正在為您撰寫中...' : '一鍵自動生成標題與文案'}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: '#34495e', fontWeight: 'bold' }}>課程標題</label>
            <input 
              type="text" 
              value={generatedTitle}
              onChange={(e) => setGeneratedTitle(e.target.value)}
              placeholder="將由 AI 生成，您也可手動修改"
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ced4da', fontSize: '16px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: '#34495e', fontWeight: 'bold' }}>建議定價</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>🪙</span>
              <input 
                type="number" 
                value={generatedPrice}
                onChange={(e) => setGeneratedPrice(e.target.value)}
                placeholder="0.0"
                step="0.1"
                style={{ width: '120px', padding: '12px', borderRadius: '8px', border: '1px solid #ced4da', fontSize: '16px' }}
              />
              <span style={{ color: '#7f8c8d' }}>YTC</span>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: '#34495e', fontWeight: 'bold' }}>詳細說明文案</label>
            <textarea 
              value={generatedDescription}
              onChange={(e) => setGeneratedDescription(e.target.value)}
              placeholder="將由 AI 生成，您也可手動修改"
              rows="5"
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ced4da', fontSize: '16px', resize: 'vertical' }}
            />
          </div>

          <button 
            onClick={handlePublish}
            style={{ 
              marginTop: '20px', width: '100%', padding: '16px', borderRadius: '8px', border: 'none', 
              backgroundColor: '#3498db', color: 'white', fontWeight: 'bold', fontSize: '18px', cursor: 'pointer',
              boxShadow: '0 4px 6px rgba(52, 152, 219, 0.2)'
            }}
          >
            確認發佈課程
          </button>
        </div>

      </div>
    </div>
  );
}