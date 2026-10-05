import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { CheckCircle2, DollarSign, ShieldCheck, Users } from "lucide-react"

import "./Admin.css"

type DashboardSummary = {
  totalUsers: number
  freeUsers: number
  premiumUsers: number
  pendingPayments: number
  approvedPayments: number
  pendingReferralRewards: number
  totalReferralRewards: number
  totalPremiumRevenue: number
  premiumPrice: number
  referralReward: number
}

type PaymentRecord = {
  id: string
  studentName: string
  studentEmail: string
  userId: string
  amount: number
  currency: string
  paymentMethod: string
  status: string
  hasScreenshot: boolean
  screenshotUrl: string
  telegramReference: string
  telegramChatId: string
  submittedAt: string
}

type ReferralReward = {
  id: string
  referrer?: { name?: string; email?: string }
  referredUser?: { name?: string; email?: string }
  payment?: { amount?: number; status?: string; submittedAt?: string }
  amount: number
  percentage: number
  status: string
  createdAt: string
}

type ReferralAccountSummary = {
  referrer: { id: string; name: string; email: string } | null
  successfulReferrals: number
  totalEarnings: number
  availableBalance: number
  withdrawalEligible: boolean
}

type WithdrawalRecord = {
  id: string
  user?: { id?: string; name?: string; email?: string }
  amount: number
  status: "pending" | "approved" | "paid" | "rejected"
  paymentMethod: "bank_transfer" | "telebirr" | "unknown"
  bankName: string
  accountHolderName: string
  accountNumber: string
  telebirrPhone: string
  successfulReferralCount: number
  availableBalance: number
  createdAt: string
  paidAt?: string
  rejectionReason?: string
}

type UserRecord = {
  id: string
  name: string
  email: string
  role: string
  plan: string
  premiumExpiresAt: string | null
  referralCode: string
  registeredAt: string
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000"

function AdminPaymentScreenshot({ paymentId, screenshotUrl }: { paymentId: string; screenshotUrl: string }) {
  const [imageUrl, setImageUrl] = useState("")
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const token = sessionStorage.getItem("steadymate_token")
    if (!token || !screenshotUrl) return

    let objectUrl = ""
    let cancelled = false
    fetch(`${API_URL}${screenshotUrl}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Screenshot unavailable")
        }
        return response.blob()
      })
      .then((image) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(image)
        setImageUrl(objectUrl)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [paymentId, screenshotUrl])

  if (failed) return <p className="admin-screenshot-note">Screenshot is currently unavailable.</p>
  if (!imageUrl) return <p className="admin-screenshot-note">Loading payment screenshot…</p>
  return <img className="admin-payment-screenshot" src={imageUrl} alt="Student payment screenshot" />
}

function Admin() {
  const navigate = useNavigate()
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null)
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [referrals, setReferrals] = useState<ReferralReward[]>([])
  const [referralSummaries, setReferralSummaries] = useState<ReferralAccountSummary[]>([])
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([])
  const [users, setUsers] = useState<UserRecord[]>([])
  const [error, setError] = useState("")
  const [working, setWorking] = useState(false)

  const loadAdminData = async () => {
    const token = sessionStorage.getItem("steadymate_token")
    if (!token) {
      navigate("/admin-login")
      return
    }

    try {
      const [dashboardResponse, paymentsResponse, refsResponse, usersResponse, referralSummaryResponse] = await Promise.all([
        fetch(`${API_URL}/api/admin/dashboard`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/admin/payments`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/admin/referrals`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/admin/users`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/admin/referrals/summary`, { headers: { Authorization: `Bearer ${token}` } }),
      ])

      const dashboardData = await dashboardResponse.json()
      const paymentsData = await paymentsResponse.json()
      const referralsData = await refsResponse.json()
      const usersData = await usersResponse.json()
      const referralSummaryData = await referralSummaryResponse.json()

      if (!dashboardResponse.ok || !paymentsResponse.ok || !refsResponse.ok || !usersResponse.ok || !referralSummaryResponse.ok) {
        throw new Error(
          dashboardData.message ||
            paymentsData.message ||
            referralsData.message ||
            usersData.message ||
            referralSummaryData.message ||
            "Unable to load admin dashboard",
        )
      }

      setDashboard(dashboardData.stats)
      setPayments(paymentsData.payments || [])
      setReferrals(referralsData.rewards || [])
      setUsers(usersData.users || [])
      setReferralSummaries(referralSummaryData.summaries || [])
      setWithdrawals(referralSummaryData.withdrawals || [])
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load admin dashboard",
      )
    }
  }

  useEffect(() => {
    const token = sessionStorage.getItem("steadymate_token")
    if (!token) {
      navigate("/login")
      return
    }

    fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.message || "Access denied")
        }
        if (data.user?.role !== "admin") {
          navigate("/admin-login")
          return
        }
        await loadAdminData()
      })
      .catch(() => {
        navigate("/admin-login")
      })
  }, [navigate])

  const updatePaymentStatus = async (paymentId: string, action: "approve" | "reject") => {
    const token = sessionStorage.getItem("steadymate_token")
    if (!token) return

    setWorking(true)

    try {
      const response = await fetch(`${API_URL}/api/admin/payments/${paymentId}/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || `Unable to ${action} payment`)
      }

      await loadAdminData()
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to process payment action",
      )
    } finally {
      setWorking(false)
    }
  }

  const markRewardPaid = async (rewardId: string) => {
    const token = sessionStorage.getItem("steadymate_token")
    if (!token) return

    setWorking(true)

    try {
      const response = await fetch(`${API_URL}/api/admin/referrals/${rewardId}/pay`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Unable to mark reward as paid")
      }

      await loadAdminData()
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to mark reward as paid",
      )
    } finally {
      setWorking(false)
    }
  }

  const approveReferralReward = async (rewardId: string) => {
    const token = sessionStorage.getItem("steadymate_token")
    if (!token) return
    setWorking(true)

    try {
      const response = await fetch(`${API_URL}/api/admin/referrals/${rewardId}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || "Unable to approve referral reward")
      }
      await loadAdminData()
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to approve referral reward",
      )
    } finally {
      setWorking(false)
    }
  }

  const reviewWithdrawal = async (
    withdrawalId: string,
    action: "approve" | "reject" | "pay",
  ) => {
    const token = sessionStorage.getItem("steadymate_token")
    if (!token) return
    const reason = action === "reject"
      ? window.prompt("Enter a reason for rejecting this withdrawal:")
      : null
    if (action === "reject" && !reason?.trim()) {
      setError("A rejection reason is required.")
      return
    }
    if (
      action === "pay" &&
      !window.confirm("Confirm that you have manually sent the money before marking this withdrawal as paid.")
    ) {
      return
    }
    setWorking(true)
    try {
      const response = await fetch(
        `${API_URL}/api/admin/referrals/withdrawals/${withdrawalId}/${action}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          ...(action === "reject" ? { body: JSON.stringify({ reason }) } : {}),
        },
      )
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || `Unable to ${action} withdrawal`)
      }
      await loadAdminData()
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : `Unable to ${action} withdrawal`,
      )
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <p className="admin-kicker">ADMIN DASHBOARD</p>
          <h1>Steady Mate control center</h1>
        </div>
      </header>

      {error && <div className="admin-error">{error}</div>}

      {dashboard && (
        <section className="admin-overview-grid">
          <article className="admin-stat-card">
            <Users size={18} />
            <div>
              <small>Total users</small>
              <strong>{dashboard.totalUsers}</strong>
            </div>
          </article>
          <article className="admin-stat-card">
            <ShieldCheck size={18} />
            <div>
              <small>Free users</small>
              <strong>{dashboard.freeUsers}</strong>
            </div>
          </article>
          <article className="admin-stat-card">
            <CheckCircle2 size={18} />
            <div>
              <small>Premium users</small>
              <strong>{dashboard.premiumUsers}</strong>
            </div>
          </article>
          <article className="admin-stat-card">
            <DollarSign size={18} />
            <div>
              <small>Pending payments</small>
              <strong>{dashboard.pendingPayments}</strong>
            </div>
          </article>
          <article className="admin-stat-card">
            <CheckCircle2 size={18} />
            <div>
              <small>Approved payments</small>
              <strong>{dashboard.approvedPayments}</strong>
            </div>
          </article>
          <article className="admin-stat-card">
            <DollarSign size={18} />
            <div>
              <small>Pending rewards</small>
              <strong>{dashboard.pendingReferralRewards}</strong>
            </div>
          </article>
          <article className="admin-stat-card">
            <DollarSign size={18} />
            <div>
              <small>Total referral rewards</small>
              <strong>{dashboard.totalReferralRewards} ETB</strong>
            </div>
          </article>
          <article className="admin-stat-card">
            <DollarSign size={18} />
            <div>
              <small>Premium revenue</small>
              <strong>{dashboard.totalPremiumRevenue} ETB</strong>
            </div>
          </article>
        </section>
      )}

      <section className="admin-panel">
        <div className="admin-panel-header">
          <h2>Premium Payment Requests</h2>
        </div>
        <div className="admin-list">
          {payments.length === 0 && <p className="admin-empty">No payment requests found.</p>}
          {payments.map((payment) => (
            <article className="admin-card" key={payment.id}>
              <div className="admin-card-head">
                <div>
                  <strong>{payment.studentName}</strong>
                  <small>{payment.studentEmail}</small>
                </div>
                <span className={`status-pill ${payment.status}`}>{payment.status}</span>
              </div>
              <div className="admin-card-meta">
                <span>User ID: {payment.userId}</span>
                <span>Amount: {payment.amount} ETB</span>
                <span>
                  Method: {payment.paymentMethod === "bank"
                    ? "Bank"
                    : payment.paymentMethod === "telebirr"
                      ? "Telebirr"
                      : "Not recorded"}
                </span>
                <span>Submitted: {new Date(payment.submittedAt).toLocaleDateString()}</span>
              </div>
              <div className="admin-card-meta">
                <span>Reference: {payment.telegramReference || "N/A"}</span>
                <span>Telegram chat: {payment.telegramChatId || "N/A"}</span>
              </div>
              {payment.hasScreenshot && payment.screenshotUrl && (
                <AdminPaymentScreenshot
                  paymentId={payment.id}
                  screenshotUrl={payment.screenshotUrl}
                />
              )}

              {payment.status === "pending" && (
                <div className="admin-actions">
                  <button type="button" className="btn btn-primary" onClick={() => updatePaymentStatus(payment.id, "approve") } disabled={working}>
                    Approve
                  </button>
                  <button type="button" className="btn btn-secondary danger" onClick={() => updatePaymentStatus(payment.id, "reject") } disabled={working}>
                    Reject
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <h2>Referral earnings and withdrawal requests</h2>
        </div>
        <div className="admin-list">
          {referralSummaries.map((summary) => (
            <article className="admin-card" key={summary.referrer?.id}>
              <div className="admin-card-head">
                <div>
                  <strong>{summary.referrer?.name || "Unknown referrer"}</strong>
                  <small>{summary.referrer?.email || ""}</small>
                </div>
                <span className={`status-pill ${summary.withdrawalEligible ? "approved" : "pending"}`}>
                  {summary.withdrawalEligible ? "Eligible" : "Locked"}
                </span>
              </div>
              <div className="admin-card-meta">
                <span>Successful Premium referrals: {summary.successfulReferrals}</span>
                <span>Total earnings: {summary.totalEarnings} ETB</span>
                <span>Available balance: {summary.availableBalance} ETB</span>
              </div>
            </article>
          ))}
          {withdrawals.length === 0 && (
            <p className="admin-empty">No withdrawal requests found.</p>
          )}
          {withdrawals.map((withdrawal) => (
            <article className="admin-card" key={withdrawal.id}>
              <div className="admin-card-head">
                <div>
                  <strong>{withdrawal.user?.name || "Unknown user"}</strong>
                  <small>{withdrawal.user?.email || ""}</small>
                </div>
                <span className={`status-pill ${withdrawal.status}`}>{withdrawal.status}</span>
              </div>
              <div className="admin-card-meta">
                <span>Requested: {withdrawal.amount} ETB</span>
                <span>
                  Method: {withdrawal.paymentMethod === "bank_transfer"
                    ? "Bank Transfer"
                    : withdrawal.paymentMethod === "telebirr"
                      ? "Telebirr"
                      : "Payout details missing"}
                </span>
                <span>Successful referrals: {withdrawal.successfulReferralCount}</span>
                <span>Available balance: {withdrawal.availableBalance} ETB</span>
                <span>Request date: {new Date(withdrawal.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="admin-withdrawal-details">
                {withdrawal.paymentMethod === "bank_transfer" ? (
                  <>
                    <span><strong>Bank:</strong> {withdrawal.bankName}</span>
                    <span><strong>Account name:</strong> {withdrawal.accountHolderName}</span>
                    <span><strong>Account number:</strong> {withdrawal.accountNumber}</span>
                  </>
                ) : withdrawal.paymentMethod === "telebirr" ? (
                  <>
                    <span><strong>Telebirr name:</strong> {withdrawal.accountHolderName}</span>
                    <span><strong>Phone:</strong> {withdrawal.telebirrPhone}</span>
                  </>
                ) : (
                  <span>Payout method/details are missing. Do not approve or pay this request.</span>
                )}
              </div>
              {withdrawal.status === "approved" && (
                <p className="admin-withdrawal-note">
                  {withdrawal.paymentMethod === "unknown"
                    ? "This legacy request has no saved payout details and cannot be paid safely."
                    : "Approved. Send the money manually through the selected method before marking it paid."}
                </p>
              )}
              {withdrawal.status === "rejected" && withdrawal.rejectionReason && (
                <p className="admin-withdrawal-note rejected">
                  Rejection reason: {withdrawal.rejectionReason}
                </p>
              )}
              {withdrawal.status === "pending" && (
                <div className="admin-actions">
                  <button type="button" className="btn btn-primary" onClick={() => reviewWithdrawal(withdrawal.id, "approve")} disabled={working || withdrawal.paymentMethod === "unknown"}>
                    Approve
                  </button>
                  <button type="button" className="btn btn-secondary danger" onClick={() => reviewWithdrawal(withdrawal.id, "reject")} disabled={working}>
                    Reject
                  </button>
                </div>
              )}
              {withdrawal.status === "approved" && (
                <div className="admin-actions">
                  <button type="button" className="btn btn-primary" onClick={() => reviewWithdrawal(withdrawal.id, "pay")} disabled={working || withdrawal.paymentMethod === "unknown"}>
                    Mark as Paid
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <h2>Referral rewards</h2>
        </div>
        <div className="admin-list">
          {referrals.length === 0 && <p className="admin-empty">No referral rewards found.</p>}
          {referrals.map((reward) => (
            <article className="admin-card" key={reward.id}>
              <div className="admin-card-head">
                <div>
                  <strong>{reward.referrer?.name || "Unknown referrer"}</strong>
                  <small>{reward.referrer?.email || ""}</small>
                </div>
                <span className={`status-pill ${reward.status}`}>{reward.status}</span>
              </div>
              <div className="admin-card-meta">
                <span>Referred user: {reward.referredUser?.name || "Unknown"}</span>
                <span>Amount: {reward.amount} ETB</span>
                <span>Payment: {reward.payment?.status || "N/A"}</span>
                <span>
                  Payment date: {reward.payment?.submittedAt
                    ? new Date(reward.payment.submittedAt).toLocaleDateString()
                    : "N/A"}
                </span>
                <span>Created: {new Date(reward.createdAt).toLocaleDateString()}</span>
              </div>
              {reward.status === "pending" && (
                <div className="admin-actions">
                  <button type="button" className="btn btn-primary" onClick={() => approveReferralReward(reward.id)} disabled={working}>
                    Approve reward
                  </button>
                </div>
              )}
              {reward.status === "approved" && (
                <div className="admin-actions">
                  <button type="button" className="btn btn-primary" onClick={() => markRewardPaid(reward.id)} disabled={working}>
                    Mark paid
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <h2>User management</h2>
        </div>
        <div className="admin-list">
          {users.length === 0 && <p className="admin-empty">No users found.</p>}
          {users.map((user) => (
            <article className="admin-card" key={user.id}>
              <div className="admin-card-head">
                <div>
                  <strong>{user.name}</strong>
                  <small>{user.email}</small>
                </div>
                <span className="status-pill neutral">{user.role}</span>
              </div>
              <div className="admin-card-meta">
                <span>Plan: {user.plan}</span>
                <span>Premium expiry: {user.premiumExpiresAt ? new Date(user.premiumExpiresAt).toLocaleDateString() : "N/A"}</span>
                <span>Referral code: {user.referralCode || "N/A"}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

export default Admin
