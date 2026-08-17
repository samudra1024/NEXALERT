"""
Frozen-model evaluation on unseen boundary SMS test set.

Creates/uses ml/data/unseen_boundary_test.csv, verifies messages are not in
dataset.csv, and reports Stage 1 + Stage 2 metrics without retraining.

Usage (from project root):
    python ml/run_unseen_boundary_test.py
"""

from __future__ import annotations

import csv
import json
import re
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from ml.model.config import ARTIFACTS_DIR, DATASET_PATH, HAM_CATEGORIES
from ml.model.preprocess import preprocess_text
from ml.model.stage2.train import load_stage2_pipeline
from ml.model.utils import load_model

DATA_DIR = PROJECT_ROOT / "ml" / "data"
UNSEEN_CSV = DATA_DIR / "unseen_boundary_test.csv"


@dataclass(frozen=True)
class UnseenCase:
    text: str
    expected_label: str
    expected_category: str
    boundary_type: str


def _c(text: str, label: str, category: str, boundary: str) -> UnseenCase:
    return UnseenCase(text, label.lower(), category.lower() if category else "", boundary)


# ---------------------------------------------------------------------------
# Unseen test messages — original wording, not copied from dataset.csv
# ---------------------------------------------------------------------------
UNSEEN_CASES: list[UnseenCase] = [
    # --- SPAM (50) ---
    _c("Dear customer, your PAN is flagged for KYC mismatch. Update via bit.ly/pan-kyc24 before 6 PM.", "spam", "", "fake_kyc"),
    _c("SBI Alert: unusual login from Lucknow detected. Confirm identity at sbi-verify-portal.net/login now.", "spam", "", "fake_bank_alert"),
    _c("UPI refund of Rs 4,999 pending. Share UPI PIN on phonepe-refund.help to receive amount.", "spam", "", "fake_upi_alert"),
    _c("Vi customer care: your SIM will be deactivated in 2 hours unless you reply YES to this message.", "spam", "", "fake_customer_care"),
    _c("Income Tax Dept: pending refund Rs 12,430. Download form at itd-refund-gov.in to claim.", "spam", "", "fake_gov_refund"),
    _c("Your debit card ending 4419 blocked due to suspicious activity. Call 1800-555-9921 immediately.", "spam", "", "fake_account_block"),
    _c("Congratulations! Selected for Rs 25,000 cashback. Complete survey at rewards-india.club/claim", "spam", "", "fake_cashback"),
    _c("Amazon Pay: payment of Rs 8,750 failed. Retry at amazonpay-secure-auth.com to avoid penalty.", "spam", "", "fake_payment_fail"),
    _c("Airtel: free 30GB data offer expires tonight. Activate at airtel-free-data.promo/now", "spam", "", "fake_recharge_offer"),
    _c("Netflix billing issue detected. Update card at netflix-billing-update.com within 24 hours.", "spam", "", "fake_subscription"),
    _c("Your UPI mandate for Rs 599/month was created. Cancel at upi-mandate-cancel.in if not you.", "spam", "", "fake_upi_mandate"),
    _c("RBI notice: your account under review. Submit documents through rbi-compliance-portal.org", "spam", "", "fake_rbi_notice"),
    _c("Flipkart delivery failed. Pay Rs 49 re-delivery fee at flipkart-redelivery.paynow.in", "spam", "", "fake_delivery_fee"),
    _c("Paytm KYC expired. Verify Aadhaar at paytm-kyc-update.net before wallet suspension.", "spam", "", "fake_kyc"),
    _c("HDFC Credit Card: reward points expiring. Redeem at hdfc-rewards-claim.co.in today.", "spam", "", "fake_bank_alert"),
    _c("Jio number selected for 1-year free recharge. Register at jio-lucky-winner.biz/register", "spam", "", "fake_recharge_offer"),
    _c("Your Google Pay account linked to new device. Secure at gpay-device-lock.help/secure", "spam", "", "fake_upi_alert"),
    _c("Zomato Pro membership payment declined. Update details at zomato-pro-billing.com", "spam", "", "fake_subscription"),
    _c("Courier held at customs. Pay Rs 350 clearance fee via customs-parcel-pay.in", "spam", "", "fake_delivery_fee"),
    _c("Bank of Baroda: NEFT reversal needed. Confirm at bob-neft-reverse.net/confirm", "spam", "", "fake_bank_alert"),
    _c("Your EMI of Rs 3,200 bounced. Avoid legal action at emi-recovery-portal.in/pay", "spam", "", "fake_loan_recovery"),
    _c("WhatsApp support: account will be deleted in 12 hours unless you verify at wa-verify-account.com", "spam", "", "fake_customer_care"),
    _c("IRCTC refund Rs 1,840 initiated. Provide bank details at irctc-refund-form.net", "spam", "", "fake_gov_refund"),
    _c("Canara Bank: update mobile number via canara-mobile-update.co.in before cutoff.", "spam", "", "fake_bank_alert"),
    _c("Free 12-month Hotstar with new credit card. Apply at hotstar-card-offer.promo/apply", "spam", "", "fake_subscription"),
    _c("Your SIM swap request approved. Cancel at simswap-cancel.help if unauthorized.", "spam", "", "fake_customer_care"),
    _c("UPI collect request Rs 15,000 from MERCHANT789. Approve at phonepe-collect-verify.com", "spam", "", "fake_upi_alert"),
    _c("LIC premium due Rs 18,900. Pay through lic-premium-quickpay.in to avoid lapse.", "spam", "", "fake_insurance"),
    _c("Swiggy One renewal failed. Update payment at swiggy-one-bill.com/renew", "spam", "", "fake_subscription"),
    _c("Your Aadhaar linked to 3 new bank accounts. Review at aadhaar-bank-link-check.gov-safe.in", "spam", "", "fake_kyc"),
    _c("BSNL broadband bill Rs 799 overdue. Pay at bsnl-bill-pay-quick.net to restore service.", "spam", "", "fake_recharge_offer"),
    _c("Meesho order refund stuck. Share OTP received on call with executive for processing.", "spam", "", "fake_customer_care"),
    _c("Federal Bank lottery win Rs 5,00,000. Claim processing fee Rs 999 at federal-lottery.in", "spam", "", "fake_cashback"),
    _c("Your UPI ID disabled for 24h. Re-enable at npci-upi-reactivate.org/enable", "spam", "", "fake_upi_alert"),
    _c("Cred membership auto-renewed Rs 999. Dispute at cred-cancel-membership.com", "spam", "", "fake_subscription"),
    _c("DHL shipment needs address confirmation. Pay Rs 99 at dhl-address-fee.com/confirm", "spam", "", "fake_delivery_fee"),
    _c("Kotak 811 account dormant. Re-KYC at kotak-dormant-kyc.net within 48 hours.", "spam", "", "fake_kyc"),
    _c("Your wallet credited Rs 2,000 by mistake. Return at wallet-return-pay.in to avoid penalty.", "spam", "", "fake_upi_alert"),
    _c("Spotify payment failed twice. Update card at spotify-india-billing.net/update", "spam", "", "fake_subscription"),
    _c("Police cyber cell notice: suspicious UPI activity. Callback requested on 9123456789.", "spam", "", "fake_customer_care"),
    _c("PNB: card used abroad Rs 45,000. Block at pnb-card-block-now.co.in if not you.", "spam", "", "fake_bank_alert"),
    _c("Free Jio 5G upgrade for 6 months. Activate at jio-5g-upgrade.promo/start", "spam", "", "fake_recharge_offer"),
    _c("Income tax refund rejected. Resubmit at it-refund-resubmit.gov-portal.in", "spam", "", "fake_gov_refund"),
    _c("Ola postpaid bill Rs 1,240 due. Pay at ola-postpaid-pay.com to avoid suspension.", "spam", "", "fake_subscription"),
    _c("Your bank token expired. Generate new token at token-generator-banksecure.in", "spam", "", "fake_bank_alert"),
    _c("Medicine order on hold. Pay customs Rs 275 at pharma-customs-clear.in", "spam", "", "fake_delivery_fee"),
    _c("PhonePe merchant settlement Rs 6,700 failed. Fix at phonepe-merchant-fix.net", "spam", "", "fake_upi_alert"),
    _c("Union Bank reward voucher Rs 1,500 unused. Redeem at union-rewards-voucher.co.in", "spam", "", "fake_cashback"),
    _c("Your account scheduled for closure. Prevent at account-keep-active.help/stop", "spam", "", "fake_account_block"),
    _c("Vi postpaid bill waiver available. Confirm at vi-bill-waiver.promo/confirm", "spam", "", "fake_recharge_offer"),
    _c("DMart gift card Rs 3,000 unclaimed. Register at dmart-gift-register.biz", "spam", "", "fake_cashback"),
    _c("Razorpay settlement pending. Verify GSTIN at razorpay-settlement-verify.com", "spam", "", "fake_payment_fail"),
    # --- HAM PERSONAL (20) ---
    _c("Arjun, can you pick up samosa on the way? I forgot my wallet at home.", "ham", "personal", "personal_vs_service"),
    _c("Reached Koramangala cafe. Table near window is free if you're still coming.", "ham", "personal", "personal_vs_service"),
    _c("Did you ask Priya about the recharge or should I message her directly?", "ham", "personal", "personal_vs_service"),
    _c("Bro send me that UPI screenshot when free, need to show landlord.", "ham", "personal", "personal_vs_banking"),
    _c("Mom wants to know if your bank passbook update is done this week.", "ham", "personal", "personal_vs_banking"),
    _c("I think my OTP came to your number by mistake, can you read it to me?", "ham", "personal", "otp_vs_personal"),
    _c("Please share the login code you got, I'm stuck on the payment page.", "ham", "personal", "otp_vs_personal"),
    _c("Are we still splitting the Netflix bill this month or canceling?", "ham", "personal", "personal_vs_subscription"),
    _c("My data finished again, can you hotspot for 10 minutes?", "ham", "personal", "personal_vs_recharge"),
    _c("Tell Rahul I'll recharge his number tomorrow morning, not tonight.", "ham", "personal", "personal_vs_recharge"),
    _c("Was that bank message about your salary or something else?", "ham", "personal", "banking_vs_personal"),
    _c("Call me after your meeting; don't worry about the card block SMS.", "ham", "personal", "banking_vs_personal"),
    _c("Train delayed 40 mins. Reach platform 3 when you arrive.", "ham", "personal", "personal_vs_service"),
    _c("Bring umbrella, Bangalore weather looks bad from office window.", "ham", "personal", "personal_vs_service"),
    _c("Can you check if subscription auto-renew is off on your phone?", "ham", "personal", "personal_vs_subscription"),
    _c("I'll pay you back on UPI tonight after dinner, remind me.", "ham", "personal", "personal_vs_banking"),
    _c("Did you mean to send me that verification code or wrong chat?", "ham", "personal", "otp_vs_personal"),
    _c("Aunty asked if your KYC at branch is done; reply when free.", "ham", "personal", "personal_vs_banking"),
    _c("Let's meet after recharge shop closes around 8.", "ham", "personal", "personal_vs_recharge"),
    _c("Your joke about fake lottery SMS was funny, almost looked real.", "ham", "personal", "personal_vs_service"),
    # --- HAM OTP (20) ---
    _c("IDFC FIRST Bank: OTP 620481 for adding payee AMIT SHARMA. Valid 5 minutes.", "ham", "otp", "otp_vs_banking"),
    _c("One-time verification code 338902 for Karnataka Bank mobile banking login.", "ham", "otp", "otp_vs_banking"),
    _c("OTP 771056 is your authentication code for Paytm merchant dashboard access.", "ham", "otp", "otp_vs_banking"),
    _c("Use passcode 904112 to approve Rs 2,450 UPI payment to MEDPLUS.", "ham", "otp", "otp_vs_banking"),
    _c("ICICI Direct OTP 552901 for modifying bank mandate. Do not share.", "ham", "otp", "otp_vs_banking"),
    _c("Your login OTP for IRCTC is 418773. Valid for 10 minutes only.", "ham", "otp", "otp_vs_banking"),
    _c("OTP 663210 for confirming card-not-present transaction at AMAZON IN.", "ham", "otp", "otp_vs_banking"),
    _c("Verification code 290817 for eMudhra digital signature renewal.", "ham", "otp", "otp_vs_banking"),
    _c("OTP 845019 to register device on YES BANK mobile app.", "ham", "otp", "otp_vs_banking"),
    _c("Authentication OTP 117634 for GST portal login attempt from Chrome.", "ham", "otp", "otp_vs_banking"),
    _c("Use OTP 503928 to complete Aadhaar OTP authentication for DigiLocker.", "ham", "otp", "otp_vs_banking"),
    _c("OTP 224501 for BharatPe settlement account change request.", "ham", "otp", "otp_vs_banking"),
    _c("One-time password 681044 for PhonePe business profile update.", "ham", "otp", "otp_vs_banking"),
    _c("OTP 392716 to authorize IMPS transfer of Rs 15,000 from AU Small Finance Bank.", "ham", "otp", "otp_vs_banking"),
    _c("Verification OTP 807451 for Tata Neu app login from new phone.", "ham", "otp", "otp_vs_banking"),
    _c("OTP 156883 for confirming subscription purchase on SonyLIV. Not a debit alert.", "ham", "otp", "otp_vs_subscription"),
    _c("Use code 440299 to verify email for Zerodha account recovery.", "ham", "otp", "otp_vs_banking"),
    _c("OTP 998214 for enabling international transactions on your debit card.", "ham", "otp", "otp_vs_banking"),
    _c("Authentication code 275603 for NSDL PAN application status check.", "ham", "otp", "otp_vs_banking"),
    _c("OTP 631087 for confirming mobile number change on Groww app.", "ham", "otp", "otp_vs_banking"),
    # --- HAM BANKING (20) ---
    _c("Karur Vysya Bank: A/c XX9031 credited Rs 26,750.00-NEFT from MEERA DEVI. Avl Rs 1,04,220.18", "ham", "banking", "banking_vs_otp"),
    _c("South Indian Bank alert: POS purchase Rs 890.00 at DECATHLON KOCHI on 16-08-2026.", "ham", "banking", "banking_vs_otp"),
    _c("Bandhan Bank: your savings account debited Rs 4,500.00 for SIP installment.", "ham", "banking", "banking_vs_subscription"),
    _c("City Union Bank: cheque number 118902 for Rs 12,000 cleared successfully.", "ham", "banking", "banking_vs_personal"),
    _c("DCB Bank: IMPS debit Rs 1,999.00 to MOBILE RECHARGE MERCHANT. Ref 884422.", "ham", "banking", "banking_vs_recharge"),
    _c("RBL Bank: credit card statement generated. Total due Rs 18,442. Minimum Rs 920.", "ham", "banking", "banking_vs_subscription"),
    _c("CSB Bank: UPI payment of Rs 650.00 to VI RECHARGE successful. Ref no 771234.", "ham", "banking", "banking_vs_recharge"),
    _c("Tamilnad Mercantile Bank: NEFT credit Rs 55,000 from SALARY ACME PVT LTD.", "ham", "banking", "banking_vs_personal"),
    _c("Dhanlaxmi Bank: ATM withdrawal Rs 2,000 at MG ROAD BENGALURU on 16-Aug 14:22.", "ham", "banking", "banking_vs_otp"),
    _c("Karnataka Gramin Bank: loan EMI Rs 7,850 debited. Outstanding principal Rs 2,41,000.", "ham", "banking", "banking_vs_subscription"),
    _c("Nainital Bank: your FD interest Rs 3,412 credited to savings account.", "ham", "banking", "banking_vs_personal"),
    _c("Cosmos Bank: UPI collect request paid Rs 320 to ELECTRICITY BOARD.", "ham", "banking", "banking_vs_recharge"),
    _c("Jammu & Kashmir Bank: card ending 2208 used for Rs 1,150 online payment.", "ham", "banking", "banking_vs_otp"),
    _c("Lakshmi Vilas Bank: inward remittance Rs 80,000 credited. FIRC available on request.", "ham", "banking", "banking_vs_personal"),
    _c("Punjab & Sind Bank: account maintenance charge Rs 150 debited for Q2.", "ham", "banking", "banking_vs_subscription"),
    _c("Ujjivan SFB: UPI debit Rs 239.00 to BSNL PREPAID RECHARGE successful.", "ham", "banking", "banking_vs_recharge"),
    _c("Equitas SFB: NACH debit Rs 2,999 for insurance premium failed due to low balance.", "ham", "banking", "banking_vs_subscription"),
    _c("IDBI Bank: your cheque deposit Rs 6,800 is under clearing. Updates by tomorrow.", "ham", "banking", "banking_vs_personal"),
    _c("Central Bank of India: UPI refund Rs 450 credited from MERCHANT REFUND.", "ham", "banking", "banking_vs_recharge"),
    _c("Indian Overseas Bank: forex card loaded with USD 500 equivalent Rs 41,850.", "ham", "banking", "banking_vs_otp"),
    # --- HAM SUBSCRIPTION (20) ---
    _c("SonyLIV WWE Network monthly membership renewed at Rs 299. Next billing 16-Sep-2026.", "ham", "subscription", "subscription_vs_recharge"),
    _c("Gaana Plus annual plan activated. Membership valid till 15-Aug-2027.", "ham", "subscription", "subscription_vs_recharge"),
    _c("Coursera Plus trial converted to paid plan Rs 3,999/year starting today.", "ham", "subscription", "subscription_vs_recharge"),
    _c("LinkedIn Premium Career monthly subscription payment of Rs 1,499 successful.", "ham", "subscription", "subscription_vs_recharge"),
    _c("Microsoft 365 Family renewal completed. Access for 6 members till 01-Mar-2027.", "ham", "subscription", "subscription_vs_recharge"),
    _c("Disney+ Hotstar Super annual membership renewed at Rs 899.", "ham", "subscription", "subscription_vs_recharge"),
    _c("Apple One individual plan renewal Rs 195/month processed successfully.", "ham", "subscription", "subscription_vs_recharge"),
    _c("Canva Pro team subscription renewed. Next invoice on 10-Sep-2026.", "ham", "subscription", "subscription_vs_recharge"),
    _c("Adobe Creative Cloud Photography plan auto-renewed Rs 638/month.", "ham", "subscription", "subscription_vs_recharge"),
    _c("Zee5 Premium membership extended for 12 months after payment Rs 999.", "ham", "subscription", "subscription_vs_recharge"),
    _c("Cult.fit Elite membership renewed. Valid across Bangalore centers till 30-Jun-2027.", "ham", "subscription", "subscription_vs_recharge"),
    _c("Times Prime annual subscription activated. Benefits unlocked on partner apps.", "ham", "subscription", "subscription_vs_recharge"),
    _c("Notion Plus workspace billing Rs 800/month confirmed for September cycle.", "ham", "subscription", "subscription_vs_recharge"),
    _c("Google One 200GB storage plan renewed at Rs 210/month.", "ham", "subscription", "subscription_vs_recharge"),
    _c("Amazon Prime membership auto-renewed Rs 1,499/year. Manage in app settings.", "ham", "subscription", "subscription_vs_recharge"),
    _c("BookMyShow VIP annual pass renewed. Early access benefits active.", "ham", "subscription", "subscription_vs_recharge"),
    _c("Swiggy One 3-month membership renewed at Rs 749.", "ham", "subscription", "subscription_vs_recharge"),
    _c("ET Prime digital subscription payment Rs 899 received. Access enabled.", "ham", "subscription", "subscription_vs_recharge"),
    _c("Airtel Xstream Premium OTT bundle renewed as part of postpaid plan add-on.", "ham", "subscription", "subscription_vs_recharge"),
    _c("JioSaavn Pro yearly membership renewed at Rs 749. Enjoy ad-free music.", "ham", "subscription", "subscription_vs_recharge"),
    # --- HAM RECHARGE_DATA (20) ---
    _c("MTNL Delhi: Rs 199 recharge successful. 2GB/day + UL calls valid 28 days.", "ham", "recharge_data", "recharge_vs_subscription"),
    _c("Tata Teleservices: prepaid balance updated Rs 155. Plan benefits active now.", "ham", "recharge_data", "recharge_vs_subscription"),
    _c("Reliance Communications: data pack 1GB/day added for 21 days on 98123XXXXX.", "ham", "recharge_data", "recharge_vs_subscription"),
    _c("Quadrant Televentures: Rs 365 recharge done. Unlimited 5G data till 19-Sep.", "ham", "recharge_data", "recharge_vs_subscription"),
    _c("Vodafone Idea: daily data quota 90% used. Recharge for uninterrupted browsing.", "ham", "recharge_data", "recharge_vs_banking"),
    _c("BSNL Kerala: STV Rs 247 activated. Night data 2GB + 100 SMS/day for 30 days.", "ham", "recharge_data", "recharge_vs_subscription"),
    _c("Aircel legacy port: Rs 99 top-up credited. Talktime Rs 64.18 valid 28 days.", "ham", "recharge_data", "recharge_vs_banking"),
    _c("Jio: data booster 3GB purchased for Rs 49. Valid till midnight today.", "ham", "recharge_data", "recharge_vs_subscription"),
    _c("Vi: international roaming data pack 2GB activated for 7 days at Rs 599.", "ham", "recharge_data", "recharge_vs_subscription"),
    _c("Airtel: smart recharge Rs 719 successful. 1.5GB/day + Amazon Prime 28 days.", "ham", "recharge_data", "recharge_vs_subscription"),
    _c("BSNL: validity of your prepaid number extended till 02-Oct-2026 after Rs 107 recharge.", "ham", "recharge_data", "recharge_vs_subscription"),
    _c("Jio: postpaid bill payment not required; this is prepaid pack activation Rs 299.", "ham", "recharge_data", "recharge_vs_subscription"),
    _c("Vi: night data pack 12AM-6AM unlimited activated for Rs 29 tonight.", "ham", "recharge_data", "recharge_vs_subscription"),
    _c("Airtel Thanks: 5GB data coupon credited after Rs 449 recharge on 98765XXXXX.", "ham", "recharge_data", "recharge_vs_banking"),
    _c("MTNL Mumbai: FRC plan Rs 186 activated with 1GB/day for 28 days.", "ham", "recharge_data", "recharge_vs_subscription"),
    _c("Reliance Jio: fiber not included; mobile recharge Rs 666 successful on 91234XXXXX.", "ham", "recharge_data", "recharge_vs_subscription"),
    _c("Vi: SMS pack 100/day added for 28 days with Rs 12 top-up.", "ham", "recharge_data", "recharge_vs_subscription"),
    _c("BSNL: data rollover 1.2GB applied after plan renewal Rs 399.", "ham", "recharge_data", "recharge_vs_subscription"),
    _c("Airtel: outgoing barred due to low balance. Recharge Rs 155 to restore calls.", "ham", "recharge_data", "recharge_vs_banking"),
    _c("Jio: 5G unlimited data plan Rs 999 activated. Validity 84 days from today.", "ham", "recharge_data", "recharge_vs_subscription"),
]


DIGIT_PATTERN = re.compile(r"\d+")
URL_PATTERN = re.compile(r"https?://\S+|www\.\S+|[a-z0-9-]+\.(com|in|net|org|biz|co\.in|help|club|promo)(/\S*)?", re.I)


def template_signature(text: str) -> str:
    normalized = preprocess_text(text)
    normalized = URL_PATTERN.sub("<url>", normalized)
    normalized = DIGIT_PATTERN.sub("<num>", normalized)
    return normalized


def load_dataset_signatures() -> tuple[set[str], set[str], set[str]]:
    df = pd.read_csv(DATASET_PATH, encoding="utf-8")
    raw = set(df["text"].astype(str).str.strip())
    preprocessed = {preprocess_text(t) for t in raw}
    templates = {template_signature(t) for t in raw}
    return raw, preprocessed, templates


def verify_unseen_cases(cases: list[UnseenCase]) -> dict:
    raw_set, prep_set, template_set = load_dataset_signatures()
    exact_dupes = []
    normalized_dupes = []
    template_dupes = []
    cleaned: list[UnseenCase] = []

    for case in cases:
        raw = case.text.strip()
        prep = preprocess_text(raw)
        tmpl = template_signature(raw)
        if raw in raw_set:
            exact_dupes.append(case)
            continue
        if prep in prep_set:
            normalized_dupes.append(case)
            continue
        if tmpl in template_set:
            template_dupes.append(case)
            continue
        cleaned.append(case)

    return {
        "exact_dupes": exact_dupes,
        "normalized_dupes": normalized_dupes,
        "template_dupes": template_dupes,
        "cleaned": cleaned,
    }


def write_csv(cases: list[UnseenCase], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["text", "expected_label", "expected_category", "boundary_type"],
        )
        writer.writeheader()
        for case in cases:
            writer.writerow(
                {
                    "text": case.text,
                    "expected_label": case.expected_label,
                    "expected_category": case.expected_category,
                    "boundary_type": case.boundary_type,
                }
            )


def load_stage1_artifacts():
    return load_model(ARTIFACTS_DIR, use_bundle=True)


def predict_stage1(text: str, model, vectorizer, threshold: float) -> dict:
    clean = preprocess_text(text)
    features = vectorizer.transform([clean])
    spam_prob = float(model.predict_proba(features)[0, 1])
    is_spam = spam_prob >= threshold
    return {
        "label": "spam" if is_spam else "ham",
        "spam_probability": spam_prob,
        "is_spam": is_spam,
    }


def predict_stage2(text: str, pipeline) -> str:
    clean = preprocess_text(text)
    return str(pipeline.predict([clean])[0])


def boundary_pair(boundary_type: str) -> str | None:
    mapping = {
        "otp_vs_banking": "OTP ↔ Banking",
        "banking_vs_otp": "OTP ↔ Banking",
        "banking_vs_recharge": "Banking ↔ Recharge_Data",
        "recharge_vs_banking": "Banking ↔ Recharge_Data",
        "recharge_vs_subscription": "Subscription ↔ Recharge_Data",
        "subscription_vs_recharge": "Subscription ↔ Recharge_Data",
        "personal_vs_service": "Personal ↔ service categories",
        "personal_vs_banking": "Banking ↔ Personal",
        "personal_vs_recharge": "Personal ↔ service categories",
        "personal_vs_subscription": "Personal ↔ service categories",
        "banking_vs_personal": "Banking ↔ Personal",
        "otp_vs_personal": "OTP ↔ Personal",
        "otp_vs_subscription": "Personal ↔ service categories",
    }
    return mapping.get(boundary_type)


def main() -> int:
    print("=" * 70)
    print("NEXALERT UNSEEN BOUNDARY TEST — FROZEN MODEL EVALUATION")
    print("=" * 70)
    print(f"Artifacts: {ARTIFACTS_DIR}")
    print(f"Dataset:   {DATASET_PATH}")
    print()

    verification = verify_unseen_cases(UNSEEN_CASES)
    exact = verification["exact_dupes"]
    normalized = verification["normalized_dupes"]
    template = verification["template_dupes"]
    cases = verification["cleaned"]

    print("UNSEEN DATA VERIFICATION")
    print("-" * 70)
    print(f"Initial candidate messages: {len(UNSEEN_CASES)}")
    print(f"Exact duplicates vs dataset: {len(exact)}")
    print(f"Normalized duplicates vs dataset: {len(normalized)}")
    print(f"Highly similar templates vs dataset: {len(template)}")
    print(f"Final unseen test count: {len(cases)}")

    if exact or normalized or template:
        print("\nRemoved/replaced conflicts:")
        for group_name, group in [
            ("exact", exact),
            ("normalized", normalized),
            ("template", template),
        ]:
            for item in group[:5]:
                print(f"  [{group_name}] {item.text[:90]}...")
    print()

    write_csv(cases, UNSEEN_CSV)
    print(f"Wrote unseen test file: {UNSEEN_CSV}")
    print()

    model, vectorizer, threshold = load_stage1_artifacts()
    stage2 = load_stage2_pipeline(ARTIFACTS_DIR / "stage2_model.pkl")

    y_true_s1 = []
    y_pred_s1 = []
    stage1_rows = []

    for case in cases:
        pred = predict_stage1(case.text, model, vectorizer, threshold)
        y_true_s1.append(case.expected_label)
        y_pred_s1.append(pred["label"])
        stage1_rows.append((case, pred))

    y_true_s1_arr = np.array(y_true_s1)
    y_pred_s1_arr = np.array(y_pred_s1)
    spam_mask_true = y_true_s1_arr == "spam"
    spam_mask_pred = y_pred_s1_arr == "spam"

    s1_accuracy = accuracy_score(y_true_s1_arr, y_pred_s1_arr)
    s1_precision = precision_score(y_true_s1_arr, y_pred_s1_arr, pos_label="spam", zero_division=0)
    s1_recall = recall_score(y_true_s1_arr, y_pred_s1_arr, pos_label="spam", zero_division=0)
    s1_f1 = f1_score(y_true_s1_arr, y_pred_s1_arr, pos_label="spam", zero_division=0)
    cm_s1 = confusion_matrix(y_true_s1_arr, y_pred_s1_arr, labels=["ham", "spam"])
    false_positives = int(((y_true_s1_arr == "ham") & (y_pred_s1_arr == "spam")).sum())
    false_negatives = int(((y_true_s1_arr == "spam") & (y_pred_s1_arr == "ham")).sum())

    print("STAGE 1 UNSEEN PERFORMANCE")
    print("-" * 70)
    print(f"Messages evaluated: {len(cases)}")
    print(f"Accuracy:        {s1_accuracy:.4f}")
    print(f"Spam precision:  {s1_precision:.4f}")
    print(f"Spam recall:     {s1_recall:.4f}")
    print(f"Spam F1:         {s1_f1:.4f}")
    print(f"False positives: {false_positives}")
    print(f"False negatives: {false_negatives}")
    print("Confusion matrix [rows=true ham/spam, cols=pred ham/spam]:")
    print(cm_s1)
    print()

    ham_cases = [case for case in cases if case.expected_label == "ham"]
    y_true_s2 = []
    y_pred_s2 = []
    incorrect_stage2 = []

    for case in ham_cases:
        stage1_pred = predict_stage1(case.text, model, vectorizer, threshold)
        if stage1_pred["is_spam"]:
            predicted_category = "__stage1_spam__"
        else:
            predicted_category = predict_stage2(case.text, stage2)
        y_true_s2.append(case.expected_category)
        y_pred_s2.append(predicted_category)
        if predicted_category != case.expected_category:
            incorrect_stage2.append(
                {
                    "message": case.text,
                    "expected": case.expected_category,
                    "predicted": predicted_category,
                    "boundary_type": case.boundary_type,
                    "why_difficult": boundary_pair(case.boundary_type) or case.boundary_type,
                }
            )

    y_true_s2_arr = np.array(y_true_s2)
    y_pred_s2_arr = np.array(y_pred_s2)
    valid_mask = y_pred_s2_arr != "__stage1_spam__"
    if valid_mask.any():
        s2_accuracy = accuracy_score(y_true_s2_arr[valid_mask], y_pred_s2_arr[valid_mask])
        s2_macro_precision = precision_score(
            y_true_s2_arr[valid_mask], y_pred_s2_arr[valid_mask], average="macro", zero_division=0, labels=HAM_CATEGORIES
        )
        s2_macro_recall = recall_score(
            y_true_s2_arr[valid_mask], y_pred_s2_arr[valid_mask], average="macro", zero_division=0, labels=HAM_CATEGORIES
        )
        s2_macro_f1 = f1_score(
            y_true_s2_arr[valid_mask], y_pred_s2_arr[valid_mask], average="macro", zero_division=0, labels=HAM_CATEGORIES
        )
        cm_s2 = confusion_matrix(y_true_s2_arr[valid_mask], y_pred_s2_arr[valid_mask], labels=HAM_CATEGORIES)
        report = classification_report(
            y_true_s2_arr[valid_mask], y_pred_s2_arr[valid_mask], labels=HAM_CATEGORIES, zero_division=0
        )
    else:
        s2_accuracy = s2_macro_precision = s2_macro_recall = s2_macro_f1 = 0.0
        cm_s2 = np.zeros((len(HAM_CATEGORIES), len(HAM_CATEGORIES)), dtype=int)
        report = "No HAM messages reached Stage 2."

    print("STAGE 2 UNSEEN PERFORMANCE (expected HAM only)")
    print("-" * 70)
    print(f"HAM messages evaluated: {len(ham_cases)}")
    print(f"Stage 1 misclassified as spam: {int((~valid_mask).sum())}")
    print(f"Accuracy:        {s2_accuracy:.4f}")
    print(f"Macro precision: {s2_macro_precision:.4f}")
    print(f"Macro recall:    {s2_macro_recall:.4f}")
    print(f"Macro F1:        {s2_macro_f1:.4f}")
    print("Per-class report:")
    print(report)
    print("Confusion matrix labels:", HAM_CATEGORIES)
    print(cm_s2)
    print()

    boundary_stats = defaultdict(lambda: {"total": 0, "correct": 0})
    for case in ham_cases:
        pair = boundary_pair(case.boundary_type)
        if not pair:
            continue
        stage1_pred = predict_stage1(case.text, model, vectorizer, threshold)
        if stage1_pred["is_spam"]:
            predicted = "__stage1_spam__"
        else:
            predicted = predict_stage2(case.text, stage2)
        boundary_stats[pair]["total"] += 1
        if predicted == case.expected_category:
            boundary_stats[pair]["correct"] += 1

    print("BOUNDARY ANALYSIS")
    print("-" * 70)
    for pair in sorted(boundary_stats):
        stats = boundary_stats[pair]
        acc = stats["correct"] / stats["total"] if stats["total"] else 0.0
        print(f"{pair}: {stats['correct']}/{stats['total']} correct ({acc:.1%})")
    print()

    if incorrect_stage2:
        print("INCORRECT STAGE 2 PREDICTIONS")
        print("-" * 70)
        for row in incorrect_stage2:
            print(f"Message: {row['message']}")
            print(f"Expected: {row['expected']}")
            print(f"Predicted: {row['predicted']}")
            print(f"Boundary type: {row['boundary_type']}")
            print(f"Why difficult: {row['why_difficult']}")
            print("-" * 40)

    counts = Counter(case.expected_label for case in cases)
    cat_counts = Counter(case.expected_category for case in cases if case.expected_category)

    summary = {
        "total_messages": len(cases),
        "ham_count": counts.get("ham", 0),
        "spam_count": counts.get("spam", 0),
        "stage2_category_counts": dict(cat_counts),
        "duplicates_removed": len(UNSEEN_CASES) - len(cases),
        "similarity_conflicts": len(exact) + len(normalized) + len(template),
        "stage1": {
            "accuracy": s1_accuracy,
            "spam_precision": s1_precision,
            "spam_recall": s1_recall,
            "spam_f1": s1_f1,
            "false_positives": false_positives,
            "false_negatives": false_negatives,
        },
        "stage2": {
            "accuracy": s2_accuracy,
            "macro_precision": s2_macro_precision,
            "macro_recall": s2_macro_recall,
            "macro_f1": s2_macro_f1,
        },
        "incorrect_stage2_count": len(incorrect_stage2),
    }
    print("JSON SUMMARY")
    print(json.dumps(summary, indent=2))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
