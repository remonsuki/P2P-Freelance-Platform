// 課程時段：資料庫存 morning / afternoon / evening，前端顯示 Morning / Afternoon / Night
const slotLabel = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Night' };

const slotTimes = {
  morning: ['09:00', '10:00'],
  afternoon: ['14:00', '15:00'],
  evening: ['19:00', '20:00'],
};

/** 前端的 '2026-11-07|Morning' → { class_date, slot_type } */
function parseTimeSlot(timeKey) {
  if (!timeKey || !timeKey.includes('|')) return null;
  const [date, slot] = timeKey.split('|');
  const slotMap = { Morning: 'morning', Afternoon: 'afternoon', Night: 'evening', evening: 'evening' };
  return { class_date: date, slot_type: slotMap[slot] || slot.toLowerCase() };
}

module.exports = { slotLabel, slotTimes, parseTimeSlot };