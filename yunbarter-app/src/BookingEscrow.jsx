import React, { useState } from "react";
import {
  ShieldCheck,
  Lock,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Star,
  ExternalLink,
  RefreshCw,
  FileWarning,
  ArrowRight,
  UserCheck,
  Coins,
  X,
} from "lucide-react";

const INITIAL_BOOKINGS = [
  {
    id: "ESC-2026-089",
    courseTitle: "網頁開發實戰：React 元件化與 Hook 實作",
    category: "程式",
    teacherName: "林克 老師",
    studentName: "Yun",
    role: "student",
    amount: 4.0,
    scheduledTime: "2026-11-02 14:00 - 16:00 (2小時)",
    attendedMinutes: 15,
    status: "IN_ESCROW", // IN_ESCROW | COMPLETED | DISPUTED | REFUNDED
    escrowContract: "0x71C...89A2",
    txHash: "0x9f8c...3b1d",
    rating: null,
    review: "",
    disputeReason: "",
  },
  {
    id: "ESC-2026-082",
    courseTitle: "吉他指彈教學：從零搞懂抓歌與編曲",
    category: "音樂",
    teacherName: "阿弦 老師",
    studentName: "Yun",
    role: "student",
    amount: 2.0,
    scheduledTime: "2026-10-28 19:00 - 20:00 (1小時)",
    attendedMinutes: 60,
    status: "COMPLETED",
    escrowContract: "0x71C...89A2",
    txHash: "0x4a2e...7c9f",
    rating: 5,
    review: "老師講解非常仔細，節奏跟指法都交代得很清楚！",
    disputeReason: "",
  },
  {
    id: "ESC-2026-091",
    courseTitle: "【極速上手】日文口說實戰練習",
    category: "外語",
    teacherName: "Yun (我)",
    studentName: "陳同學",
    role: "teacher",
    amount: 3.0,
    scheduledTime: "2026-11-04 20:00 - 21:30 (1.5小時)",
    attendedMinutes: 90,
    status: "IN_ESCROW",
    escrowContract: "0x71C...89A2",
    txHash: "0x2d5b...8e4a",
    rating: null,
    review: "",
    disputeReason: "",
  },
];

export default function BookingEscrow({
  userName = "Yun",
  balance,
  setBalance,
  setTransactions,
  showNotification,
}) {
  const [bookings, setBookings] = useState(INITIAL_BOOKINGS);
  const [activeTab, setActiveTab] = useState("all");
  const [processingId, setProcessingId] = useState(null);

  // 完課確認與評價 Modal
  const [releaseModalOrder, setReleaseModalOrder] = useState(null);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");

  // 爭議申訴與凍結 Modal
  const [disputeModalOrder, setDisputeModalOrder] = useState(null);
  const [disputeType, setDisputeType] = useState("實際授課時數或價值嚴重不符");
  const [disputeDetail, setDisputeDetail] = useState("");

  const lockedYTC = bookings
    .filter((b) => b.status === "IN_ESCROW" || b.status === "DISPUTED")
    .reduce((sum, b) => sum + b.amount, 0);

  const filteredBookings = bookings.filter((b) =>
    activeTab === "all" ? true : b.role === activeTab
  );

  // 1. 確認完課並釋放代幣
  const handleConfirmRelease = (e) => {
    e.preventDefault();
    if (!releaseModalOrder) return;
    const targetOrder = releaseModalOrder;
    setReleaseModalOrder(null);
    setProcessingId(targetOrder.id);

    setTimeout(() => {
      setBookings((prev) =>
        prev.map((item) =>
          item.id === targetOrder.id
            ? {
                ...item,
                status: "COMPLETED",
                rating,
                review: reviewText || "課程順利結束，確認釋放代幣！",
                txHash: "0x8b3f...91e2",
              }
            : item
        )
      );
      setProcessingId(null);
      setReviewText("");

      if (setTransactions) {
        setTransactions((prev) => [
          {
            id: Date.now(),
            type: "合約撥款",
            title: `完課撥款：${targetOrder.courseTitle}`,
            amount: -targetOrder.amount,
            date: new Date().toLocaleDateString(),
          },
          ...(prev || []),
        ]);
      }

      if (showNotification) {
        showNotification(
          "success",
          "智能合約撥款成功",
          `訂單 ${targetOrder.id} 已將 ${targetOrder.amount.toFixed(1)} YTC 釋放至老師錢包，並同步寫入雙向星級評價！`
        );
      }
    }, 1200);
  };

  // 2. 提出爭議申訴並凍結代幣
  const handleConfirmDispute = (e) => {
    e.preventDefault();
    if (!disputeModalOrder) return;
    const targetOrder = disputeModalOrder;
    setDisputeModalOrder(null);
    setProcessingId(targetOrder.id);

    setTimeout(() => {
      setBookings((prev) =>
        prev.map((item) =>
          item.id === targetOrder.id
            ? {
                ...item,
                status: "DISPUTED",
                disputeReason: `${disputeType}：${
                  disputeDetail || "上課未達約定時數與教學品質標準，申請退回代幣。"
                }`,
              }
            : item
        )
      );
      setProcessingId(null);
      setDisputeDetail("");

      if (showNotification) {
        showNotification(
          "error",
          "已凍結合約託管資金",
          `訂單 ${targetOrder.id} 已切換為 DISPUTED 狀態，Escrow 合約已鎖死資金暫停撥款，進入時數比對仲裁。`
        );
      }
    }, 1200);
  };

  // 3. 模擬仲裁通過：觸發智能合約自動退款 (並把 YTC 加回右上角餘額)
  const handleSimulateRefund = (order) => {
    setProcessingId(order.id);
    setTimeout(() => {
      setBookings((prev) =>
        prev.map((item) =>
          item.id === order.id
            ? { ...item, status: "REFUNDED", txHash: "0xrefund...77a1" }
            : item
        )
      );
      setProcessingId(null);

      if (typeof setBalance === "function") {
        setBalance((prev) => Number(prev || 0) + order.amount);
      }

      if (setTransactions) {
        setTransactions((prev) => [
          {
            id: Date.now(),
            type: "合約退款",
            title: `爭議退費：${order.courseTitle}`,
            amount: order.amount,
            date: new Date().toLocaleDateString(),
          },
          ...(prev || []),
        ]);
      }

      if (showNotification) {
        showNotification(
          "success",
          "智能合約自動退款完成",
          `經比對線上授課時數未達標，合約已自動將 ${order.amount.toFixed(1)} YTC 全額退回您的錢包！`
        );
      }
    }, 1200);
  };

  const handleResetDemo = () => {
    setBookings(INITIAL_BOOKINGS);
    if (showNotification) {
      showNotification("success", "已重置狀態", "已恢復為預設 Demo 展示資料。");
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f8fafc", padding: "36px 24px", fontFamily: "sans-serif" }}>
      <div style={{ maxWidth: "1020px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
        
        {/* 頂部深藍儀表板 */}
        <div style={{ backgroundColor: "#0f172a", color: "white", borderRadius: "24px", padding: "32px", boxShadow: "0 10px 25px rgba(15, 23, 42, 0.15)", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "24px" }}>
          <div style={{ maxWidth: "600px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "6px 12px", borderRadius: "999px", backgroundColor: "rgba(99, 102, 241, 0.2)", color: "#a5b4fc", fontSize: "12px", fontWeight: "bold", border: "1px solid rgba(129, 140, 248, 0.3)", marginBottom: "12px" }}>
              <ShieldCheck size={15} />
              Sepolia 智能合約雙軌託管機制 (Escrow)
            </div>
            <h1 style={{ fontSize: "28px", fontWeight: "900", margin: "0 0 10px 0", letterSpacing: "-0.5px" }}>
              預約管理與合約託管中心
            </h1>
            <p style={{ color: "#94a3b8", fontSize: "14px", lineHeight: "1.6", margin: 0 }}>
              預約課程時 YTC 代幣將先鎖入智能合約託管，待學員完課驗收後才自動撥款給老師；若遇授課品質不符或失約，學員可一鍵凍結代幣並觸發合約自動退款。
            </p>
          </div>

          <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "18px", padding: "20px 24px", minWidth: "240px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#94a3b8", fontSize: "12px", marginBottom: "6px" }}>
              <span>目前合約鎖倉託管總額</span>
              <Lock size={15} color="#fbbf24" />
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
              <span style={{ fontSize: "32px", fontWeight: "900", color: "#fbbf24" }}>
                {lockedYTC.toFixed(1)}
              </span>
              <span style={{ fontSize: "14px", fontWeight: "bold", color: "#fcd34d" }}>YTC</span>
            </div>
            <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #334155", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", color: "#94a3b8" }}>
              <span>託管合約地址</span>
              <span style={{ fontFamily: "monospace", color: "#cbd5e1", display: "flex", alignItems: "center", gap: "4px" }}>
                0x71C...89A2 <ExternalLink size={12} />
              </span>
            </div>
          </div>
        </div>

        {/* 篩選器與重置按鈕 */}
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
          <div style={{ display: "flex", gap: "8px", backgroundColor: "white", padding: "6px", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
            {[
              { key: "all", label: "全部預約紀錄" },
              { key: "student", label: "我是學員 (買課託管)" },
              { key: "teacher", label: "我是老師 (授課待領)" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "10px",
                  fontSize: "14px",
                  fontWeight: "bold",
                  border: "none",
                  cursor: "pointer",
                  backgroundColor: activeTab === tab.key ? "#0f172a" : "transparent",
                  color: activeTab === tab.key ? "white" : "#64748b",
                  transition: "all 0.2s",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleResetDemo}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "12px", fontSize: "13px", fontWeight: "bold", color: "#475569", backgroundColor: "white", border: "1px solid #e2e8f0", cursor: "pointer" }}
          >
            <RefreshCw size={14} /> 重置 Demo 狀態
          </button>
        </div>

        {/* 訂單卡片列表 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          {filteredBookings.map((order) => {
            const isLoading = processingId === order.id;

            return (
              <div
                key={order.id}
                style={{ backgroundColor: "white", borderRadius: "20px", border: "1px solid #e2e8f0", padding: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column", gap: "18px" }}
              >
                {/* 卡片頂部 */}
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "12px", borderBottom: "1px solid #f1f5f9", paddingBottom: "14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ padding: "4px 10px", borderRadius: "6px", backgroundColor: "#f1f5f9", color: "#334155", fontFamily: "monospace", fontSize: "12px", fontWeight: "bold" }}>
                      #{order.id}
                    </span>
                    <span style={{ padding: "4px 10px", borderRadius: "6px", backgroundColor: "#eef2ff", color: "#4338ca", fontSize: "12px", fontWeight: "bold" }}>
                      {order.category}
                    </span>
                    <span style={{ fontSize: "13px", color: "#64748b", fontWeight: "500" }}>
                      {order.role === "student" ? `授課教師：${order.teacherName}` : `預約學員：${order.studentName}`}
                    </span>
                  </div>

                  <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 14px", borderRadius: "999px", backgroundColor: "#fffbeb", border: "1px solid #fde68a", color: "#b45309", fontWeight: "800", fontSize: "14px" }}>
                    <Coins size={16} color="#f59e0b" />
                    {order.amount.toFixed(1)} YTC
                  </div>
                </div>

                {/* 標題與狀態徽章 */}
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
                  <div>
                    <h3 style={{ fontSize: "18px", fontWeight: "800", color: "#0f172a", margin: "0 0 8px 0" }}>
                      {order.courseTitle}
                    </h3>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "16px", fontSize: "13px", color: "#64748b" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <Clock size={14} color="#94a3b8" /> 預約時段：{order.scheduledTime}
                      </span>
                      <span style={{ fontFamily: "monospace", color: "#94a3b8" }}>
                        鏈上 TxHash: {order.txHash}
                      </span>
                    </div>
                  </div>

                  <div>
                    {order.status === "IN_ESCROW" && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "12px", backgroundColor: "#fffbeb", color: "#92400e", border: "1px solid #fde68a", fontSize: "12px", fontWeight: "bold" }}>
                        <Lock size={14} color="#d97706" /> 智能合約鎖倉託管中 (Escrow Locked)
                      </span>
                    )}
                    {order.status === "COMPLETED" && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "12px", backgroundColor: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0", fontSize: "12px", fontWeight: "bold" }}>
                        <CheckCircle2 size={14} color="#059669" /> 已確認完課・合約已撥款給老師
                      </span>
                    )}
                    {order.status === "DISPUTED" && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "12px", backgroundColor: "#fff1f2", color: "#9f1239", border: "1px solid #fecdd3", fontSize: "12px", fontWeight: "bold" }}>
                        <AlertTriangle size={14} color="#e11d48" /> 爭議申訴中・合約資金已凍結
                      </span>
                    )}
                    {order.status === "REFUNDED" && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "12px", backgroundColor: "#eff6ff", color: "#1e40af", border: "1px solid #bfdbfe", fontSize: "12px", fontWeight: "bold" }}>
                        <RefreshCw size={14} color="#2563eb" /> 爭議成立・智能合約已自動退回學員
                      </span>
                    )}
                  </div>
                </div>

                {/* 四階段視覺化進度條 */}
                <div style={{ backgroundColor: "#f8fafc", borderRadius: "14px", padding: "14px 18px", border: "1px solid #f1f5f9", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "12px", fontSize: "12px", fontWeight: "bold" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#047857" }}>
                    <CheckCircle2 size={16} /> 1. 預約建立 (鏈下資料庫)
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#047857" }}>
                    <CheckCircle2 size={16} /> 2. YTC 鎖入託管合約
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: order.status === "DISPUTED" ? "#e11d48" : order.status === "IN_ESCROW" ? "#4f46e5" : "#047857" }}>
                    {order.status === "DISPUTED" ? <AlertTriangle size={16} /> : <UserCheck size={16} />}
                    3. {order.status === "DISPUTED" ? "學員提出爭議 (凍結撥款)" : "授課品質與時數驗收"}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: order.status === "COMPLETED" ? "#047857" : order.status === "REFUNDED" ? "#1d4ed8" : "#94a3b8" }}>
                    <ArrowRight size={16} />
                    4. {order.status === "COMPLETED" ? "合約已撥款 + 雙向評價" : order.status === "REFUNDED" ? "合約已自動退款給學員" : "待觸發合約放款或退款"}
                  </div>
                </div>

                {/* 課後星級評價展示 */}
                {order.status === "COMPLETED" && order.rating && (
                  <div style={{ backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "12px", padding: "12px 16px", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "8px", fontSize: "13px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <strong style={{ color: "#065f46" }}>學員課後評價：</strong>
                      <div style={{ display: "flex", gap: "2px" }}>
                        {Array.from({ length: order.rating }).map((_, idx) => (
                          <Star key={idx} size={15} fill="#fbbf24" color="#fbbf24" />
                        ))}
                      </div>
                      <span style={{ color: "#334155" }}>「{order.review}」</span>
                    </div>
                    <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#047857", fontWeight: "bold" }}>
                      合約狀態：Released
                    </span>
                  </div>
                )}

                {/* 爭議申訴與一鍵模擬仲裁退款展示 */}
                {(order.status === "DISPUTED" || order.status === "REFUNDED") && order.disputeReason && (
                  <div style={{ backgroundColor: "#fff1f2", border: "1px solid #fecdd3", borderRadius: "14px", padding: "16px", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "14px", fontSize: "13px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <div style={{ fontWeight: "bold", color: "#be123c", display: "flex", alignItems: "center", gap: "6px" }}>
                        <FileWarning size={16} /> 智能合約爭議鎖定紀錄：
                      </div>
                      <div style={{ color: "#881337" }}>{order.disputeReason}</div>
                      <div style={{ color: "#64748b", fontSize: "12px" }}>
                        系統偵測線上教室實際停留時間：<strong>{order.attendedMinutes} 分鐘</strong>（未達約定標準）
                      </div>
                    </div>

                    {order.status === "DISPUTED" && (
                      <button
                        onClick={() => handleSimulateRefund(order)}
                        disabled={isLoading}
                        style={{ padding: "10px 16px", borderRadius: "12px", backgroundColor: "#e11d48", color: "white", fontWeight: "bold", fontSize: "13px", border: "none", cursor: "pointer", boxShadow: "0 2px 6px rgba(225, 29, 72, 0.3)" }}
                      >
                        {isLoading ? "執行合約退款中..." : "⚡ 模擬仲裁通過：觸發合約自動退款"}
                      </button>
                    )}
                  </div>
                )}

                {/* 底部操作按鈕 */}
                {order.status === "IN_ESCROW" && (
                  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "12px", paddingTop: "6px" }}>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>
                      💡 提示：若授課品質不符或時數不足，請勿點擊確認完課，可立即發起合約爭議凍結。
                    </span>

                    {order.role === "student" ? (
                      <div style={{ display: "flex", gap: "12px" }}>
                        <button
                          onClick={() => setDisputeModalOrder(order)}
                          disabled={isLoading}
                          style={{ padding: "10px 16px", borderRadius: "12px", border: "1px solid #fecdd3", backgroundColor: "#fff1f2", color: "#be123c", fontSize: "13px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                        >
                          <AlertTriangle size={15} /> 提出爭議申訴 (凍結代幣)
                        </button>

                        <button
                          onClick={() => setReleaseModalOrder(order)}
                          disabled={isLoading}
                          style={{ padding: "10px 18px", borderRadius: "12px", border: "none", backgroundColor: "#0f172a", color: "white", fontSize: "13px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                        >
                          <CheckCircle2 size={15} color="#34d399" />
                          {isLoading ? "區塊鏈確認中..." : "確認完課並撥款 (Release YTC)"}
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: "12px", fontWeight: "bold", color: "#4f46e5", backgroundColor: "#eef2ff", padding: "8px 14px", borderRadius: "10px" }}>
                        等待學員完課驗收後，智能合約將自動撥款至您的錢包
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 彈窗 1：確認完課與雙向評價 Modal */}
      {releaseModalOrder && (
        <div style={{ position: "fixed", inset: 0, zIndex: 2000, backgroundColor: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ backgroundColor: "white", borderRadius: "24px", maxWidth: "440px", width: "100%", padding: "24px", boxShadow: "0 20px 40px rgba(0,0,0,0.2)", display: "flex", flexDirection: "column", gap: "18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "12px" }}>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "800", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                <CheckCircle2 size={20} color="#059669" /> 確認完課並釋放託管代幣
              </h3>
              <button onClick={() => setReleaseModalOrder(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleConfirmRelease} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ backgroundColor: "#f8fafc", padding: "14px", borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "13px" }}>
                <div style={{ fontWeight: "bold", color: "#1e293b", marginBottom: "4px" }}>課程：{releaseModalOrder.courseTitle}</div>
                <div style={{ color: "#64748b" }}>
                  即將從 Escrow 合約釋放 <strong style={{ color: "#d97706" }}>{releaseModalOrder.amount.toFixed(1)} YTC</strong> 予 {releaseModalOrder.teacherName}
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "bold", color: "#334155", marginBottom: "8px" }}>
                  給予授課老師星級評價 (1 - 5 星)
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {[1, 2, 3, 4, 5].map((num) => (
                    <button
                      type="button"
                      key={num}
                      onClick={() => setRating(num)}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: "2px" }}
                    >
                      <Star size={28} fill={num <= rating ? "#fbbf24" : "none"} color={num <= rating ? "#fbbf24" : "#cbd5e1"} />
                    </button>
                  ))}
                  <span style={{ marginLeft: "8px", fontSize: "14px", fontWeight: "bold", color: "#334155" }}>{rating}.0 顆星</span>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "bold", color: "#334155", marginBottom: "6px" }}>
                  課後學習回饋
                </label>
                <textarea
                  rows={3}
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="分享你的上課收穫，幫助其他同學判斷課程價值..."
                  style={{ width: "100%", borderRadius: "12px", border: "1px solid #cbd5e1", padding: "10px", fontSize: "14px", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", paddingTop: "8px" }}>
                <button type="button" onClick={() => setReleaseModalOrder(null)} style={{ padding: "9px 16px", borderRadius: "10px", border: "1px solid #e2e8f0", backgroundColor: "white", color: "#475569", fontWeight: "bold", fontSize: "13px", cursor: "pointer" }}>
                  取消
                </button>
                <button type="submit" style={{ padding: "9px 18px", borderRadius: "10px", border: "none", backgroundColor: "#0f172a", color: "white", fontWeight: "bold", fontSize: "13px", cursor: "pointer" }}>
                  簽署合約並撥款
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 彈窗 2：提出爭議申訴與凍結代幣 Modal */}
      {disputeModalOrder && (
        <div style={{ position: "fixed", inset: 0, zIndex: 2000, backgroundColor: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ backgroundColor: "white", borderRadius: "24px", maxWidth: "440px", width: "100%", padding: "24px", boxShadow: "0 20px 40px rgba(0,0,0,0.2)", display: "flex", flexDirection: "column", gap: "18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "12px" }}>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "800", color: "#be123c", display: "flex", alignItems: "center", gap: "8px" }}>
                <AlertTriangle size={20} color="#e11d48" /> 發起智能合約爭議凍結 (Dispute)
              </h3>
              <button onClick={() => setDisputeModalOrder(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleConfirmDispute} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ backgroundColor: "#fff1f2", padding: "14px", borderRadius: "12px", border: "1px solid #fecdd3", fontSize: "13px", color: "#881337", lineHeight: "1.5" }}>
                <div style={{ fontWeight: "bold", marginBottom: "4px" }}>受保護資產：{disputeModalOrder.amount.toFixed(1)} YTC</div>
                送出申訴後，智能合約將立即切換為 <strong>DISPUTED</strong> 狀態，強制凍結資金防止撥款給老師，並交由系統比對上課時數紀錄進行自動退費。
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "bold", color: "#334155", marginBottom: "6px" }}>
                  爭議原因類別
                </label>
                <select
                  value={disputeType}
                  onChange={(e) => setDisputeType(e.target.value)}
                  style={{ width: "100%", borderRadius: "12px", border: "1px solid #cbd5e1", padding: "10px", fontSize: "13px", backgroundColor: "white" }}
                >
                  <option value="實際授課時數或價值嚴重不符">實際授課時數或教學價值嚴重不符（如：敷衍授課）</option>
                  <option value="教師無故失約或遲到早退">教師無故失約或嚴重遲到早退</option>
                  <option value="教學內容與課程大綱描述不符">教學內容與課程大綱描述嚴重不符</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "bold", color: "#334155", marginBottom: "6px" }}>
                  具體情況說明（將連同會議時數紀錄提交仲裁）
                </label>
                <textarea
                  rows={3}
                  value={disputeDetail}
                  onChange={(e) => setDisputeDetail(e.target.value)}
                  placeholder="例如：約定上課 2 小時，但老師只講了 15 分鐘就草草結束，申請退回託管代幣..."
                  style={{ width: "100%", borderRadius: "12px", border: "1px solid #cbd5e1", padding: "10px", fontSize: "14px", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", paddingTop: "8px" }}>
                <button type="button" onClick={() => setDisputeModalOrder(null)} style={{ padding: "9px 16px", borderRadius: "10px", border: "1px solid #e2e8f0", backgroundColor: "white", color: "#475569", fontWeight: "bold", fontSize: "13px", cursor: "pointer" }}>
                  取消
                </button>
                <button type="submit" style={{ padding: "9px 18px", borderRadius: "10px", border: "none", backgroundColor: "#e11d48", color: "white", fontWeight: "bold", fontSize: "13px", cursor: "pointer" }}>
                  立即凍結代幣並申請退款
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}