import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function Profile({ userName, setUserName, teachers, onDeleteTeacher, onUpdateTeacher }) {
  const mySkills = teachers.filter(teacher => teacher.name === userName);

  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPrice, setEditPrice] = useState('');

  // 新增：個人資料區塊的編輯狀態
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState(userName);
  const [profileDept, setProfileDept] = useState('資訊管理系 | 學號：B1100001');
  const [profileBio, setProfileBio] = useState('熱愛程式與音樂，目前在鑽研網頁設計與吉他指彈。');

  const handleEditClick = (skill) => {
    setEditingId(skill.id);
    setEditTitle(skill.skill);
    setEditPrice(skill.price);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = () => {
    onUpdateTeacher(editingId, editTitle, editPrice);
    setEditingId(null);
  };

  const handleSaveProfile = () => {
    setUserName(profileName);
    setIsEditingProfile(false);
  };

  return (
    <div style={{ padding: '40px 20px', maxWidth: '900px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      
      {/* 頂部個人資料卡片 */}
      <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '30px' }}>
        <div style={{ width: '120px', height: '120px', borderRadius: '50%', backgroundColor: '#f0f0f0', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#999', border: '2px dashed #ccc', marginBottom: '20px' }}>
          照片 (大頭貼)
        </div>
        
        {isEditingProfile ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '400px', gap: '15px' }}>
            <input 
              type="text" 
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ced4da', textAlign: 'center', fontSize: '20px', fontWeight: 'bold' }}
            />
            <input 
              type="text" 
              value={profileDept}
              onChange={(e) => setProfileDept(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ced4da', textAlign: 'center' }}
            />
            <textarea 
              value={profileBio}
              onChange={(e) => setProfileBio(e.target.value)}
              rows="3"
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ced4da', resize: 'vertical', textAlign: 'center' }}
            />
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button onClick={() => setIsEditingProfile(false)} style={{ padding: '10px 20px', borderRadius: '20px', border: '1px solid #bdc3c7', backgroundColor: 'transparent', color: '#7f8c8d', fontWeight: 'bold', cursor: 'pointer' }}>取消</button>
              <button onClick={handleSaveProfile} style={{ padding: '10px 20px', borderRadius: '20px', border: 'none', backgroundColor: '#2ecc71', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>儲存</button>
            </div>
          </div>
        ) : (
          <>
            <h2 style={{ margin: '0 0 10px 0', color: '#2c3e50', fontSize: '28px' }}>{profileName}</h2>
            <p style={{ margin: '0 0 20px 0', color: '#7f8c8d' }}>{profileDept}</p>
            <p style={{ margin: '0 0 20px 0', color: '#34495e', textAlign: 'center', maxWidth: '500px', lineHeight: '1.5' }}>{profileBio}</p>
            <button onClick={() => setIsEditingProfile(true)} style={{ padding: '10px 20px', borderRadius: '20px', border: '1px solid #3498db', backgroundColor: 'transparent', color: '#3498db', fontWeight: 'bold', cursor: 'pointer' }}>
              編輯個人資料
            </button>
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
        <div style={{ flex: 1, backgroundColor: '#f9f9f9', padding: '20px', borderRadius: '15px', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#2c3e50' }}>{mySkills.length}</div>
          <div style={{ color: '#7f8c8d', fontSize: '14px', marginTop: '5px' }}>上架技能數</div>
        </div>
        <div style={{ flex: 1, backgroundColor: '#f9f9f9', padding: '20px', borderRadius: '15px', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#2c3e50' }}>4.9</div>
          <div style={{ color: '#7f8c8d', fontSize: '14px', marginTop: '5px' }}>平均評價</div>
        </div>
        <div style={{ flex: 1, backgroundColor: '#f9f9f9', padding: '20px', borderRadius: '15px', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#2c3e50' }}>350</div>
          <div style={{ color: '#7f8c8d', fontSize: '14px', marginTop: '5px' }}>累計賺取 YTC</div>
        </div>
      </div>

      <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, color: '#2c3e50' }}>我正在販售的技能</h3>
          <Link to="/publish" style={{ textDecoration: 'none', color: '#3498db', fontWeight: 'bold', fontSize: '14px' }}>
            + 新增技能
          </Link>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ borderBottom: '2px solid #eee' }}>
            <tr>
              <th style={{ padding: '15px', textAlign: 'left', color: '#7f8c8d' }}>技能名稱</th>
              <th style={{ padding: '15px', textAlign: 'left', color: '#7f8c8d' }}>分類</th>
              <th style={{ padding: '15px', textAlign: 'center', color: '#7f8c8d' }}>定價 (YTC)</th>
              <th style={{ padding: '15px', textAlign: 'center', color: '#7f8c8d' }}>狀態</th>
              <th style={{ padding: '15px', textAlign: 'right', color: '#7f8c8d' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {mySkills.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ padding: '30px', textAlign: 'center', color: '#95a5a6' }}>
                  目前還沒有上架任何技能喔！
                </td>
              </tr>
            ) : (
              mySkills.map(skill => (
                <tr key={skill.id} style={{ borderBottom: '1px solid #eee' }}>
                  {editingId === skill.id ? (
                    <>
                      <td style={{ padding: '15px' }}>
                        <input 
                          type="text" 
                          value={editTitle} 
                          onChange={(e) => setEditTitle(e.target.value)}
                          style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da' }}
                        />
                      </td>
                      <td style={{ padding: '15px', color: '#7f8c8d' }}>{skill.category}</td>
                      <td style={{ padding: '15px', textAlign: 'center' }}>
                        <input 
                          type="number" 
                          value={editPrice} 
                          onChange={(e) => setEditPrice(e.target.value)}
                          step="0.1"
                          style={{ width: '80px', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da', textAlign: 'center' }}
                        />
                      </td>
                      <td style={{ padding: '15px', textAlign: 'center' }}>
                        <span style={{ backgroundColor: '#fff3cd', color: '#856404', padding: '5px 10px', borderRadius: '15px', fontSize: '12px', fontWeight: 'bold' }}>編輯中</span>
                      </td>
                      <td style={{ padding: '15px', textAlign: 'right' }}>
                        <button onClick={handleCancelEdit} style={{ border: 'none', background: 'none', color: '#95a5a6', cursor: 'pointer', marginRight: '10px' }}>取消</button>
                        <button onClick={handleSaveEdit} style={{ border: 'none', background: 'none', color: '#2ecc71', cursor: 'pointer', fontWeight: 'bold' }}>儲存</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ padding: '15px', fontWeight: 'bold', color: '#2c3e50' }}>{skill.skill}</td>
                      <td style={{ padding: '15px', color: '#7f8c8d' }}>{skill.category}</td>
                      <td style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', color: '#f39c12' }}>
                        🪙 {skill.price.toFixed(1)}
                      </td>
                      <td style={{ padding: '15px', textAlign: 'center' }}>
                        <span style={{ backgroundColor: '#eafaf1', color: '#2ecc71', padding: '5px 10px', borderRadius: '15px', fontSize: '12px', fontWeight: 'bold' }}>販售中</span>
                      </td>
                      <td style={{ padding: '15px', textAlign: 'right' }}>
                        <button onClick={() => handleEditClick(skill)} style={{ border: 'none', background: 'none', color: '#95a5a6', cursor: 'pointer', marginRight: '10px' }}>編輯</button>
                        <button 
                          onClick={() => onDeleteTeacher(skill.id)} 
                          style={{ border: 'none', background: 'none', color: '#e74c3c', cursor: 'pointer' }}
                        >
                          刪除
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}