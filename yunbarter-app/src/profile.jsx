
import { useState, useEffect } from 'react';
import {
  ArrowLeft, User, GraduationCap, ShieldCheck,
  BookOpen, Calendar, CalendarDays, Plus, X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { fetchProfile, updateProfile, fetchBookings } from './services/api';
import { useLiveData } from './hooks/useLiveData';
import './Profile.css';

// 共用卡片樣式
const cardStyle = {
  backgroundColor: 'white',
  padding: '26px',
  border: '1px solid #e2e8f0',
  borderRadius: '16px',
  boxShadow: '0 5px 20px rgba(15,23,42,0.04)',
  minWidth: 0,
};

const primaryButton = {
  backgroundColor: '#2563eb',
  color: 'white',
  border: 0,
  borderRadius: '10px',
  padding: '11px 16px',
  fontWeight: 'bold',
  cursor: 'pointer',
};

const inputStyle = {
  width: '100%',
  padding: '11px',
  border: '1px solid #cbd5e1',
  borderRadius: '9px',
  boxSizing: 'border-box',
  fontSize: '14px',
};

const statusLabels = {
  IN_ESCROW: '已預約',
  DISPUTED: '爭議處理中',
  COMPLETED: '已完課',
  REFUNDED: '已退款',
};

export default function Profile({
  userName,
  userId,
  setUserName,
  teachers = [],
  onDeleteTeacher,
  onUpdateTeacher,
  refreshTeachers,
  showNotification,
  showConfirmation,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(userName);
  const [editBio, setEditBio] = useState('');
  const [editDept, setEditDept] = useState('');
  const [avatarPreview, setAvatarPreview] = useState(null);

  const [availableTimes, setAvailableTimes] = useState([]);
  const [newDate, setNewDate] = useState('');
  const [newSlot, setNewSlot] = useState('Morning');
  const [lockedTimes, setLockedTimes] = useState([]);

  const [isSaving, setIsSaving] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [teacherRating, setTeacherRating] = useState(null);
  const [editingCourse, setEditingCourse] = useState(null);

  const {
    data: bookingData,
    error: bookingError,
  } = useLiveData(fetchBookings);

  const bookedCourses = (
    Array.isArray(bookingData) ? bookingData : []
  )
    .filter(b => b.role === 'student')
    .map(b => ({
      ...b,
      skill: b.courseTitle,
      price: b.amount,
      date: b.scheduledTime,
    }));

  const myTeachers = teachers.filter(
    teacher => teacher.teacherId === userId
  );

  // 載入個人資料
  useEffect(() => {
    let active = true;
    setProfileLoaded(false);

    fetchProfile()
      .then(data => {
        if (!active) return;

        if (data.userName) {
          setEditName(data.userName);
          setUserName(data.userName);
        }

        setEditDept(data.department || '');
        setEditBio(data.bio || '');
        setTeacherRating(data.teacherRating);
        setAvailableTimes(data.availableTimes || []);
        setLockedTimes(data.lockedTimes || []);
        setProfileError('');
        setProfileLoaded(true);
      })
      .catch(err => {
        if (active) setProfileError(err.message);
      });

    return () => {
      active = false;
    };
  }, [setUserName, userId]);

  // 清理頭像預覽網址
  useEffect(() => {
    return () => {
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];

    if (file) {
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  // 新增授課時間
  const handleAddSpecificTime = () => {
    if (!newDate) {
      showNotification(
        'warning', '操作提示', '請先選擇一個日期！'
      );
      return;
    }

    const timeKey = `${newDate}|${newSlot}`;

    if (availableTimes.includes(timeKey)) {
      showNotification(
        'warning', '重複新增', '這個時段已經存在了'
      );
      return;
    }

    setAvailableTimes(prev => [...prev, timeKey].sort());
  };

  const formatDisplayTime = (timeKey) => {
    const [date, slot] = timeKey.split('|');

    const names = {
      Morning: '早上',
      Afternoon: '下午',
      Night: '晚上',
    };

    return slot
      ? `${date} ${names[slot] || slot}`
      : timeKey;
  };

  // 儲存會員資料及排班
  const handleSaveProfile = async () => {
    if (!profileLoaded) {
      showNotification(
        'error', '資料尚未載入', '請重新整理後再儲存。'
      );
      return;
    }

    if (!editName.trim()) {
      showNotification(
        'warning', '資料不完整', '名稱不可為空！'
      );
      return;
    }

    if (isSaving) return;

    setIsSaving(true);

    try {
      const data = await updateProfile({
        userName: editName.trim(),
        department: editDept,
        bio: editBio,
        availableTimes,
        expectedUserId: userId,
      });

      setUserName(data.userName);
      setAvailableTimes(data.availableTimes || []);
      setLockedTimes(data.lockedTimes || []);
      setIsEditing(false);

      void refreshTeachers().catch(err => {
        console.error('重新載入課程失敗:', err);
      });

      showNotification(
        'success', '儲存成功',
        '個人資料與授課時段已儲存。'
      );
    } catch (err) {
      showNotification('error', '儲存失敗', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 更新課程
  const saveCourse = async (event) => {
    event.preventDefault();

    if (isSaving || !editingCourse) return;

    setIsSaving(true);

    try {
      await onUpdateTeacher(
        editingCourse.id,
        editingCourse.skill,
        editingCourse.price,
        editingCourse.description
      );

      setEditingCourse(null);

      showNotification(
        'success', '儲存成功',
        '課程已更新；既有預約保留原名稱與成交金額。'
      );
    } catch (err) {
      showNotification('error', '更新失敗', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{
      background: '#f4f7f6',
      minHeight: 'calc(100vh - 70px)',
      padding: '40px 20px',
    }}>

      <div className="profile-layout">

        {profileError && (
          <p role="alert" style={{ color: '#dc2626' }}>
            載入個人資料失敗：{profileError}
          </p>
        )}

        {/* ===== 頂部會員名片 ===== */}
        <div
          className="profile-hero"
          style={{
            background: 'white',
            borderRadius: '16px',
            overflow: 'hidden',
            border: '1px solid #e2e8f0',
          }}
        >
          <div style={{
            height: '105px',
            background: 'linear-gradient(115deg, #1e40af, #38bdf8)',
          }} />

          <div style={{ padding: '0 28px 26px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '12px',
            }}>
              <div style={{
                width: '90px',
                height: '90px',
                marginTop: '-45px',
                border: '4px solid white',
                borderRadius: '50%',
                background: '#eff6ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}>
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="頭像預覽"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <User size={40} color="#64748b" />
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsEditing(true)}
                style={{
                  marginTop: '16px',
                  padding: '9px 17px',
                  borderRadius: '20px',
                  border: '1px solid #bfdbfe',
                  background: '#eff6ff',
                  color: '#2563eb',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                編輯名片
              </button>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px',
              marginTop: '10px',
            }}>
              <h1 style={{
                margin: 0,
                fontSize: '26px',
                color: '#0f172a',
              }}>
                {userName}
              </h1>

              <span style={{
                borderRadius: '20px',
                background: '#eff6ff',
                color: '#2563eb',
                padding: '5px 10px',
                fontSize: '12px',
                fontWeight: 'bold',
              }}>
                YunBarter 會員
              </span>
            </div>

            {editBio && (
              <p style={{
                color: '#64748b',
                fontSize: '14px',
                lineHeight: 1.6,
                margin: '8px 0 18px',
                overflowWrap: 'anywhere',
              }}>
                {editBio}
              </p>
            )}

            {/* 三項統計 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '12px',
              marginTop: '18px',
            }}>
              {[
                {
                  label: '上架課程',
                  value: myTeachers.length,
                },
                {
                  label: '已預約課程',
                  value: bookedCourses.length,
                },
                {
                  label: '教師評價',
                  value: teacherRating == null
                    ? '尚無'
                    : Number(teacherRating).toFixed(1),
                },
              ].map(item => (
                <div
                  key={item.label}
                  style={{
                    padding: '12px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{
                    fontSize: '22px',
                    fontWeight: 900,
                    color: '#0f172a',
                  }}>
                    {item.value}
                  </div>

                  <div style={{
                    fontSize: '12px',
                    color: '#64748b',
                    marginTop: '4px',
                  }}>
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ===== 下方雙欄 Dashboard ===== */}
        <div className="profile-dashboard">

          {/* ===== 左側 ===== */}
          <div className="profile-dashboard-left">

            {/* 專業身分 */}
            <section style={cardStyle}>
              <h3 style={{
                margin: '0 0 22px',
                color: '#0f172a',
              }}>
                專業身分
              </h3>

              <div style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
                marginBottom: '20px',
              }}>
                <GraduationCap color="#2563eb" size={24} />
                <div>
                  <strong>教育經歷 / 職稱</strong>
                  <p style={{
                    margin: '5px 0 0',
                    color: '#64748b',
                    overflowWrap: 'anywhere',
                  }}>
                    {editDept || '尚未填寫'}
                  </p>
                </div>
              </div>

              <div style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
              }}>
                <ShieldCheck color="#059669" size={24} />
                <div>
                  <strong>個人資料狀態</strong>
                  <p style={{
                    margin: '5px 0 0',
                    color: '#64748b',
                  }}>
                    {profileLoaded
                      ? '會員資料已載入'
                      : profileError
                        ? '載入失敗'
                        : '會員資料載入中'}
                  </p>
                </div>
              </div>
            </section>

            {/* 我預約的課程 */}
            <section style={cardStyle}>
              <h3 style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                margin: '0 0 16px',
                color: '#0f172a',
              }}>
                <BookOpen size={20} color="#2563eb" />
                我預約的課程 ({bookedCourses.length})
              </h3>

              {bookingError && (
                <p role="alert" style={{ color: '#dc2626' }}>
                  載入失敗：{bookingError}
                </p>
              )}

              {!bookingError && bookedCourses.length === 0 && (
                <p style={{
                  color: '#94a3b8',
                  textAlign: 'center',
                  padding: '22px 0',
                }}>
                  目前還沒有預約的課程
                </p>
              )}

              {bookedCourses.map(course => (
                <div
                  key={course.id}
                  style={{
                    padding: '14px 0',
                    borderBottom: '1px solid #f1f5f9',
                    overflowWrap: 'anywhere',
                  }}
                >
                  <strong>{course.skill}</strong>

                  <p style={{
                    margin: '6px 0',
                    color: '#64748b',
                    fontSize: '13px',
                  }}>
                    {course.teacherName} 老師 · {course.date}
                  </p>

                  <p style={{
                    margin: '5px 0',
                    color: '#64748b',
                    fontSize: '13px',
                  }}>
                    {course.price}{' '}
                    {course.archived ? 'YTC（封存）' : 'SKILL'}
                    {' · '}
                    {course.archived
                      ? '已封存'
                      : statusLabels[course.status] || course.status}
                  </p>

                  {!course.archived &&
                    course.status === 'IN_ESCROW' &&
                    course.canCancel && (
                      <Link to="/bookings">
                        管理鏈上預約
                      </Link>
                    )}
                </div>
              ))}

              <Link
                to="/bookings"
                style={{
                  display: 'block',
                  textAlign: 'center',
                  padding: '12px',
                  marginTop: '18px',
                  textDecoration: 'none',
                  background: '#eff6ff',
                  color: '#2563eb',
                  borderRadius: '10px',
                  fontWeight: 'bold',
                }}
              >
                查看預約、完課與爭議處理
              </Link>
            </section>

          </div>

          {/* ===== 右側 ===== */}
          <div className="profile-dashboard-right">

            {/* 我的授課時間 */}
            <section style={cardStyle}>
              <h3 style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                margin: '0 0 20px',
                color: '#0f172a',
              }}>
                <CalendarDays size={20} color="#2563eb" />
                我的授課時間
              </h3>

              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '12px',
                alignItems: 'end',
                background: '#f8fafc',
                padding: '18px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
              }}>
                <label style={{
                  flex: '2 1 150px',
                  fontSize: '13px',
                  color: '#475569',
                  fontWeight: 'bold',
                }}>
                  選擇日期
                  <input
                    type="date"
                    value={newDate}
                    onChange={e => setNewDate(e.target.value)}
                    style={{
                      ...inputStyle,
                      marginTop: '6px',
                    }}
                  />
                </label>

                <label style={{
                  flex: '1 1 100px',
                  fontSize: '13px',
                  color: '#475569',
                  fontWeight: 'bold',
                }}>
                  時段
                  <select
                    value={newSlot}
                    onChange={e => setNewSlot(e.target.value)}
                    style={{
                      ...inputStyle,
                      marginTop: '6px',
                    }}
                  >
                    <option value="Morning">早上</option>
                    <option value="Afternoon">下午</option>
                    <option value="Night">晚上</option>
                  </select>
                </label>

                <button
                  type="button"
                  onClick={handleAddSpecificTime}
                  style={primaryButton}
                >
                  <Plus
                    size={15}
                    style={{ verticalAlign: 'middle' }}
                  />
                  {' '}新增
                </button>
              </div>

              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                marginTop: '18px',
                minHeight: '30px',
              }}>
                {availableTimes.length === 0 && (
                  <span style={{
                    color: '#94a3b8',
                    fontSize: '13px',
                  }}>
                    尚未設定授課時段
                  </span>
                )}

                {availableTimes.map(timeKey => (
                  <span
                    key={timeKey}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      background: '#eff6ff',
                      borderRadius: '9px',
                      color: '#1d4ed8',
                      fontSize: '13px',
                    }}
                  >
                    <Calendar size={14} />
                    {formatDisplayTime(timeKey)}

                    <button
                      type="button"
                      disabled={lockedTimes.includes(timeKey)}
                      title={
                        lockedTimes.includes(timeKey)
                          ? '已有預約，不能移除'
                          : '移除此時段'
                      }
                      onClick={() => {
                        setAvailableTimes(prev =>
                          prev.filter(t => t !== timeKey)
                        );
                      }}
                      style={{
                        background: 'none',
                        border: 0,
                        cursor: 'pointer',
                        opacity: lockedTimes.includes(timeKey)
                          ? 0.4
                          : 1,
                      }}
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>

              <div style={{
                textAlign: 'right',
                marginTop: '22px',
              }}>
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={isSaving || !profileLoaded}
                  style={{
                    ...primaryButton,
                    background: '#0f172a',
                    opacity: isSaving || !profileLoaded
                      ? 0.6
                      : 1,
                  }}
                >
                  儲存排班設定
                </button>
              </div>
            </section>

            {/* 我的技能課程 */}
            <section style={cardStyle}>
              <h3 style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                margin: '0 0 18px',
                color: '#0f172a',
              }}>
                <BookOpen color="#2563eb" size={20} />
                我的技能課程 ({myTeachers.length})
              </h3>

              {myTeachers.length === 0 && (
                <p style={{
                  textAlign: 'center',
                  padding: '20px',
                  color: '#94a3b8',
                }}>
                  目前還沒有上架課程
                </p>
              )}

              {myTeachers.map(teacher => (
                <div
                  key={teacher.id}
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '10px',
                    borderBottom: '1px solid #f1f5f9',
                    padding: '13px 0',
                  }}
                >
                  <strong style={{
                    flex: 1,
                    minWidth: '140px',
                    overflowWrap: 'anywhere',
                  }}>
                    {teacher.skill}
                  </strong>

                  <div style={{
                    display: 'flex',
                    gap: '8px',
                  }}>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingCourse({ ...teacher })
                      }
                      style={{
                        ...primaryButton,
                        background: '#eff6ff',
                        color: '#2563eb',
                      }}
                    >
                      編輯
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        showConfirmation(
                          '確認下架',
                          `確定要下架「${teacher.skill}」嗎？`,
                          () => onDeleteTeacher(teacher.id)
                        )
                      }
                      style={{
                        ...primaryButton,
                        background: '#fef2f2',
                        color: '#dc2626',
                      }}
                    >
                      下架
                    </button>
                  </div>
                </div>
              ))}

              <Link
                to="/publish"
                style={{
                  display: 'block',
                  textAlign: 'center',
                  marginTop: '18px',
                  padding: '12px',
                  background: '#eff6ff',
                  borderRadius: '10px',
                  color: '#2563eb',
                  textDecoration: 'none',
                  fontWeight: 'bold',
                }}
              >
                + 發佈新課程
              </Link>
            </section>

          </div>
        </div>
      </div>

      {/* ===== 編輯課程視窗 ===== */}
      {editingCourse && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15,23,42,.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2200,
          padding: '20px',
        }}>
          <form
            onSubmit={saveCourse}
            style={{
              background: 'white',
              borderRadius: '18px',
              width: '100%',
              maxWidth: '500px',
              padding: '28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxSizing: 'border-box',
            }}
          >
            <h3 style={{ margin: 0 }}>編輯課程內容</h3>

            <label>
              課程名稱
              <input
                required
                maxLength={200}
                value={editingCourse.skill}
                onChange={e => setEditingCourse({
                  ...editingCourse,
                  skill: e.target.value,
                })}
                style={inputStyle}
              />
            </label>

            <label>
              定價
              <input
                required
                type="number"
                min="0.1"
                step="0.1"
                value={editingCourse.price}
                onChange={e => setEditingCourse({
                  ...editingCourse,
                  price: e.target.value,
                })}
                style={inputStyle}
              />
            </label>

            <label>
              課程說明
              <textarea
                maxLength={10000}
                rows={5}
                value={editingCourse.description || ''}
                onChange={e => setEditingCourse({
                  ...editingCourse,
                  description: e.target.value,
                })}
                style={inputStyle}
              />
            </label>

            <button
              type="submit"
              disabled={isSaving}
              style={primaryButton}
            >
              {isSaving ? '儲存中...' : '儲存課程'}
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={() => setEditingCourse(null)}
              style={{
                ...primaryButton,
                background: '#f1f5f9',
                color: '#334155',
              }}
            >
              取消
            </button>
          </form>
        </div>
      )}

      {/* ===== 編輯個人名片視窗 ===== */}
      {isEditing && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15,23,42,.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '20px',
        }}>
          <div style={{
            background: 'white',
            maxWidth: '500px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            borderRadius: '20px',
            padding: '24px',
            boxSizing: 'border-box',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '22px',
            }}>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                style={{
                  border: 0,
                  background: 'none',
                  cursor: 'pointer',
                }}
              >
                <ArrowLeft size={20} />
              </button>
              <h3 style={{ margin: 0 }}>編輯個人檔案</h3>
            </div>

            <label style={{
              display: 'flex',
              gap: '14px',
              alignItems: 'center',
              marginBottom: '20px',
              cursor: 'pointer',
            }}>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                style={{ display: 'none' }}
              />

              <span style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: '#eff6ff',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'hidden',
                flexShrink: 0,
              }}>
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="預覽頭像"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <User size={30} />
                )}
              </span>

              <span style={{
                color: '#64748b',
                fontSize: '13px',
              }}>
                點擊選擇頭像（僅供預覽，不會儲存至伺服器）
              </span>
            </label>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}>
              <label>
                名稱
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  style={inputStyle}
                />
              </label>

              <label>
                職稱 / 身分
                <input
                  type="text"
                  value={editDept}
                  onChange={e => setEditDept(e.target.value)}
                  style={inputStyle}
                />
              </label>

              <label>
                自我介紹
                <textarea
                  rows={4}
                  value={editBio}
                  onChange={e => setEditBio(e.target.value)}
                  style={inputStyle}
                />
              </label>

              <button
                type="button"
                disabled={isSaving || !profileLoaded}
                onClick={handleSaveProfile}
                style={primaryButton}
              >
                {isSaving ? '儲存中...' : '儲存'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
