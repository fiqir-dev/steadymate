import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Copy, Gift, Link2, Users } from "lucide-react"

import "./Referrals.css"

type ReferralSummary = {
  referralCode: string
  referralLink: string
  totalPeopleInvited: number
  successfulPremiumReferrals: number
  totalEarnings: number
  pendingRewards: number
  approvedRewards: number
  paidRewards: number
  rewardPerPayment: number
  referralRewardPercentage: number
  premiumMonthlyPrice: number
  successfulReferralCount: number
  successfulReferralEarnings: number
  minimumSuccessfulReferrals: number
  minimumWithdrawalAmount: number
  availableBalance: number
  withdrawalEligible: boolean
  history: Array<{
    id: string
    studentName: string
    referredAt: string
    premiumPaymentStatus: string
    rewardAmount: number
    rewardStatus: string
  }>
  withdrawals: Array<{
    id: string
    amount: number
    status: string
    paymentMethod: "bank_transfer" | "telebirr" | "unknown"
    bankName: string
    accountHolderName: string
    maskedAccountNumber: string
    maskedTelebirrPhone: string
    createdAt: string
    reviewedAt?: string
    paidAt?: string
    rejectionReason?: string
  }>
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000"

function Referrals() {
  const navigate = useNavigate()
  const [summary, setSummary] = useState<ReferralSummary | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState("")
  const [withdrawalAmount, setWithdrawalAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<"bank_transfer" | "telebirr">("bank_transfer")
  const [accountHolderName, setAccountHolderName] = useState("")
  const [bankName, setBankName] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [telebirrPhone, setTelebirrPhone] = useState("")
  const [requestingWithdrawal, setRequestingWithdrawal] = useState(false)
  const [withdrawalNotice, setWithdrawalNotice] = useState("")

  useEffect(() => {
    const token = sessionStorage.getItem("steadymate_token")
    if (!token) {
      navigate("/login")
      return
    }

    fetch(`${API_URL}/api/referrals/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.message || "Unable to load referral information")
        }
        setSummary(data.referral)
      })
      .catch((requestError: unknown) => {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load referral information",
        )
      })
  }, [navigate])

  const copyLink = async () => {
    if (!summary?.referralLink) return

    await navigator.clipboard.writeText(summary.referralLink)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  const shareLink = async () => {
    if (!summary?.referralLink) return
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join me on Steady Mate",
          text: "Invite your friends. Help them study. Earn rewards.",
          url: summary.referralLink,
        })
      } catch (shareError) {
        if (shareError instanceof Error && shareError.name !== "AbortError") {
          setError("Unable to share your referral link.")
        }
      }
      return
    }
    await copyLink()
  }

  const requestWithdrawal = async () => {
    const token = sessionStorage.getItem("steadymate_token")
    const amount = Number(withdrawalAmount)
    if (!token || !Number.isFinite(amount)) return
    setError("")
    setWithdrawalNotice("")
    setRequestingWithdrawal(true)

    try {
      const response = await fetch(`${API_URL}/api/referrals/withdrawals`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount,
          paymentMethod,
          accountHolderName,
          ...(paymentMethod === "bank_transfer"
            ? { bankName, accountNumber }
            : { telebirrPhone }),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || "Unable to request withdrawal")
      setWithdrawalNotice(data.message || "Your request is pending admin review.")

      const updated = await fetch(`${API_URL}/api/referrals/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const updatedData = await updated.json()
      if (!updated.ok) throw new Error(updatedData.message || "Withdrawal was requested, but balance refresh failed")
      setSummary(updatedData.referral)
      setWithdrawalAmount("")
      setAccountHolderName("")
      setBankName("")
      setAccountNumber("")
      setTelebirrPhone("")
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to request withdrawal",
      )
    } finally {
      setRequestingWithdrawal(false)
    }
  }

  return (
    <div className="referrals-page">
      <header className="referrals-header">
        <p className="referrals-kicker">REFERRAL PROGRAM</p>
        <h1>Invite friends and earn when they become Premium members.</h1>
        <p>
          You earn a reward only after someone you invite purchases Premium and their payment is approved.
        </p>
      </header>

      {error && <div className="referrals-error">{error}</div>}
      {withdrawalNotice && (
        <div className="withdrawal-notice" role="status" aria-live="polite">
          {withdrawalNotice}
        </div>
      )}

      {summary && (
        <>
          <section className="referrals-card referral-link-card">
            <div>
              <p className="referrals-kicker">YOUR REFERRAL LINK</p>
              <h2>{summary.referralLink}</h2>
            </div>
            <button type="button" className="btn btn-primary" onClick={copyLink}>
              <Copy size={16} /> {copied ? "Copied" : "Copy referral link"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={shareLink}>
              Share
            </button>
          </section>

          <div className="referrals-grid">
            <article className="referrals-stat">
              <div className="referrals-stat-icon"><Users size={18} /></div>
              <div>
                <small>People invited</small>
                <strong>{summary.totalPeopleInvited}</strong>
              </div>
            </article>
            <article className="referrals-stat">
              <div className="referrals-stat-icon"><Gift size={18} /></div>
              <div>
                <small>Pending earnings</small>
                <strong>{summary.pendingRewards} ETB</strong>
              </div>
            </article>
            <article className="referrals-stat">
              <div className="referrals-stat-icon"><Gift size={18} /></div>
              <div>
                <small>Approved earnings</small>
                <strong>{summary.approvedRewards} ETB</strong>
              </div>
            </article>
            <article className="referrals-stat">
              <div className="referrals-stat-icon"><Gift size={18} /></div>
              <div>
                <small>Paid earnings</small>
                <strong>{summary.paidRewards} ETB</strong>
              </div>
            </article>

            <article className="referrals-stat">
              <div className="referrals-stat-icon"><Gift size={18} /></div>
              <div>
                <small>Successful referrals</small>
                <strong>
                  {summary.successfulReferralCount} / {summary.minimumSuccessfulReferrals}
                </strong>
              </div>
            </article>
            <article className="referrals-stat">
              <div className="referrals-stat-icon"><Gift size={18} /></div>
              <div>
                <small>Available balance</small>
                <strong>{summary.availableBalance} ETB</strong>
              </div>
            </article>

            <article className="referrals-stat">
              <div className="referrals-stat-icon"><Link2 size={18} /></div>
              <div>
                <small>Referral code</small>
                <strong>{summary.referralCode}</strong>
              </div>
            </article>
          </div>

          <section className="referrals-card summary-card">
            <div className="referrals-row">
              <span>Total earnings</span>
              <strong>{summary.totalEarnings} ETB</strong>
            </div>
            <div className="referrals-row">
              <span>Pending earnings</span>
              <strong>{summary.pendingRewards} ETB</strong>
            </div>
            <div className="referrals-row">
              <span>Approved earnings</span>
              <strong>{summary.approvedRewards} ETB</strong>
            </div>
            <div className="referrals-row">
              <span>Paid rewards</span>
              <strong>{summary.paidRewards} ETB</strong>
            </div>
            <div className="referrals-row highlight">
              <span>Reward per successful Premium referral</span>
              <strong>{summary.rewardPerPayment} ETB</strong>
            </div>
          </section>

          <section className="referrals-card withdrawal-progress-card">
            <p className="referrals-kicker">WITHDRAWAL PROGRESS</p>
            <div className="referral-important">
              <strong>⚠️ Important</strong>
              <p>
                Inviting someone does not automatically earn a reward. They must purchase the{" "}
                {summary.premiumMonthlyPrice} ETB Premium plan and their payment must be approved
                before the referral counts as successful.
              </p>
              <p className="referral-important-emphasis">
                You only earn a referral reward when the person you invite purchases Premium and
                their payment is approved.
              </p>
              <p>
                Simply inviting someone, sharing your referral link, or having someone create an
                account does not earn you {summary.rewardPerPayment} ETB.
              </p>
            </div>

            <div className="referral-success-flow">
              <h2>When does a referral count as successful?</h2>
              <ol>
                <li>Invite someone</li>
                <li>They create a Steady Mate account</li>
                <li>They purchase Premium for {summary.premiumMonthlyPrice} ETB</li>
                <li>Steady Mate approves their payment</li>
                <li className="referral-success-final">
                  You earn {summary.rewardPerPayment} ETB — the referral is successful
                </li>
              </ol>
            </div>

            <div className="referral-withdrawal-rule">
              <strong>
                You must have at least {summary.minimumSuccessfulReferrals} successful Premium
                referrals before you can withdraw.
              </strong>
              <p>
                {summary.minimumSuccessfulReferrals} successful Premium referrals ={" "}
                {summary.minimumWithdrawalAmount} ETB earned
              </p>
              <ul>
                <li>Invite {summary.minimumSuccessfulReferrals} people → ❌ Not necessarily {summary.minimumWithdrawalAmount} ETB</li>
                <li>{summary.minimumSuccessfulReferrals} people sign up → ❌ Not {summary.minimumWithdrawalAmount} ETB</li>
                <li>{summary.minimumSuccessfulReferrals} people use your referral link → ❌ Not {summary.minimumWithdrawalAmount} ETB</li>
                <li>
                  {summary.minimumSuccessfulReferrals} people purchase Premium and their payments
                  are approved → ✅ {summary.minimumWithdrawalAmount} ETB
                </li>
              </ul>
            </div>

            <div className="referral-reward-callout">
              <strong>{summary.referralRewardPercentage}% referral reward</strong>
              <span>
                {summary.rewardPerPayment} ETB per successful Premium referral, because Premium
                costs {summary.premiumMonthlyPrice} ETB.
              </span>
            </div>

            <div className="referrals-row">
              <span>Successful Premium referrals</span>
              <strong>{summary.successfulReferralCount} / {summary.minimumSuccessfulReferrals}</strong>
            </div>
            <div
              className="referral-progress-track"
              role="progressbar"
              aria-label="Successful Premium referrals toward withdrawal eligibility"
              aria-valuemin={0}
              aria-valuemax={summary.minimumSuccessfulReferrals}
              aria-valuenow={Math.min(summary.successfulReferralCount, summary.minimumSuccessfulReferrals)}
            >
              <span
                style={{
                  width: `${Math.min(100, (summary.successfulReferralCount / summary.minimumSuccessfulReferrals) * 100)}%`,
                }}
              />
            </div>
            <p className="referral-progress-caption">
              {summary.successfulReferralEarnings} ETB earned from approved Premium referral payments
            </p>

            {!summary.withdrawalEligible ? (
              <div className="withdrawal-locked">
                <strong>Withdrawal locked</strong>
                {summary.successfulReferralCount < summary.minimumSuccessfulReferrals ? (
                  <p>
                    You need at least {summary.minimumSuccessfulReferrals} successful Premium referrals to withdraw your earnings.
                  </p>
                ) : (
                  <p>You need at least {summary.minimumWithdrawalAmount} ETB available.</p>
                )}
                <button type="button" className="btn btn-primary" disabled>
                  Withdraw
                </button>
              </div>
            ) : (
              <div className="withdrawal-unlocked">
                <strong>Withdrawal unlocked ✓</strong>
                <p><strong>Available balance: {summary.availableBalance} ETB</strong></p>
                <label htmlFor="referral-withdrawal-amount">Withdrawal amount (ETB)</label>
                <input
                  id="referral-withdrawal-amount"
                  type="number"
                  min={summary.minimumWithdrawalAmount}
                  max={summary.availableBalance}
                  step="0.01"
                  value={withdrawalAmount}
                  onChange={(event) => setWithdrawalAmount(event.target.value)}
                  placeholder={`${summary.minimumWithdrawalAmount}`}
                  required
                />
                <label htmlFor="referral-payment-method">Withdrawal method</label>
                <select
                  id="referral-payment-method"
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value as "bank_transfer" | "telebirr")}
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="telebirr">Telebirr</option>
                </select>
                <label htmlFor="referral-account-holder">Account holder name</label>
                <input
                  id="referral-account-holder"
                  type="text"
                  autoComplete="name"
                  maxLength={120}
                  value={accountHolderName}
                  onChange={(event) => setAccountHolderName(event.target.value)}
                  required
                />
                {paymentMethod === "bank_transfer" ? (
                  <>
                    <label htmlFor="referral-bank-name">Bank name/type</label>
                    <input
                      id="referral-bank-name"
                      type="text"
                      maxLength={120}
                      value={bankName}
                      onChange={(event) => setBankName(event.target.value)}
                      required
                    />
                    <label htmlFor="referral-account-number">Account number</label>
                    <input
                      id="referral-account-number"
                      type="text"
                      autoComplete="off"
                      maxLength={80}
                      value={accountNumber}
                      onChange={(event) => setAccountNumber(event.target.value)}
                      required
                    />
                  </>
                ) : (
                  <>
                    <label htmlFor="referral-telebirr-phone">Telebirr phone number</label>
                    <input
                      id="referral-telebirr-phone"
                      type="tel"
                      autoComplete="tel"
                      maxLength={40}
                      value={telebirrPhone}
                      onChange={(event) => setTelebirrPhone(event.target.value)}
                      required
                    />
                  </>
                )}
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={requestWithdrawal}
                  disabled={
                    requestingWithdrawal ||
                    !withdrawalAmount ||
                    !accountHolderName.trim() ||
                    (paymentMethod === "bank_transfer"
                      ? !bankName.trim() || !accountNumber.trim()
                      : !telebirrPhone.trim())
                  }
                >
                  {requestingWithdrawal ? "Submitting..." : "Withdraw"}
                </button>
              </div>
            )}
          </section>

          {summary.withdrawals.length > 0 && (
            <section className="referrals-card info-card">
              <p className="referrals-kicker">WITHDRAWAL REQUEST HISTORY</p>
              <div className="referral-history-list">
                {summary.withdrawals.map((withdrawal) => (
                  <article className={`referral-withdrawal-history ${withdrawal.status}`} key={withdrawal.id}>
                    <div>
                      <strong>{withdrawal.amount} ETB</strong>
                      <small>{new Date(withdrawal.createdAt).toLocaleDateString()}</small>
                    </div>
                    <span className={`referral-status-pill ${withdrawal.status}`}>
                      {withdrawal.status === "paid" ? "Paid ✓" : withdrawal.status}
                    </span>
                    <span>
                      Method: {withdrawal.paymentMethod === "bank_transfer"
                        ? "Bank Transfer"
                        : withdrawal.paymentMethod === "telebirr"
                          ? "Telebirr"
                          : "Details unavailable"}
                    </span>
                    {withdrawal.status === "paid" && (
                      <div className="referral-paid-confirmation">
                        <strong>Withdrawal Paid ✓</strong>
                        <span>{withdrawal.amount} ETB has been paid successfully.</span>
                        {withdrawal.paymentMethod === "bank_transfer" ? (
                          <>
                            <span>Method: Bank Transfer</span>
                            <span>Bank: {withdrawal.bankName}</span>
                            <span>Account: {withdrawal.maskedAccountNumber}</span>
                          </>
                        ) : withdrawal.paymentMethod === "telebirr" ? (
                          <>
                            <span>Method: Telebirr</span>
                            <span>Telebirr: {withdrawal.maskedTelebirrPhone}</span>
                          </>
                        ) : (
                          <span>Method: Details unavailable</span>
                        )}
                        <span>Paid: {new Date(withdrawal.paidAt || withdrawal.createdAt).toLocaleDateString()}</span>
                      </div>
                    )}
                    {withdrawal.status === "rejected" && withdrawal.rejectionReason && (
                      <span className="referral-rejection-reason">
                        Rejection reason: {withdrawal.rejectionReason}
                      </span>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}

          <section className="referrals-card info-card">
            <p className="referrals-kicker">REFERRAL HISTORY</p>
            {summary.history.length === 0 ? (
              <p>No referrals yet. Share your link to invite your first friend.</p>
            ) : (
              <div className="referral-history-list">
                {summary.history.map((entry) => (
                  <article className="referral-history-item" key={entry.id}>
                    <div>
                      <strong>{entry.studentName}</strong>
                      <small>{new Date(entry.referredAt).toLocaleDateString()}</small>
                    </div>
                    <span>Payment: {entry.premiumPaymentStatus.replace("_", " ")}</span>
                    <span>
                      Reward: {entry.rewardAmount ? `${entry.rewardAmount} ETB · ${entry.rewardStatus}` : "Not earned"}
                    </span>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="referrals-card info-card">
            <p className="referrals-kicker">HOW IT WORKS</p>
            <ul>
              <li>Invite a friend to Steady Mate using your referral link.</li>
              <li>Their account is linked to yours when they sign up.</li>
              <li>You earn {summary.referralRewardPercentage}% only when their Premium purchase is approved: {summary.rewardPerPayment} ETB on a {summary.premiumMonthlyPrice} ETB payment.</li>
              <li>Withdrawals require at least {summary.minimumSuccessfulReferrals} successful Premium referrals and {summary.minimumWithdrawalAmount} ETB available.</li>
            </ul>
          </section>
        </>
      )}
    </div>
  )
}

export default Referrals
